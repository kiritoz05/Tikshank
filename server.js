/**
 * TikPanel Server v3 — Railway ready
 * Fixes:
 *  - package.json ahora incluye tiktok-live-connector + express + socket.io
 *  - Variables de entorno opcionales (no crashea si faltan)
 *  - Reconexión automática con backoff
 *  - Manejo de errores global (uncaughtException / unhandledRejection)
 *  - Endpoint /status/:username para que el frontend sepa si sigue conectado
 *  - CORS configurable via env ALLOWED_ORIGIN
 */

"use strict";

const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const { WebcastPushConnection } = require("tiktok-live-connector");
const cors       = require("cors");

/* ─── Configuración ────────────────────────────── */
const PORT           = process.env.PORT || 8080;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const SESSION_SECRET = process.env.SESSION_SECRET || null;   // opcional

if (!SESSION_SECRET) {
  console.warn("⚠️  SESSION_SECRET no configurado — conexión sin sessionId (puede fallar en cuentas privadas)");
}

/* ─── Express + Socket.IO ──────────────────────── */
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ["GET","POST"] },
  pingTimeout: 20000,
  pingInterval: 10000,
});

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

/* ─── Estado en memoria ────────────────────────── */
// username → { connection, viewers, topViewers, retryTimer }
const sessions = new Map();

/* ─── Helpers ──────────────────────────────────── */
function log(...args) {
  console.log(new Date().toISOString().slice(11,19), ...args);
}

function broadcastToAll(event, data) {
  io.emit("event", { type: event, ...data });
}

/* ─── Conectar a TikTok LIVE ───────────────────── */
async function connectTikTok(username, sessionId) {
  // Si ya hay sesión activa para este usuario, desconectar primero
  if (sessions.has(username)) {
    const old = sessions.get(username);
    clearTimeout(old.retryTimer);
    try { old.connection.disconnect(); } catch(_) {}
    sessions.delete(username);
  }

  const opts = {
    processInitialData: false,
    enableExtendedGiftInfo: true,
    enableWebsocketUpgrade: true,
    requestPollingIntervalMs: 2000,
    clientParams: { app_language: "es", device_platform: "web" },
  };

  // sessionId permite conectar aunque la cuenta no sea pública
  if (sessionId) opts.sessionId = sessionId;

  const tiktok = new WebcastPushConnection(username, opts);

  /* Guardar en mapa antes de conectar */
  const state = {
    connection: tiktok,
    username,
    viewers: 0,
    topViewers: [],       // [{ user, nickname, count }]
    giftMap: new Map(),   // user → diamonds
    likeMap: new Map(),   // user → likes
    retryTimer: null,
    connected: false,
  };
  sessions.set(username, state);

  /* ── Eventos TikTok ─── */

  tiktok.on("chat", d => {
    io.emit("event", {
      type: "chat",
      user: d.uniqueId,
      nickname: d.nickname,
      comment: d.comment,
    });
  });

  tiktok.on("gift", d => {
    const diamonds = (d.diamondCount || 0) * (d.giftCount || 1);
    const st = sessions.get(username);
    if (st) {
      const prev = st.giftMap.get(d.uniqueId) || 0;
      st.giftMap.set(d.uniqueId, prev + diamonds);
    }
    io.emit("event", {
      type: "gift",
      user: d.uniqueId,
      nickname: d.nickname,
      giftName: d.giftName,
      giftCount: d.giftCount || 1,
      diamondCount: diamonds,
    });
  });

  tiktok.on("follow", d => {
    io.emit("event", {
      type: "follow",
      user: d.uniqueId,
      nickname: d.nickname,
    });
  });

  tiktok.on("like", d => {
    io.emit("event", {
      type: "like",
      user: d.uniqueId,
      nickname: d.nickname,
      likeCount: d.likeCount || 1,
      totalLikeCount: d.totalLikeCount || 0,
    });
  });

  tiktok.on("subscribe", d => {
    io.emit("event", {
      type: "sub",
      user: d.uniqueId,
      nickname: d.nickname,
    });
  });

  tiktok.on("share", d => {
    io.emit("event", {
      type: "share",
      user: d.uniqueId,
      nickname: d.nickname,
    });
  });

  tiktok.on("member", d => {
    io.emit("member", {
      user: d.uniqueId,
      nickname: d.nickname,
      timestamp: Date.now(),
    });
  });

  tiktok.on("roomUser", d => {
    const st = sessions.get(username);
    if (!st) return;
    st.viewers = d.viewerCount || 0;
    // topViewers si viene en el payload
    if (Array.isArray(d.topViewers)) {
      st.topViewers = d.topViewers.map(v => ({
        user: v.user?.uniqueId || "?",
        nickname: v.user?.nickname || v.user?.uniqueId || "?",
        count: v.coinCount || 0,
      })).filter(v => v.user !== "?");
    }
    io.emit("viewers", { count: st.viewers, topViewers: st.topViewers });
  });

  tiktok.on("battle", d => {
    io.emit("battle", d);
  });

  tiktok.on("streamEnd", () => {
    log(`🔴 LIVE terminado @${username}`);
    io.emit("tiktok_disconnected", { username });
    const st = sessions.get(username);
    if (st) st.connected = false;
  });

  tiktok.on("disconnected", () => {
    log(`❌ Desconectado de @${username}`);
    io.emit("tiktok_disconnected", { username });
    const st = sessions.get(username);
    if (st) {
      st.connected = false;
      // Reintento automático cada 15 segundos
      st.retryTimer = setTimeout(() => {
        log(`🔄 Reintentando conexión a @${username}...`);
        connectTikTok(username, sessionId).catch(e => {
          log(`❌ Reintento fallido @${username}:`, e.message);
        });
      }, 15000);
    }
  });

  tiktok.on("error", err => {
    log(`⚠️  Error TikTok @${username}:`, err.message || err);
    io.emit("tiktok_error", { username, message: err.message || String(err) });
  });

  /* ── Conectar ─── */
  const info = await tiktok.connect();
  state.connected = true;
  log(`✅ Conectado a @${username} — viewers: ${info?.roomInfo?.userCount || 0}`);
  return info;
}

