/**
 * TikShank Server v5 - Optimizado y seguro
 * Stack: Node.js + Express + WebSocket
 * Deploy en Railway (puerto 8080)
 */

const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
const FRONTEND_URL = process.env.FRONTEND_URL || "*";

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── ESTADO EN MEMORIA ────────────────────────────────────────────────────────
const sessions = new Map(); // wsClient → { username, roomId, tiktokWs }

// ─── HELPER: broadcast a todos los clientes conectados ───────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}

// ─── WS PRINCIPAL ─────────────────────────────────────────────────────────────
wss.on("connection", (ws) => {
  console.log("🔌 Cliente conectado");

  ws.on("message", async (raw) => {
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    // ── CONNECT: pide conectar a un live de TikTok ──
    if (data.type === "CONNECT") {
      const { username } = data;
      if (!username) return ws.send(JSON.stringify({ type: "ERROR", message: "Username requerido" }));

      try {
        // Intentar obtener roomId de TikTok
        const roomId = await getTikTokRoomId(username);
        sessions.set(ws, { username, roomId });

        ws.send(JSON.stringify({ type: "CONNECTED", username, roomId }));
        console.log(`✅ Conectado a @${username} roomId=${roomId}`);

        // Conectar WebSocket al live de TikTok
        connectTikTokWS(ws, username, roomId);
      } catch (err) {
        ws.send(JSON.stringify({ type: "ERROR", message: err.message }));
      }
    }

    // ── DISCONNECT ──
    if (data.type === "DISCONNECT") {
      const session = sessions.get(ws);
      if (session?.tiktokWs) {
        session.tiktokWs.close();
      }
      sessions.delete(ws);
      ws.send(JSON.stringify({ type: "DISCONNECTED" }));
    }
  });

  ws.on("close", () => {
    const session = sessions.get(ws);
    if (session?.tiktokWs) session.tiktokWs.close();
    sessions.delete(ws);
    console.log("🔌 Cliente desconectado");
  });
});

// ─── OBTENER ROOMID DE TIKTOK ─────────────────────────────────────────────────
async function getTikTokRoomId(username) {
  // Usando tiktok-live-connector o API pública
  // En producción: npm i tiktok-live-connector
  // Por ahora retorna mock para desarrollo
  if (process.env.NODE_ENV === "production") {
    const { WebcastPushConnection } = require("tiktok-live-connector");
    // Solo buscamos el roomId sin conectar aún
    const tempConn = new WebcastPushConnection(username);
    const state = await tempConn.getRoomInfo();
    return state.roomId;
  }
  // Dev mock
  return "763821706828294" + Math.floor(Math.random() * 10);
}

// ─── CONECTAR WEBSOCKET A TIKTOK LIVE ────────────────────────────────────────
function connectTikTokWS(clientWs, username, roomId) {
  if (process.env.NODE_ENV !== "production") {
    // Simular eventos en dev
    simulateDevEvents(clientWs, username);
    return;
  }

  try {
    const { WebcastPushConnection } = require("tiktok-live-connector");
    const tiktok = new WebcastPushConnection(username);
    const session = sessions.get(clientWs);
    if (session) session.tiktokWs = tiktok;

    tiktok.connect().catch((err) => {
      clientWs.send(JSON.stringify({ type: "ERROR", message: `TikTok WS: ${err.message}` }));
    });

    // Eventos del live
    tiktok.on("chat", (data) => {
      clientWs.send(JSON.stringify({
        type: "CHAT",
        user: data.uniqueId,
        nickname: data.nickname,
        message: data.comment,
        avatar: data.profilePictureUrl,
        followers: data.followRole > 0,
        isMod: data.isModerator,
        timestamp: Date.now(),
      }));
    });

    tiktok.on("gift", (data) => {
      if (!data.repeatEnd) return; // Solo al terminar el combo
      clientWs.send(JSON.stringify({
        type: "GIFT",
        user: data.uniqueId,
        nickname: data.nickname,
        giftId: data.giftId,
        giftName: data.giftName,
        giftEmoji: "🎁",
        coins: data.diamondCount,
        repeatCount: data.repeatCount,
        timestamp: Date.now(),
      }));
    });

    tiktok.on("follow", (data) => {
      clientWs.send(JSON.stringify({
        type: "FOLLOW",
        user: data.uniqueId,
        nickname: data.nickname,
        timestamp: Date.now(),
      }));
    });

    tiktok.on("share", (data) => {
      clientWs.send(JSON.stringify({
        type: "SHARE",
        user: data.uniqueId,
        nickname: data.nickname,
        timestamp: Date.now(),
      }));
    });

    tiktok.on("roomUser", (data) => {
      clientWs.send(JSON.stringify({
        type: "VIEWERS",
        count: data.viewerCount,
        timestamp: Date.now(),
      }));
    });

    tiktok.on("like", (data) => {
      clientWs.send(JSON.stringify({
        type: "LIKES",
        count: data.likeCount,
        total: data.totalLikeCount,
        user: data.uniqueId,
        timestamp: Date.now(),
      }));
    });

    // Batallas
    tiktok.on("battle", (data) => {
      clientWs.send(JSON.stringify({
        type: "BATTLE",
        subType: data.status,
        data,
        timestamp: Date.now(),
      }));
    });

    tiktok.on("error", (err) => {
      clientWs.send(JSON.stringify({ type: "WS_ERROR", message: err.message }));
    });

    tiktok.on("streamEnd", () => {
      clientWs.send(JSON.stringify({ type: "STREAM_END" }));
    });
  } catch (err) {
    clientWs.send(JSON.stringify({ type: "ERROR", message: err.message }));
  }
}

