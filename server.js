/**
 * TikShank Server v7.0
 * Optimizado para Render.com — alertas y overlays para TikTok Live
 */

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const path    = require('path');

const PORT = process.env.PORT || 8080;

const app        = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout:  60000,
  pingInterval: 25000,
  transports:   ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────
//  Estado global
// ─────────────────────────────────────────
const state = {
  startTime: Date.now(),
  tiktokUser: null,
  isLive: false,
  stats: {
    likes: 0, followers: 0, viewers: 0,
    gifts: 0, giftPoints: 0, comments: 0, shares: 0, subscribes: 0
  },
  leaderboard: { gifters: {}, chatters: {} },
  recentEvents: [],
  alerts: [],
  config: {
    alertDuration:  parseInt(process.env.ALERT_DURATION)  || 6000,
    overlayTheme:   process.env.OVERLAY_THEME   || 'dark',
    minGiftAlert:   parseInt(process.env.MIN_GIFT_ALERT)  || 1,
    followAlert:    process.env.FOLLOW_ALERT    !== 'false',
    likeAlert:      process.env.LIKE_ALERT      !== 'false',
    giftAlert:      process.env.GIFT_ALERT      !== 'false',
    chatAlert:      process.env.CHAT_ALERT      !== 'false',
    subscribeAlert: process.env.SUB_ALERT       !== 'false',
    shareAlert:     process.env.SHARE_ALERT     !== 'false',
  }
};

// Catálogo de regalos TikTok
const GIFT_CATALOG = {
  'Rose':          { coins: 1,     emoji: '🌹' },
  'TikTok':        { coins: 1,     emoji: '🎵' },
  'Finger Heart':  { coins: 5,     emoji: '🤙' },
  'Ice Cream':     { coins: 30,    emoji: '🍦' },
  'Cap':           { coins: 99,    emoji: '🧢' },
  'Perfume':       { coins: 20,    emoji: '🌸' },
  'Music Play':    { coins: 29,    emoji: '🎶' },
  'Birthday Cake': { coins: 169,   emoji: '🎂' },
  'Sunglasses':    { coins: 199,   emoji: '😎' },
  'Mic':           { coins: 199,   emoji: '🎤' },
  'Hand Heart':    { coins: 500,   emoji: '🫶' },
  'Corgi':         { coins: 899,   emoji: '🐕' },
  'Drama Queen':   { coins: 5000,  emoji: '👑' },
  'Universe':      { coins: 34999, emoji: '🌌' },
  'Lion':          { coins: 29999, emoji: '🦁' },
  'Love Bang':     { coins: 25000, emoji: '💥' },
};

// ─────────────────────────────────────────
//  TikTok Live Connector
// ─────────────────────────────────────────
let tiktokConnection = null;
let reconnectTimer   = null;
let reconnectAttempts = 0;
const MAX_RECONNECT  = 5;

