"use strict";

/**
 * TikPanel Server v4 — Railway
 * 
 * Dependencias: express, socket.io, cors, axios, ws
 * NO usa tiktok-live-connector (causaba SIGTERM en Railway)
 * Conecta a TikTok LIVE via su API pública + WebSocket nativo
 */

const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const cors       = require("cors");
const WebSocket  = require("ws");
const https      = require("https");

/* ─── Config ──────────────────────────────────── */
const PORT           = process.env.PORT || 8080;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

/* ─── App ─────────────────────────────────────── */
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ["GET","POST"] },
  pingTimeout: 30000,
  pingInterval: 15000,
});

app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

/* ─── Estado ──────────────────────────────────── */
// username → { ws, roomId, connected, viewers, retryTimer, retryCount }
const sessions = new Map();

function log(...a) { console.log(new Date().toISOString().slice(11,19), ...a); }

/* ─────────────────────────────────────────────── 
   HELPERS: obtener roomId y WebSocket URL de TikTok
   ─────────────────────────────────────────────── */

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        ...headers,
      },
    };
    https.get(url, opts, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on("error", reject);
  });
}

async function getRoomId(username, sessionId) {
  // 1. Intentar con la página del live
  const url = `https://www.tiktok.com/@${username}/live`;
  const headers = {};
  if (sessionId) headers["Cookie"] = `sessionid=${sessionId}`;

  const res = await httpsGet(url, headers);
  if (res.status !== 200) throw new Error(`TikTok respondió ${res.status}`);

  // Buscar roomId en el HTML
  const patterns = [
    /"roomId"\s*:\s*"(\d+)"/,
    /roomId=(\d+)/,
    /"room_id"\s*:\s*"(\d+)"/,
    /liveRoomId"\s*:\s*"(\d+)"/,
  ];

  for (const p of patterns) {
    const m = res.body.match(p);
    if (m?.[1]) return m[1];
  }

  // ¿Está en live?
  if (res.body.includes("LIVE_NOT_STARTED") || res.body.includes("liveNotStarted")) {
    throw new Error("El usuario no está en LIVE ahora mismo");
  }
  if (res.body.includes("user not found") || res.body.includes("userNotFound")) {
    throw new Error("Usuario no encontrado en TikTok");
  }

  throw new Error("No se pudo obtener el roomId — ¿el usuario está en LIVE?");
}

async function getWebSocketInfo(username, roomId, sessionId) {
  const headers = {};
  if (sessionId) headers["Cookie"] = `sessionid=${sessionId}`;

  const url = `https://webcast.tiktok.com/webcast/room/enter/?aid=1988&app_language=en-US&device_platform=web&room_id=${roomId}&sig_hash=undefined`;
  const res = await httpsGet(url, headers);

  try {
    const json = JSON.parse(res.body);
    const wsUrl = json?.data?.pushserver?.push_url || json?.data?.wsUrl;
    if (wsUrl) return wsUrl;
  } catch (_) {}

  // Fallback: construir URL directa
  return `wss://webcast.tiktok.com/webcast/im/push/v2/?app_name=tiktok_web&version_code=180800&webcast_sdk_version=1.3.0&device_platform=web&aid=1988&room_id=${roomId}`;
}

/* ─── Parsear mensaje WebSocket de TikTok ──────── */
function parseTikTokMessage(rawData) {
  // TikTok envía protobuf, pero también mensajes JSON en algunos casos
  // Intentamos parsear como JSON primero
  try {
    const text = rawData.toString("utf8");
    if (text.startsWith("{")) {
      return JSON.parse(text);
    }
  } catch (_) {}
  return null;
}

/* ─── Conectar WebSocket a sala de TikTok ──────── */
async function connectTikTok(username, sessionId) {
  // Desconectar sesión previa
  if (sessions.has(username)) {
    const old = sessions.get(username);
    clearTimeout(old.retryTimer);
    if (old.ws) { try { old.ws.terminate(); } catch (_) {} }
    sessions.delete(username);
  }

  const state = {
    ws: null,
    roomId: null,
    username,
    sessionId,
    connected: false,
    viewers: 0,
    topViewers: [],
    retryTimer: null,
    retryCount: 0,
  };
  sessions.set(username, state);

  // Obtener roomId
  log(`🔍 Buscando roomId de @${username}...`);
  state.roomId = await getRoomId(username, sessionId);
  log(`✅ roomId encontrado: ${state.roomId}`);

  // Obtener URL del WebSocket
  const wsUrl = await getWebSocketInfo(username, state.roomId, sessionId);
  log(`🔗 Conectando WebSocket...`);

  const ws = new WebSocket(wsUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      "Origin": "https://www.tiktok.com",
      ...(sessionId ? { "Cookie": `sessionid=${sessionId}` } : {}),
    },
  });

  state.ws = ws;

  ws.on("open", () => {
    state.connected = true;
    state.retryCount = 0;
    log(`✅ WebSocket conectado a @${username}`);
    io.emit("tiktok_connected", { username });
  });

  ws.on("message", (data) => {
    handleTikTokEvent(username, data);
  });

  ws.on("close", (code, reason) => {
    const wasConnected = state.connected;
    state.connected = false;
    log(`❌ WS cerrado @${username} code=${code}`);

    if (wasConnected) {
      io.emit("tiktok_disconnected", { username });
    }

    // Reintento con backoff exponencial (máx 60s)
    if (state.retryCount < 10) {
      const delay = Math.min(5000 * Math.pow(1.5, state.retryCount), 60000);
      state.retryCount++;
      log(`🔄 Reintento #${state.retryCount} en ${Math.round(delay/1000)}s @${username}`);
      state.retryTimer = setTimeout(() => {
        connectTikTok(username, sessionId).catch(e => {
          log(`❌ Reintento fallido: ${e.message}`);
        });
      }, delay);
    }
  });

  ws.on("error", (err) => {
    log(`⚠️ WS error @${username}:`, err.message);
    io.emit("tiktok_error", { username, message: err.message });
  });

  // Ping periódico para mantener conexión viva
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 10000);

  return state;
}