// ─── SIMULADOR DE EVENTOS (DEV) ───────────────────────────────────────────────
function simulateDevEvents(clientWs, username) {
  const users = ["fan_peru", "streamer_mx", "chico_ar", "user_es", "tiktokfan99"];
  const gifts = [
    { name: "Rosa", emoji: "🌹", coins: 1 },
    { name: "TikTok", emoji: "📱", coins: 1 },
    { name: "León", emoji: "🦁", coins: 1000 },
    { name: "Universo", emoji: "🌍", coins: 34999 },
  ];
  const messages = [
    "¡Hola desde Peru! 🇵🇪",
    "muy buen live bro",
    "saludos desde México",
    "eres el mejor streamer",
    "!song Tusa",
    "!song Bad Bunny",
  ];

  let viewers = 50;
  let likes = 0;

  const interval = setInterval(() => {
    if (!sessions.has(clientWs)) {
      clearInterval(interval);
      return;
    }

    const r = Math.random();

    // Viewer count
    viewers += Math.floor((Math.random() - 0.3) * 5);
    viewers = Math.max(10, viewers);
    clientWs.send(JSON.stringify({ type: "VIEWERS", count: viewers }));

    if (r < 0.4) {
      const u = users[Math.floor(Math.random() * users.length)];
      clientWs.send(JSON.stringify({
        type: "CHAT",
        user: u,
        nickname: u,
        message: messages[Math.floor(Math.random() * messages.length)],
        followers: Math.random() > 0.5,
        isMod: Math.random() > 0.9,
        timestamp: Date.now(),
      }));
    } else if (r < 0.55) {
      const u = users[Math.floor(Math.random() * users.length)];
      const g = gifts[Math.floor(Math.random() * gifts.length)];
      clientWs.send(JSON.stringify({
        type: "GIFT",
        user: u,
        nickname: u,
        giftName: g.name,
        giftEmoji: g.emoji,
        coins: g.coins,
        repeatCount: Math.ceil(Math.random() * 5),
        timestamp: Date.now(),
      }));
    } else if (r < 0.65) {
      const u = users[Math.floor(Math.random() * users.length)];
      clientWs.send(JSON.stringify({ type: "FOLLOW", user: u, nickname: u, timestamp: Date.now() }));
    } else if (r < 0.70) {
      likes += Math.floor(Math.random() * 50);
      clientWs.send(JSON.stringify({ type: "LIKES", count: Math.floor(Math.random() * 10), total: likes }));
    }
  }, 1800);
}

// ─── REST ENDPOINTS ───────────────────────────────────────────────────────────

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), connections: wss.clients.size });
});

// Stats
app.get("/api/stats", (req, res) => {
  res.json({ connections: wss.clients.size, sessions: sessions.size });
});

// ─── ARRANQUE ─────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🚀 TikShank Server v5 en puerto ${PORT}`);
  console.log(`📡 CORS: ${FRONTEND_URL}`);
  console.log(`🌍 Node: ${process.version}`);
});

module.exports = app;