async function connectToTikTok(username, isReconnect = false) {
  if (tiktokConnection) {
    try { tiktokConnection.disconnect(); } catch(e) {}
    tiktokConnection = null;
  }

  try {
    const { WebcastPushConnection } = require('tiktok-live-connector');

    tiktokConnection = new WebcastPushConnection(username, {
      processInitialData:       true,
      fetchRoomInfoOnConnect:   true,
      enableExtendedGiftInfo:   true,
      enableWebsocketUpgrade:   true,
      requestPollingIntervalMs: 2000,
      clientParams: {
        app_language:    'es-419',
        device_platform: 'web'
      }
    });

    const roomInfo = await tiktokConnection.connect();
    state.tiktokUser = username;
    state.isLive     = true;
    state.stats.viewers = roomInfo.userCount || 0;
    reconnectAttempts   = 0;

    console.log(`✅ Conectado a @${username} | Viewers: ${state.stats.viewers}`);
    io.emit('tiktok:connected', { username, roomInfo });
    broadcastState();

    // ── Chat ───────────────────────────────
    tiktokConnection.on('chat', (data) => {
      const event = buildEvent('chat', data, { comment: data.comment });
      state.stats.comments++;
      upsertChatter(data);
      addEvent(event);
      io.emit('event:chat', event);
      if (state.config.chatAlert) sendAlert('chat', event);
    });

    // ── Gift ───────────────────────────────
    tiktokConnection.on('gift', (data) => {
      if (data.giftType === 1 && !data.repeatEnd) return;
      const giftInfo  = GIFT_CATALOG[data.giftName] || { coins: data.diamondCount || 1, emoji: '🎁' };
      const totalCoins = giftInfo.coins * (data.repeatCount || 1);
      const event = buildEvent('gift', data, {
        giftName:  data.giftName,
        giftImage: data.giftPictureUrl,
        emoji:     giftInfo.emoji,
        coins:     giftInfo.coins,
        count:     data.repeatCount || 1,
        totalCoins
      });
      state.stats.gifts      += data.repeatCount || 1;
      state.stats.giftPoints += totalCoins;
      upsertGifter(data, totalCoins);
      addEvent(event);
      io.emit('event:gift', event);
      if (state.config.giftAlert && totalCoins >= state.config.minGiftAlert)
        sendAlert('gift', event);
    });

    // ── Follow ─────────────────────────────
    tiktokConnection.on('follow', (data) => {
      const event = buildEvent('follow', data);
      state.stats.followers++;
      addEvent(event);
      io.emit('event:follow', event);
      if (state.config.followAlert) sendAlert('follow', event);
    });

    // ── Like ───────────────────────────────
    tiktokConnection.on('like', (data) => {
      state.stats.likes += data.likeCount || 1;
      const event = buildEvent('like', data, {
        likeCount: data.likeCount,
        totalLikes: data.totalLikeCount
      });
      addEvent(event);
      io.emit('event:like', event);
      io.emit('stats:update', { likes: state.stats.likes });
    });

    // ── Share ──────────────────────────────
    tiktokConnection.on('share', (data) => {
      state.stats.shares++;
      const event = buildEvent('share', data);
      addEvent(event);
      io.emit('event:share', event);
      if (state.config.shareAlert) sendAlert('share', event);
    });

    // ── Viewers ────────────────────────────
    tiktokConnection.on('roomUser', (data) => {
      state.stats.viewers = data.viewerCount || 0;
      io.emit('stats:update', { viewers: state.stats.viewers });
    });

    // ── Subscribe ──────────────────────────
    tiktokConnection.on('subscribe', (data) => {
      state.stats.subscribes = (state.stats.subscribes || 0) + 1;
      const event = buildEvent('subscribe', data);
      addEvent(event);
      io.emit('event:subscribe', event);
      if (state.config.subscribeAlert) sendAlert('subscribe', event);
    });

    // ── Stream End ─────────────────────────
    tiktokConnection.on('streamEnd', () => {
      console.log(`⏹️  Stream de @${username} terminó`);
      state.isLive = false;
      io.emit('tiktok:disconnected', { reason: 'streamEnd' });
    });

    // ── Error ──────────────────────────────
    tiktokConnection.on('error', (err) => {
      console.error('❌ TikTok error:', err.message);
      io.emit('tiktok:error', { message: err.message });
    });

    // ── Disconnect ─────────────────────────
    tiktokConnection.on('disconnected', () => {
      console.log(`🔌 Desconectado de @${username}`);
      state.isLive = false;
      io.emit('tiktok:disconnected', { reason: 'disconnected' });

      // Auto-reconexión (máx 5 intentos)
      if (reconnectAttempts < MAX_RECONNECT) {
        reconnectAttempts++;
        const delay = reconnectAttempts * 5000;
        console.log(`🔄 Reconectando en ${delay/1000}s (intento ${reconnectAttempts}/${MAX_RECONNECT})`);
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => connectToTikTok(username, true), delay);
        io.emit('tiktok:reconnecting', { attempt: reconnectAttempts, delay });
      }
    });

    return { success: true, roomInfo };

  } catch (err) {
    console.error('❌ Error conectando a TikTok:', err.message);
    state.isLive = false;
    throw err;
  }
}