/* ─── Manejar eventos de TikTok ─────────────────── */
function handleTikTokEvent(username, rawData) {
  const msg = parseTikTokMessage(rawData);
  if (!msg) return; // protobuf sin parsear — ignorar por ahora

  const type = msg.type || msg.event;

  if (type === "chat" || msg.comment) {
    io.emit("event", {
      type: "chat",
      user: msg.uniqueId || msg.userId || "?",
      nickname: msg.nickname || msg.displayId || "?",
      comment: msg.comment || msg.content || "",
    });
  } else if (type === "gift" || msg.giftId) {
    const diamonds = (msg.diamondCount || 0) * (msg.giftCount || 1);
    io.emit("event", {
      type: "gift",
      user: msg.uniqueId || "?",
      nickname: msg.nickname || "?",
      giftName: msg.giftName || msg.gift?.name || "Regalo",
      giftCount: msg.giftCount || 1,
      diamondCount: diamonds,
    });
  } else if (type === "follow" || msg.displayType === "pm_mt_guidance_viewer_follow_live") {
    io.emit("event", {
      type: "follow",
      user: msg.uniqueId || "?",
      nickname: msg.nickname || "?",
    });
  } else if (type === "like") {
    io.emit("event", {
      type: "like",
      user: msg.uniqueId || "?",
      nickname: msg.nickname || "?",
      likeCount: msg.likeCount || 1,
      totalLikeCount: msg.totalLikeCount || 0,
    });
  } else if (type === "subscribe" || type === "sub") {
    io.emit("event", {
      type: "sub",
      user: msg.uniqueId || "?",
      nickname: msg.nickname || "?",
    });
  } else if (type === "share") {
    io.emit("event", {
      type: "share",
      user: msg.uniqueId || "?",
      nickname: msg.nickname || "?",
    });
  } else if (type === "roomUser" || msg.viewerCount !== undefined) {
    const st = sessions.get(username);
    if (st) {
      st.viewers = msg.viewerCount || 0;
      io.emit("viewers", { count: st.viewers, topViewers: st.topViewers || [] });
    }
  } else if (type === "member") {
    io.emit("member", {
      user: msg.uniqueId || "?",
      nickname: msg.nickname || "?",
      timestamp: Date.now(),
    });
  }
}

/* ─── REST API ─────────────────────────────────── */

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "TikPanel Server v4",
    sessions: sessions.size,
    uptime: Math.floor(process.uptime()),
  });
});

app.get("/status/:username", (req, res) => {
  const username = req.params.username.replace(/^@/, "").toLowerCase();
  const st = sessions.get(username);
  res.json({
    connected: !!(st?.connected),
    viewers: st?.viewers || 0,
    roomId: st?.roomId || null,
  });
});

app.post("/connect", async (req, res) => {
  let { username, sessionId } = req.body || {};
  if (!username) return res.status(400).json({ success: false, error: "Falta username" });

  username = username.replace(/^@/, "").toLowerCase().trim();

  try {
    await connectTikTok(username, sessionId || undefined);
    res.json({ success: true, username });
  } catch (err) {
    log(`❌ /connect @${username}:`, err.message);

    let msg = err.message || "Error desconocido";
    if (msg.includes("respondió 4")) msg = "No se pudo acceder al LIVE — ¿el usuario está en LIVE?";
    if (msg.includes("LIVE"))        msg = "El usuario no está en LIVE ahora mismo";
    if (msg.includes("encontrado"))  msg = "Usuario no encontrado en TikTok";
    if (msg.includes("429"))         msg = "TikTok bloqueó la solicitud. Espera unos segundos";
    if (msg.includes("roomId"))      msg = "¿El usuario está en LIVE? No se encontró la sala";

    res.json({ success: false, error: msg });
  }
});

app.post("/disconnect", (req, res) => {
  let { username } = req.body || {};
  if (!username) return res.status(400).json({ success: false, error: "Falta username" });

  username = username.replace(/^@/, "").toLowerCase().trim();
  const st = sessions.get(username);
  if (st) {
    clearTimeout(st.retryTimer);
    if (st.ws) { try { st.ws.terminate(); } catch (_) {} }
    sessions.delete(username);
    log(`🔌 Desconectado @${username}`);
  }
  res.json({ success: true });
});

/* ─── Socket.IO ─────────────────────────────────── */
io.on("connection", sock => {
  log(`Socket: ${sock.id} conectado`);
  sock.on("disconnect", () => log(`Socket: ${sock.id} desconectado`));
});

/* ─── Manejo global de errores ──────────────────── */
process.on("uncaughtException", err => {
  console.error("💥 uncaughtException:", err.message);
  // No salir — Railway lo mataría y perdería sesiones
});

process.on("unhandledRejection", reason => {
  console.error("💥 unhandledRejection:", reason?.message || reason);
});

/* ─── Iniciar ────────────────────────────────────── */
server.listen(PORT, () => {
  log(`🚀 TikPanel Server v4 en puerto ${PORT}`);
  log(`   CORS: ${ALLOWED_ORIGIN}`);
  log(`   Node: ${process.version}`);
});
