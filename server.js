/**
 * TikShank Server v5.1 - Fix SIGTERM Railway
 */

const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;
const FRONTEND_URL = process.env.FRONTEND_URL || "*";

app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

const sessions = new Map();

// ─── WEBSOCKET ────────────────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  console.log("Cliente conectado");

  ws.on("message", async (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    if (data.type === "CONNECT") {
      const { username } = data;
      if (!username) return ws.send(JSON.stringify({ type: "ERROR", message: "Username requerido" }));
      console.log("Intentando conectar a @" + username);
      await connectToTikTok(ws, username);
    }

    if (data.type === "DISCONNECT") {
      const session = sessions.get(ws);
      if (session && session.tiktok) {
        try { session.tiktok.disconnect(); } catch {}
      }
      sessions.delete(ws);
      ws.send(JSON.stringify({ type: "DISCONNECTED" }));
    }
  });

  ws.on("close", () => {
    const session = sessions.get(ws);
    if (session && session.tiktok) {
      try { session.tiktok.disconnect(); } catch {}
    }
    sessions.delete(ws);
  });

  ws.on("error", () => { sessions.delete(ws); });
});

// ─── CONECTAR A TIKTOK ────────────────────────────────────────────────────────
async function connectToTikTok(ws, username) {
  let WebcastPushConnection;
  try {
    const mod = require("tiktok-live-connector");
    WebcastPushConnection = mod.WebcastPushConnection;
  } catch (err) {
    safeSend(ws, { type: "ERROR", message: "Modulo TikTok no disponible: " + err.message });
    return;
  }

  let tiktok;
  try {
    tiktok = new WebcastPushConnection(username, {
      processInitialData: false,
      enableExtendedGiftInfo: true,
      enableWebsocketUpgrade: true,
      requestPollingIntervalMs: 2000,
    });
  } catch (err) {
    safeSend(ws, { type: "ERROR", message: "Error al crear conexion: " + err.message });
    return;
  }

  sessions.set(ws, { username, tiktok });

  tiktok.on("chat", (d) => {
    safeSend(ws, {
      type: "CHAT", user: d.uniqueId, nickname: d.nickname || d.uniqueId,
      message: d.comment, followers: d.followRole > 0, isMod: d.isModerator, timestamp: Date.now(),
    });
  });

  tiktok.on("gift", (d) => {
    if (!d.repeatEnd) return;
    safeSend(ws, {
      type: "GIFT", user: d.uniqueId, nickname: d.nickname || d.uniqueId,
      giftId: d.giftId, giftName: d.giftName, giftEmoji: "regalo",
      coins: d.diamondCount || 0, repeatCount: d.repeatCount || 1, timestamp: Date.now(),
    });
  });

  tiktok.on("follow", (d) => {
    safeSend(ws, { type: "FOLLOW", user: d.uniqueId, nickname: d.nickname || d.uniqueId, timestamp: Date.now() });
  });

  tiktok.on("like", (d) => {
    safeSend(ws, { type: "LIKES", count: d.likeCount || 0, total: d.totalLikeCount || 0, timestamp: Date.now() });
  });

  tiktok.on("roomUser", (d) => {
    safeSend(ws, { type: "VIEWERS", count: d.viewerCount || 0, timestamp: Date.now() });
  });

  tiktok.on("streamEnd", () => {
    safeSend(ws, { type: "STREAM_END" });
    sessions.delete(ws);
  });

  tiktok.on("error", (err) => {
    console.error("TikTok error @" + username + ":", err.message);
    safeSend(ws, { type: "WS_ERROR", message: err.message });
  });

  // Timeout de 15s
  const timeout = setTimeout(() => {
    console.warn("Timeout conectando a @" + username);
    safeSend(ws, { type: "ERROR", message: "Timeout: verifica que @" + username + " este en vivo." });
    try { tiktok.disconnect(); } catch {}
    sessions.delete(ws);
  }, 15000);

  try {
    const state = await tiktok.connect();
    clearTimeout(timeout);
    console.log("Conectado a @" + username + " roomId=" + state.roomId);
    safeSend(ws, { type: "CONNECTED", username, roomId: state.roomId, viewers: state.viewerCount || 0 });
  } catch (err) {
    clearTimeout(timeout);
    console.error("Error conectando a @" + username + ":", err.message);
    safeSend(ws, { type: "ERROR", message: "No se pudo conectar a @" + username + ". Verifica que exista y este en vivo." });
    sessions.delete(ws);
  }
}

function safeSend(ws, data) {
  try { if (ws.readyState === 1) ws.send(JSON.stringify(data)); } catch {}
}

// ─── REST ─────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "TikShank v5.1", uptime: Math.round(process.uptime()) });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: Math.round(process.uptime()), connections: wss.clients.size });
});

// ─── EVITAR CRASHES QUE MATAN EL PROCESO ─────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("uncaughtException (no fatal):", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection (no fatal):", String(reason));
});

// ─── ARRANQUE ─────────────────────────────────────────────────────────────────
server.listen(PORT, "0.0.0.0", () => {
  console.log("TikShank Server v5.1 en puerto " + PORT);
  console.log("Node: " + process.version);
});