// ─────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────
function buildEvent(type, data, extra = {}) {
  return {
    type,
    id:        Date.now() + Math.random(),
    user:      data.uniqueId,
    nickname:  data.nickname,
    avatar:    data.profilePictureUrl || null,
    timestamp: new Date().toISOString(),
    ...extra
  };
}

function upsertGifter(data, totalCoins) {
  const g = state.leaderboard.gifters;
  if (!g[data.uniqueId])
    g[data.uniqueId] = { name: data.nickname, avatar: data.profilePictureUrl, points: 0, count: 0 };
  g[data.uniqueId].points += totalCoins;
  g[data.uniqueId].count  += data.repeatCount || 1;
  g[data.uniqueId].name    = data.nickname; // actualizar nombre
}

function upsertChatter(data) {
  const c = state.leaderboard.chatters;
  if (!c[data.uniqueId])
    c[data.uniqueId] = { name: data.nickname, count: 0 };
  c[data.uniqueId].count++;
  c[data.uniqueId].name = data.nickname;
}

function addEvent(event) {
  state.recentEvents.unshift(event);
  if (state.recentEvents.length > 150) state.recentEvents.pop();
}

function sendAlert(type, data) {
  const alert = { ...data, alertType: type, id: Date.now() + Math.random() };
  state.alerts.unshift(alert);
  if (state.alerts.length > 100) state.alerts.pop();
  io.emit('alert:new', alert);
}

function getLeaderboard(type = 'gifters', limit = 10) {
  const board = state.leaderboard[type] || {};
  return Object.entries(board)
    .map(([id, d]) => ({ id, ...d }))
    .sort((a, b) => (b.points || b.count) - (a.points || a.count))
    .slice(0, limit);
}

function broadcastState() {
  io.emit('state:full', {
    stats:      state.stats,
    isLive:     state.isLive,
    tiktokUser: state.tiktokUser,
    config:     state.config
  });
}

// ─────────────────────────────────────────
//  API REST
// ─────────────────────────────────────────

// Health check — Render lo necesita para saber que el servicio está vivo
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/state', (req, res) => {
  res.json({
    ...state.stats,
    isLive:     state.isLive,
    tiktokUser: state.tiktokUser,
    config:     state.config,
    uptime:     Math.floor((Date.now() - state.startTime) / 1000)
  });
});

