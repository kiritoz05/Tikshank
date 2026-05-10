/**
 * TikShank Server v6.0
 * Servidor de alertas y overlays para TikTok Live
 * Fixes: PORT dinámico, SIGTERM, WebSocket, reconexión automática
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

// ✅ FIX #1: Puerto dinámico (Railway/Render/Heroku usan process.env.PORT)
const PORT = process.env.PORT || 8080;

const app = express();
const httpServer = http.createServer(app);

// ✅ FIX #2: Socket.IO con CORS correcto
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────
//  Estado global del servidor
// ─────────────────────────────────────────────
const state = {
  startTime: Date.now(),
  tiktokUser: null,
  isLive: false,
  stats: {
    likes: 0,
    followers: 0,
    viewers: 0,
    gifts: 0,
    giftPoints: 0,
    comments: 0,
    shares: 0
  },
  leaderboard: {
    gifters: {},    // username → { name, points, count }
    chatters: {}    // username → { name, count }
  },
  recentEvents: [],  // últimos 50 eventos
  alerts: [],
  config: {
    alertDuration: process.env.ALERT_DURATION || 5000,
    overlayTheme: process.env.OVERLAY_THEME || 'dark',
    currency: process.env.CURRENCY || 'PEN',
    minGiftAlert: process.env.MIN_GIFT_ALERT || 1,
    followAlert: process.env.FOLLOW_ALERT !== 'false',
    likeAlert: process.env.LIKE_ALERT !== 'false',
    giftAlert: process.env.GIFT_ALERT !== 'false',
    chatAlert: process.env.CHAT_ALERT !== 'false',
  }
};

// Diccionario de regalos TikTok con su valor en monedas
const GIFT_CATALOG = {
  'Rose':        { coins: 1,    emoji: '🌹' },
  'TikTok':      { coins: 1,    emoji: '🎵' },
  'Finger Heart':{ coins: 5,    emoji: '🤙' },
  'Ice Cream':   { coins: 30,   emoji: '🍦' },
  'Cap':         { coins: 99,   emoji: '🧢' },
  'Perfume':     { coins: 20,   emoji: '🌸' },
  'Music Play':  { coins: 29,   emoji: '🎶' },
  'Birthday Cake':{ coins: 169, emoji: '🎂' },
  'Drama Queen': { coins: 5000, emoji: '👑' },
  'Universe':    { coins: 34999,emoji: '🌌' },
  'Lion':        { coins: 29999,emoji: '🦁' },
  'Love Bang':   { coins: 25000,emoji: '💥' },
};

// ─────────────────────────────────────────────
//  TikTok Live Connector
// ─────────────────────────────────────────────
let tiktokConnection = null;

async function connectToTikTok(username) {
  // Desconectar sesión anterior si existe
  if (tiktokConnection) {
    try { tiktokConnection.disconnect(); } catch(e) {}
    tiktokConnection = null;
  }

  try {
    const { WebcastPushConnection } = require('tiktok-live-connector');

    tiktokConnection = new WebcastPushConnection(username, {
      processInitialData: true,
      fetchRoomInfoOnConnect: true,
      enableExtendedGiftInfo: true,
      enableWebsocketUpgrade: true,
      requestPollingIntervalMs: 2000,
      clientParams: {
        app_language: 'es-419',
        device_platform: 'web'
      }
    });

    // ── Conectar ──────────────────────────────
    const roomInfo = await tiktokConnection.connect();
    state.tiktokUser = username;
    state.isLive = true;
    state.stats.viewers = roomInfo.userCount || 0;

    console.log(`✅ Conectado a @${username} | Viewers: ${state.stats.viewers}`);
    io.emit('tiktok:connected', { username, roomInfo });
    broadcastState();

    // ── EVENTO: Chat ──────────────────────────
    tiktokConnection.on('chat', (data) => {
      const event = {
        type: 'chat',
        id: Date.now(),
        user: data.uniqueId,
        nickname: data.nickname,
        avatar: data.profilePictureUrl,
        comment: data.comment,
        followers: data.followRole,
        timestamp: new Date().toISOString()
      };
      state.stats.comments++;
      addEvent(event);

      // Leaderboard chatters
      if (!state.leaderboard.chatters[data.uniqueId]) {
        state.leaderboard.chatters[data.uniqueId] = { name: data.nickname, count: 0 };
      }
      state.leaderboard.chatters[data.uniqueId].count++;

      io.emit('event:chat', event);
      if (state.config.chatAlert) sendAlert('chat', event);
    });

    // ── EVENTO: Gift ──────────────────────────
    tiktokConnection.on('gift', (data) => {
      if (data.giftType === 1 && !data.repeatEnd) return; // streak aún no terminó

      const giftInfo = GIFT_CATALOG[data.giftName] || { coins: data.diamondCount || 1, emoji: '🎁' };
      const totalCoins = giftInfo.coins * (data.repeatCount || 1);

      const event = {
        type: 'gift',
        id: Date.now(),
        user: data.uniqueId,
        nickname: data.nickname,
        avatar: data.profilePictureUrl,
        giftName: data.giftName,
        giftImage: data.giftPictureUrl,
        emoji: giftInfo.emoji,
        coins: giftInfo.coins,
        count: data.repeatCount || 1,
        totalCoins,
        timestamp: new Date().toISOString()
      };

      state.stats.gifts += data.repeatCount || 1;
      state.stats.giftPoints += totalCoins;
      addEvent(event);

      // Leaderboard gifters
      if (!state.leaderboard.gifters[data.uniqueId]) {
        state.leaderboard.gifters[data.uniqueId] = { name: data.nickname, avatar: data.profilePictureUrl, points: 0, count: 0 };
      }
      state.leaderboard.gifters[data.uniqueId].points += totalCoins;
      state.leaderboard.gifters[data.uniqueId].count += data.repeatCount || 1;

      io.emit('event:gift', event);
      if (state.config.giftAlert && totalCoins >= state.config.minGiftAlert) {
        sendAlert('gift', event);
      }
    });

    // ── EVENTO: Follow ────────────────────────
    tiktokConnection.on('follow', (data) => {
      const event = {
        type: 'follow',
        id: Date.now(),
        user: data.uniqueId,
        nickname: data.nickname,
        avatar: data.profilePictureUrl,
        timestamp: new Date().toISOString()
      };
      state.stats.followers++;
      addEvent(event);
      io.emit('event:follow', event);
      if (state.config.followAlert) sendAlert('follow', event);
    });

    // ── EVENTO: Like ──────────────────────────
    tiktokConnection.on('like', (data) => {
      state.stats.likes += data.likeCount || 1;
      const event = {
        type: 'like',
        id: Date.now(),
        user: data.uniqueId,
        nickname: data.nickname,
        likeCount: data.likeCount,
        totalLikes: data.totalLikeCount,
        timestamp: new Date().toISOString()
      };
      addEvent(event);
      io.emit('event:like', event);
      io.emit('stats:update', { likes: state.stats.likes });
    });

    // ── EVENTO: Share ─────────────────────────
    tiktokConnection.on('share', (data) => {
      state.stats.shares++;
      const event = {
        type: 'share',
        id: Date.now(),
        user: data.uniqueId,
        nickname: data.nickname,
        timestamp: new Date().toISOString()
      };
      addEvent(event);
      io.emit('event:share', event);
    });

    // ── EVENTO: Viewers ───────────────────────
    tiktokConnection.on('roomUser', (data) => {
      state.stats.viewers = data.viewerCount || 0;
      io.emit('stats:update', { viewers: state.stats.viewers });
    });

    // ── EVENTO: Subscribe ─────────────────────
    tiktokConnection.on('subscribe', (data) => {
      const event = {
        type: 'subscribe',
        id: Date.now(),
        user: data.uniqueId,
        nickname: data.nickname,
        avatar: data.profilePictureUrl,
        timestamp: new Date().toISOString()
      };
      addEvent(event);
      io.emit('event:subscribe', event);
      sendAlert('subscribe', event);
    });

    // ── EVENTO: Stream End ────────────────────
    tiktokConnection.on('streamEnd', () => {
      console.log(`⏹️  Stream de @${username} terminó`);
      state.isLive = false;
      io.emit('tiktok:disconnected', { reason: 'streamEnd' });
    });

    // ── EVENTO: Error ─────────────────────────
    tiktokConnection.on('error', (err) => {
      console.error('❌ TikTok error:', err.message);
      io.emit('tiktok:error', { message: err.message });
    });

    tiktokConnection.on('disconnected', () => {
      state.isLive = false;
      console.log(`🔌 Desconectado de @${username}`);
      io.emit('tiktok:disconnected', { reason: 'disconnected' });
    });

    return { success: true, roomInfo };

  } catch (err) {
    console.error('❌ Error conectando a TikTok:', err.message);
    state.isLive = false;
    throw err;
  }
}

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function addEvent(event) {
  state.recentEvents.unshift(event);
  if (state.recentEvents.length > 100) state.recentEvents.pop();
}

function sendAlert(type, data) {
  const alert = { ...data, alertType: type, id: Date.now() };
  state.alerts.unshift(alert);
  if (state.alerts.length > 50) state.alerts.pop();
  io.emit('alert:new', alert);
}

function getLeaderboard(type = 'gifters', limit = 10) {
  const board = state.leaderboard[type];
  return Object.entries(board)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (b.points || b.count) - (a.points || a.count))
    .slice(0, limit);
}

function broadcastState() {
  io.emit('state:full', {
    stats: state.stats,
    isLive: state.isLive,
    tiktokUser: state.tiktokUser,
    config: state.config
  });
}

// ─────────────────────────────────────────────
//  API REST
// ─────────────────────────────────────────────

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TikShank v6.0',
    uptime: Math.floor((Date.now() - state.startTime) / 1000),
    live: state.isLive,
    user: state.tiktokUser
  });
});

// Estado completo
app.get('/api/state', (req, res) => {
  res.json({
    ...state.stats,
    isLive: state.isLive,
    tiktokUser: state.tiktokUser,
    config: state.config,
    uptime: Math.floor((Date.now() - state.startTime) / 1000)
  });
});

// Conectar a TikTok Live
app.post('/api/connect', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username requerido' });

  try {
    const result = await connectToTikTok(username.replace('@', '').trim());
    res.json({ success: true, message: `Conectado a @${username}`, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Desconectar
app.post('/api/disconnect', (req, res) => {
  if (tiktokConnection) {
    try { tiktokConnection.disconnect(); } catch(e) {}
    tiktokConnection = null;
  }
  state.isLive = false;
  state.tiktokUser = null;
  io.emit('tiktok:disconnected', { reason: 'manual' });
  res.json({ success: true, message: 'Desconectado' });
});

// Leaderboard
app.get('/api/leaderboard/:type', (req, res) => {
  const { type } = req.params;
  const limit = parseInt(req.query.limit) || 10;
  if (!['gifters', 'chatters'].includes(type)) {
    return res.status(400).json({ error: 'Tipo inválido. Usa: gifters, chatters' });
  }
  res.json(getLeaderboard(type, limit));
});

// Eventos recientes
app.get('/api/events', (req, res) => {
  const { type, limit = 50 } = req.query;
  let events = state.recentEvents;
  if (type) events = events.filter(e => e.type === type);
  res.json(events.slice(0, parseInt(limit)));
});

// Estadísticas
app.get('/api/stats', (req, res) => {
  res.json({
    ...state.stats,
    topGifter: getLeaderboard('gifters', 1)[0] || null,
    topChatter: getLeaderboard('chatters', 1)[0] || null,
    uptime: Math.floor((Date.now() - state.startTime) / 1000)
  });
});

// Resetear estadísticas
app.post('/api/reset', (req, res) => {
  Object.keys(state.stats).forEach(k => state.stats[k] = 0);
  state.leaderboard = { gifters: {}, chatters: {} };
  state.recentEvents = [];
  state.alerts = [];
  io.emit('state:reset');
  broadcastState();
  res.json({ success: true, message: 'Estadísticas reseteadas' });
});

// Actualizar config
app.post('/api/config', (req, res) => {
  const allowed = ['alertDuration','overlayTheme','minGiftAlert','followAlert','likeAlert','giftAlert','chatAlert'];
  allowed.forEach(key => {
    if (req.body[key] !== undefined) state.config[key] = req.body[key];
  });
  io.emit('config:update', state.config);
  res.json({ success: true, config: state.config });
});

// Test de alerta
app.post('/api/test-alert', (req, res) => {
  const type = req.body.type || 'gift';
  const testData = {
    gift:      { type: 'gift', user: 'test_user', nickname: 'TestUser', giftName: 'Rose', emoji: '🌹', totalCoins: 5, count: 5 },
    follow:    { type: 'follow', user: 'test_user', nickname: 'NuevoSeguidor' },
    subscribe: { type: 'subscribe', user: 'test_user', nickname: 'NuevoSub' },
    chat:      { type: 'chat', user: 'test_user', nickname: 'TestUser', comment: '¡Hola desde el test!' }
  };
  sendAlert(type, testData[type] || testData.gift);
  res.json({ success: true, message: `Alerta de prueba "${type}" enviada` });
});

// ─────────────────────────────────────────────
//  WebSocket (Socket.IO)
// ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔗 Cliente conectado: ${socket.id}`);

  // Enviar estado actual al conectarse
  socket.emit('state:full', {
    stats: state.stats,
    isLive: state.isLive,
    tiktokUser: state.tiktokUser,
    config: state.config,
    leaderboard: {
      gifters: getLeaderboard('gifters', 10),
      chatters: getLeaderboard('chatters', 10)
    },
    recentEvents: state.recentEvents.slice(0, 20)
  });

  socket.on('connect:tiktok', async (data) => {
    const { username } = data;
    try {
      await connectToTikTok(username);
    } catch(err) {
      socket.emit('tiktok:error', { message: err.message });
    }
  });

  socket.on('request:leaderboard', (data) => {
    const type = data?.type || 'gifters';
    socket.emit('leaderboard:update', {
      type,
      data: getLeaderboard(type, 10)
    });
  });

  socket.on('test:alert', (data) => {
    sendAlert(data.type || 'gift', { nickname: 'TestUser', giftName: 'Rose', emoji: '🌹', totalCoins: 1 });
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Cliente desconectado: ${socket.id}`);
  });
});

// ─────────────────────────────────────────────
//  Leaderboard broadcast periódico
// ─────────────────────────────────────────────
setInterval(() => {
  if (io.engine.clientsCount > 0) {
    io.emit('leaderboard:update', {
      gifters: getLeaderboard('gifters', 10),
      chatters: getLeaderboard('chatters', 10)
    });
  }
}, 5000);

// ─────────────────────────────────────────────
//  ✅ FIX #3: Arrancar servidor en 0.0.0.0
// ─────────────────────────────────────────────
const server = httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 TikShank Server v6.0 en puerto ${PORT}`);
  console.log(`🌐 Node: ${process.version}`);
  console.log(`📡 WebSocket: habilitado`);
  console.log(`⚙️  Entorno: ${process.env.NODE_ENV || 'development'}\n`);
});

// ─────────────────────────────────────────────
//  ✅ FIX #4: Manejo limpio de SIGTERM y SIGINT
// ─────────────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n⚠️  ${signal} recibido, cerrando servidor...`);

  // Desconectar TikTok
  if (tiktokConnection) {
    try { tiktokConnection.disconnect(); } catch(e) {}
  }

  // Notificar clientes WebSocket
  io.emit('server:shutdown');

  server.close(() => {
    console.log('✅ Servidor cerrado limpiamente');
    process.exit(0);
  });

  // Forzar salida si tarda más de 10s
  setTimeout(() => {
    console.error('❌ Forzando cierre...');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('❌ Excepción no capturada:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Promesa rechazada:', reason);
});