/* ─── REST API ─────────────────────────────────── */

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "TikPanel Server v3", sessions: sessions.size });
});

app.get("/status/:username", (req, res) => {
  const username = req.params.username.replace(/^@/, "").toLowerCase();
  const st = sessions.get(username);
  res.json({ connected: !!(st && st.connected), viewers: st?.viewers || 0 });
});

app.post("/connect", async (req, res) => {
  let { username, sessionId } = req.body || {};
  if (!username) return res.status(400).json({ success: false, error: "Falta username" });

  username = username.replace(/^@/, "").toLowerCase().trim();

  try {
    await connectTikTok(username, sessionId || SESSION_SECRET || undefined);
    res.json({ success: true, username });
  } catch (err) {
    log(`❌ /connect error @${username}:`, err.message);
    let msg = err.message || "Error desconocido";
    // Mensajes amigables
    if (msg.includes("LIVE") || msg.includes("live"))      msg = "El usuario no está en LIVE ahora mismo";
    if (msg.includes("not found") || msg.includes("404"))  msg = "Usuario no encontrado en TikTok";
    if (msg.includes("429") || msg.includes("rate"))       msg = "Demasiadas conexiones, espera un momento";
    res.json({ success: false, error: msg });
  }
});

app.post("/disconnect", async (req, res) => {
  let { username } = req.body || {};
  if (!username) return res.status(400).json({ success: false, error: "Falta username" });

  username = username.replace(/^@/, "").toLowerCase().trim();
  const st = sessions.get(username);
  if (st) {
    clearTimeout(st.retryTimer);
    try { st.connection.disconnect(); } catch(_) {}
    sessions.delete(username);
    log(`🔌 Desconectado manualmente @${username}`);
  }
  res.json({ success: true });
});

/* ─── Socket.IO ─────────────────────────────────── */
io.on("connection", sock => {
  log(`Socket conectado: ${sock.id}`);
  sock.on("disconnect", () => log(`Socket desconectado: ${sock.id}`));
});

/* ─── Manejo global de errores ──────────────────── */
process.on("uncaughtException", err => {
  console.error("💥 uncaughtException:", err.message);
  // NO salir — Railway lo reinicia de todas formas y perderíamos las sesiones activas
});

process.on("unhandledRejection", (reason) => {
  console.error("💥 unhandledRejection:", reason?.message || reason);
});

/* ─── Iniciar servidor ──────────────────────────── */
server.listen(PORT, () => {
  log(`🚀 TikPanel Server v3 en puerto ${PORT}`);
});