app.post('/api/connect', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username requerido' });
  clearTimeout(reconnectTimer);
  reconnectAttempts = 0;
  try {
    const result = await connectToTikTok(username.replace('@', '').trim());
    res.json({ success: true, message: `Conectado a @${username}`, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/disconnect', (req, res) => {
  clearTimeout(reconnectTimer);
  reconnectAttempts = MAX_RECONNECT; // evitar auto-reconexión
  if (tiktokConnection) {
    try { tiktokConnection.disconnect(); } catch(e) {}
    tiktokConnection = null;
  }
  state.isLive     = false;
  state.tiktokUser = null;
  io.emit('tiktok:disconnected', { reason: 'manual' });
  res.json({ success: true });
});

app.get('/api/leaderboard/:type', (req, res) => {
  const { type } = req.params;
  if (!['gifters', 'chatters'].includes(type))
    return res.status(400).json({ error: 'Tipo inválido' });
  res.json(getLeaderboard(type, parseInt(req.query.limit) || 10));
});

app.get('/api/events', (req, res) => {
  const { type, limit = 50 } = req.query;
  let events = state.recentEvents;
  if (type) events = events.filter(e => e.type === type);
  res.json(events.slice(0, parseInt(limit)));
});

app.get('/api/stats', (req, res) => {
  res.json({
    ...state.stats,
    topGifter:  getLeaderboard('gifters', 1)[0]  || null,
    topChatter: getLeaderboard('chatters', 1)[0] || null,
    uptime:     Math.floor((Date.now() - state.startTime) / 1000)
  });
});

app.post('/api/reset', (req, res) => {
  Object.keys(state.stats).forEach(k => state.stats[k] = 0);
  state.leaderboard  = { gifters: {}, chatters: {} };
  state.recentEvents = [];
  state.alerts       = [];
  io.emit('state:reset');
  broadcastState();
  res.json({ success: true });
});

app.post('/api/config', (req, res) => {
  const allowed = ['alertDuration','overlayTheme','minGiftAlert',
    'followAlert','likeAlert','giftAlert','chatAlert','subscribeAlert','shareAlert'];
  allowed.forEach(k => { if (req.body[k] !== undefined) state.config[k] = req.body[k]; });
  io.emit('config:update', state.config);
  res.json({ success: true, config: state.config });
});

app.post('/api/test-alert', (req, res) => {
  const type = req.body.type || 'gift';
  const tests = {
    gift:      { type:'gift',      nickname:'TestUser',  giftName:'Rose',    emoji:'🌹', totalCoins:5, count:5 },
    follow:    { type:'follow',    nickname:'NuevoFan' },
    subscribe: { type:'subscribe', nickname:'NuevoSub' },
    chat:      { type:'chat',      nickname:'TestUser',  comment:'¡Hola desde el test! 🎵' },
    share:     { type:'share',     nickname:'ShareUser' },
  };
  sendAlert(type, tests[type] || tests.gift);
  res.json({ success: true });
});

// Rutas overlay (sirven HTML estático desde /public/overlay/)
app.get('/overlay/:name', (req, res) => {
  const file = path.join(__dirname, 'public', 'overlay', `${req.params.name}.html`);
  res.sendFile(file, err => {
    if (err) res.status(404).send('Overlay no encontrado');
  });
});

// ─────────────────────────────────────────
//  WebSocket
// ─────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔗 Cliente: ${socket.id}`);

  socket.emit('state:full', {
    stats:        state.stats,
    isLive:       state.isLive,
    tiktokUser:   state.tiktokUser,
    config:       state.config,
    leaderboard: {
      gifters:  getLeaderboard('gifters',  10),
      chatters: getLeaderboard('chatters', 10)
    },
    recentEvents: state.recentEvents.slice(0, 30)
  });

  socket.on('connect:tiktok', async ({ username }) => {
    try {
      clearTimeout(reconnectTimer);
      reconnectAttempts = 0;
      await connectToTikTok(username);
    } catch(err) {
      socket.emit('tiktok:error', { message: err.message });
    }
  });

  socket.on('request:leaderboard', (data) => {
    const type = data?.type || 'gifters';
    socket.emit('leaderboard:update', { type, data: getLeaderboard(type, 10) });
  });

  socket.on('test:alert', (data) => {
    sendAlert(data?.type || 'gift', { nickname: 'TestUser', giftName: 'Rose', emoji: '🌹', totalCoins: 1 });
  });

  socket.on('disconnect', () => console.log(`🔌 Desconectado: ${socket.id}`));
});

// Broadcast leaderboard cada 5s
setInterval(() => {
  if (io.engine.clientsCount > 0) {
    io.emit('leaderboard:update', {
      gifters:  getLeaderboard('gifters',  10),
      chatters: getLeaderboard('chatters', 10)
    });
  }
}, 5000);

// ─────────────────────────────────────────
//  Arranque
// ─────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 TikShank v7.0 — Puerto ${PORT}`);
  console.log(`🌐 Node: ${process.version}`);
  console.log(`📡 WebSocket: habilitado`);
  console.log(`☁️  Entorno: ${process.env.NODE_ENV || 'development'}\n`);
});

// Graceful shutdown
function shutdown(sig) {
  console.log(`\n⚠️  ${sig} — cerrando...`);
  clearTimeout(reconnectTimer);
  if (tiktokConnection) try { tiktokConnection.disconnect(); } catch(e) {}
  io.emit('server:shutdown');
  httpServer.close(() => { console.log('✅ Cerrado'); process.exit(0); });
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  err => console.error('❌ Excepción:', err));
process.on('unhandledRejection', r   => console.error('❌ Rechazo:',   r));
