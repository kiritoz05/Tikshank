/**
 * TikPanel Server v2 — Optimizado y Seguro
 * Railway deployment | Node.js >= 16
 * 
 * Variables de entorno requeridas en Railway:
 *   EL_KEY        → API Key de ElevenLabs
 *   ADMIN_SECRET  → Contraseña del panel admin
 *   ALLOWED_ORIGIN → URL de tu Vercel (ej: https://tikshank.vercel.app)
 *   SESSION_SECRET → String aleatorio largo para JWT
 */

"use strict";

const { WebcastPushConnection } = require("tiktok-live-connector");
const express  = require("express");
const http     = require("http");
const https    = require("https");
const { Server } = require("socket.io");
const cors     = require("cors");
const jwt      = require("jsonwebtoken");
const bcrypt   = require("bcryptjs");
const rateLimit = require("express-rate-limit");

// ── Env vars con defaults seguros ────────────────────────────────────────────
const PORT           = process.env.PORT           || 3001;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const SESSION_SECRET = process.env.SESSION_SECRET || "CAMBIA_ESTO_EN_RAILWAY";
const ADMIN_SECRET   = process.env.ADMIN_SECRET   || "tikadmin2026";
const EL_KEY         = process.env.EL_KEY         || "";

if (!process.env.SESSION_SECRET) console.warn("⚠️  SESSION_SECRET no configurado — usa variable de entorno en Railway!");
if (!process.env.EL_KEY)         console.warn("⚠️  EL_KEY no configurado — TTS ElevenLabs desactivado");

// ── Express + Socket.io ───────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ["GET","POST"] },
  pingInterval: 10000,
  pingTimeout:  5000,
  connectTimeout: 15000,
  maxHttpBufferSize: 1e5, // 100KB max por mensaje
});

// ── Middlewares de seguridad ──────────────────────────────────────────────────
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: "20kb" })); // Límite de payload

// Rate limiting — previene abuso de endpoints
const limiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minuto
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes, espera un momento" }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: { error: "Demasiados intentos de login" }
});

app.use(limiter);

// Headers de seguridad básicos
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

// ── Base de usuarios en memoria (en producción usar MongoDB/Postgres) ─────────
// Contraseñas hasheadas con bcrypt
const USERS_DB = {
  "admin@tikpanel.com":  { id:1, name:"Admin",       avatar:"A", plan:"admin", active:true, expiry:null,         passwordHash: bcrypt.hashSync(ADMIN_SECRET, 10) },
  "luzalva@tikpanel.com":{ id:2, name:"Luz Álva",    avatar:"L", plan:"pro",   active:true, expiry:"2026-08-15", passwordHash: bcrypt.hashSync("luz2024", 10) },
  "usuario@tikpanel.com":{ id:3, name:"Streamer123", avatar:"S", plan:"free",  active:true, expiry:null,         passwordHash: bcrypt.hashSync("pass123", 10) },
};

// Límites por plan
const PLAN_LIMITS = {
  free:  { acciones: 5,  ttsRequests: 0,  label:"Free"  },
  trial: { acciones: 15, ttsRequests: 50, label:"Trial" },
  pro:   { acciones: -1, ttsRequests: -1, label:"Pro"   },
  admin: { acciones: -1, ttsRequests: -1, label:"Admin" },
};

// Herramientas por plan
const TOOLS_BY_PLAN = {
  free:  { tts:false, musica:false, ranking:true,  batalla:false, chat:true,  espect:false },
  trial: { tts:true,  musica:false, ranking:true,  batalla:false, chat:true,  espect:false },
  pro:   { tts:true,  musica:true,  ranking:true,  batalla:true,  chat:true,  espect:true  },
  admin: { tts:true,  musica:true,  ranking:true,  batalla:true,  chat:true,  espect:true  },
};

// ── JWT helpers ───────────────────────────────────────────────────────────────
function signToken(payload) {
  return jwt.sign(payload, SESSION_SECRET, { expiresIn: "7d" });
}
function verifyToken(token) {
  try { return jwt.verify(token, SESSION_SECRET); }
  catch(e) { return null; }
}
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error:"No autorizado" });
  const user = Object.values(USERS_DB).find(u => u.id === payload.id);
  if (!user || !user.active) return res.status(403).json({ error:"Cuenta inactiva o no encontrada" });
  req.user = { ...user, email: Object.keys(USERS_DB).find(k => USERS_DB[k].id === user.id) };
  next();
}
function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.plan !== "admin") return res.status(403).json({ error:"Requiere plan Admin" });
    next();
  });
}

// ── Auth endpoints ────────────────────────────────────────────────────────────
app.post("/auth/login", authLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error:"Email y contraseña requeridos" });

  const user = USERS_DB[email.toLowerCase().trim()];
  if (!user) return res.status(401).json({ error:"Credenciales inválidas" });
  if (!user.active) return res.status(403).json({ error:"Cuenta bloqueada" });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error:"Credenciales inválidas" });

  // Verificar expiración del plan
  if (user.expiry && new Date(user.expiry) < new Date()) {
    // Degradar a free automáticamente
    user.plan = "free";
    console.log(`[auth] Plan de ${email} expirado → degradado a free`);
  }

  const token = signToken({ id: user.id, plan: user.plan });
  const tools = TOOLS_BY_PLAN[user.plan] || TOOLS_BY_PLAN.free;
  const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;

  res.json({
    token,
    user: {
      id:     user.id,
      name:   user.name,
      avatar: user.avatar,
      plan:   user.plan,
      email:  email,
      tools,
      limits,
    }
  });
});

app.get("/auth/me", authMiddleware, (req, res) => {
  const { passwordHash, ...safe } = req.user;
  const tools  = TOOLS_BY_PLAN[safe.plan] || TOOLS_BY_PLAN.free;
  const limits = PLAN_LIMITS[safe.plan]   || PLAN_LIMITS.free;
  res.json({ user: { ...safe, tools, limits } });
});

// ── TTS proxy (protege la API key de ElevenLabs) ──────────────────────────────
app.post("/api/tts", authMiddleware, async (req, res) => {
  if (!req.user.tools?.tts && req.user.plan !== "admin") {
    return res.status(403).json({ error:"TTS requiere plan Pro" });
  }
  if (!EL_KEY) return res.status(503).json({ error:"TTS no configurado en el servidor" });

  const { text, voiceId } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error:"Texto requerido" });
  if (text.length > 500) return res.status(400).json({ error:"Texto demasiado largo (máx 500 chars)" });

  try {
    const response = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        text: text.trim(),
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      });
      const options = {
        hostname: "api.elevenlabs.io",
        path: `/v1/text-to-speech/${voiceId || "21m00Tcm4TlvDq8ikWAM"}`,
        method: "POST",
        headers: {
          "xi-api-key": EL_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
          "Content-Length": Buffer.byteLength(body),
        }
      };
      const req2 = https.request(options, (r) => {
        const chunks = [];
        r.on("data", c => chunks.push(c));
        r.on("end", () => resolve({ status: r.statusCode, buffer: Buffer.concat(chunks) }));
      });
      req2.on("error", reject);
      req2.setTimeout(12000, () => { req2.destroy(); reject(new Error("timeout")); });
      req2.write(body);
      req2.end();
    });

    if (response.status !== 200) {
      return res.status(502).json({ error:"ElevenLabs error: " + response.status });
    }
    res.set("Content-Type", "audio/mpeg");
    res.set("Content-Length", response.buffer.length);
    res.send(response.buffer);
  } catch(e) {
    console.error("[tts]", e.message);
    res.status(500).json({ error:"Error generando audio" });
  }
});

// ── TTS: listar voces disponibles ────────────────────────────────────────────
app.get("/api/tts/voices", authMiddleware, async (req, res) => {
  if (!EL_KEY) return res.json({ voices: [] });
  try {
    const r = await new Promise((resolve, reject) => {
      const options = {
        hostname: "api.elevenlabs.io",
        path: "/v1/voices",
        method: "GET",
        headers: { "xi-api-key": EL_KEY }
      };
      const req2 = https.request(options, (r2) => {
        let data = "";
        r2.on("data", c => data += c);
        r2.on("end", () => resolve({ status: r2.statusCode, data }));
      });
      req2.on("error", reject);
      req2.setTimeout(8000, () => { req2.destroy(); reject(new Error("timeout")); });
      req2.end();
    });
    if (r.status !== 200) return res.json({ voices: [] });
    res.json(JSON.parse(r.data));
  } catch(e) {
    res.json({ voices: [] });
  }
});

// ── Admin: listar usuarios ────────────────────────────────────────────────────
app.get("/admin/users", adminMiddleware, (req, res) => {
  const users = Object.entries(USERS_DB).map(([email, u]) => ({
    id: u.id, email, name: u.name, avatar: u.avatar,
    plan: u.plan, active: u.active, expiry: u.expiry,
    tools: TOOLS_BY_PLAN[u.plan],
    limits: PLAN_LIMITS[u.plan],
  }));
  res.json({ users });
});

app.post("/admin/users/:id/plan", adminMiddleware, (req, res) => {
  const id   = Number(req.params.id);
  const { plan, expiry } = req.body || {};
  if (!PLAN_LIMITS[plan]) return res.status(400).json({ error:"Plan inválido" });
  const entry = Object.values(USERS_DB).find(u => u.id === id);
  if (!entry) return res.status(404).json({ error:"Usuario no encontrado" });
  entry.plan   = plan;
  entry.expiry = expiry || null;
  res.json({ success:true });
});

app.post("/admin/users/:id/toggle", adminMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const entry = Object.values(USERS_DB).find(u => u.id === id);
  if (!entry) return res.status(404).json({ error:"Usuario no encontrado" });
  entry.active = !entry.active;
  res.json({ success:true, active: entry.active });
});

// ── TikTok LIVE sessions ───────────────────────────────────────────────────────
const sessions  = {};
const userMap   = {};
const pendingResolve = new Set();
const peakPoints = {};

function fetchUrl(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const timeout = opts.timeout || 8000;
    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "application/json, text/html",
        "Accept-Language": "es-MX,es;q=0.9",
        ...(opts.headers || {}),
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: () => Promise.resolve(data) }));
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function registerUser(data) {
  if (!data) return;
  const uid      = String(data.userId || data.id || "");
  const uniqueId = data.uniqueId || data.displayId || "";
  const nickname = data.nickname || data.displayName || data.name || "";
  if (uid && (uniqueId || nickname)) {
    userMap[uid] = { uniqueId: uniqueId || userMap[uid]?.uniqueId || "", nickname: nickname || userMap[uid]?.nickname || "" };
  }
  if (uniqueId) userMap[uniqueId] = userMap[uid] || { uniqueId, nickname };
}

async function resolveUserId(numericId, emitCb) {
  if (!numericId || userMap[numericId]?.uniqueId) return;
  if (pendingResolve.has(numericId)) return;
  pendingResolve.add(numericId);
  try {
    const res = await fetchUrl(`https://www.tiktok.com/@id:${numericId}`, { timeout:8000 });
    if (res.ok) {
      const text = await res.text();
      for (const pat of [/"uniqueId":"([^"]{2,50})"/, /"unique_id":"([^"]{2,50})"/]) {
        const m = text.match(pat);
        if (m && m[1] && !/^\d+$/.test(m[1])) {
          const uniqueId = m[1];
          const nm = text.match(/"nickname":"([^"]+)"/);
          userMap[numericId] = { uniqueId, nickname: nm?.[1] || uniqueId };
          userMap[uniqueId]  = userMap[numericId];
          pendingResolve.delete(numericId);
          emitCb?.(numericId, uniqueId, nm?.[1] || uniqueId);
          return;
        }
      }
    }
  } catch(e) { /* silent */ }
  pendingResolve.delete(numericId);
}

function getSessionRecord(username) {
  if (!username) return null;
  const raw = String(username).trim();
  if (sessions[raw]) return sessions[raw];
  const norm = raw.replace(/^@/,"").toLowerCase();
  for (const k of Object.keys(sessions)) {
    if (String(k).replace(/^@/,"").toLowerCase() === norm) return sessions[k];
  }
  return null;
}

function cleanSession(username) {
  if (!sessions[username]) return;
  clearTimeout(sessions[username].retryTimer);
  try { sessions[username].tiktok?.disconnect(); } catch(e) {}
  delete sessions[username];
}

function extractPoints(obj) {
  if (!obj) return 0;
  for (const v of [obj.points,obj.teamPoints,obj.score,obj.battleScore,obj.point,obj.totalScore,obj.totalPoints,obj.armyScore]) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function resetPeakPoints() { Object.keys(peakPoints).forEach(k => delete peakPoints[k]); }

function applyPeakPoints(teams) {
  return teams.map(t => {
    const key = t.hostName || t.userId;
    const prev = peakPoints[key] || 0;
    const cur  = Math.max(prev, t.points || 0);
    peakPoints[key] = cur;
    return { ...t, points: cur };
  });
}

function resolveArmyUser(u, fallbackIdx) {
  const uid  = (u.uniqueId || u.displayId || String(u.userId||u.id||"")).trim();
  const nn   = (u.nickname || u.displayName || u.name || uid).trim();
  const uid2 = String(u.userId||u.id||"");
  const resolved = (/^\d{8,}$/.test(uid) && userMap[uid]) ? userMap[uid] : (uid2 && userMap[uid2]) ? userMap[uid2] : null;
  return {
    hostName:     resolved?.uniqueId || (uid && !/^\d{8,}$/.test(uid) ? uid : (uid2 || "player_"+fallbackIdx)),
    hostNickname: resolved?.nickname  || nn || uid,
    userId:       uid2,
  };
}

function extractTeams(data) {
  const armies = data.battleArmies || data.linkMicBattleInfo?.battleArmies || [];
  if (armies.length > 0) {
    const result = [];
    armies.forEach((army, idx) => {
      const teamIdx = army.armyType ?? army.teamId ?? idx;
      const parts   = (army.participants||[]).filter(Boolean);
      if (parts.length > 1) {
        parts.forEach((p,pi) => {
          const info = resolveArmyUser(p, `${idx}_${pi}`);
          if (info.hostName && info.hostName !== "?") result.push({ ...info, points: extractPoints(p), teamIdx });
        });
        return;
      }
      const host = army.hostUser || {};
      const info = resolveArmyUser({ uniqueId: host.uniqueId||String(army.hostUserId||""), nickname: host.nickname||"", userId: host.userId||army.hostUserId||"" }, idx);
      let points = extractPoints(army);
      if (!points && parts[0]) points = extractPoints(parts[0]);
      if (!points && army.hostUser) points = extractPoints(army.hostUser);
      if (info.hostName && info.hostName !== "?") result.push({ ...info, points, teamIdx });
    });
    return result;
  }
  return (data.battleUsers||data.participants||[]).map((u,i) => ({
    hostName: u.uniqueId || String(u.userId||i),
    hostNickname: u.nickname || u.uniqueId || "",
    userId: String(u.userId||u.id||""),
    points: extractPoints(u),
    teamIdx: i % 2,
  })).filter(t => t.hostName);
}

// ── Socket.io auth middleware ─────────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error("Token requerido"));
  const payload = verifyToken(token);
  if (!payload) return next(new Error("Token inválido"));
  const user = Object.values(USERS_DB).find(u => u.id === payload.id);
  if (!user || !user.active) return next(new Error("Cuenta inactiva"));
  socket.user = user;
  next();
});

async function startTikTokConnection(username, sessionId, ownerUsername) {
  const opts = {
    processInitialData: false,
    enableExtendedGiftInfo: true,
    enableWebsocketUpgrade: false,      // ← Desactivado: TikTok ya no soporta WS upgrade sin sessionId
    requestPollingIntervalMs: 1500,     // ← Polling cada 1.5s
    ...(sessionId ? { sessionId } : {}),// ← Solo incluir sessionId si existe
  };

  const tiktok = new WebcastPushConnection(username, opts);
  const activeUsersMap = new Map();

  sessions[username] = { tiktok, ownerUsername: ownerUsername||username, lastBattle:null, retryTimer:null };

  await tiktok.connect();
  console.log(`✅ Conectado a @${username}`);

  tiktok.on("gift", (data) => {
    registerUser(data);
    io.emit("event", { type:"gift", user:data.uniqueId, nickname:data.nickname||data.uniqueId, giftName:data.giftName||"", giftId:data.giftId, diamondCount:data.diamondCount||0, repeatCount:data.repeatCount||1, img:data.giftPictureUrl||"", timestamp:Date.now() });

    const lastBattle = sessions[username]?.lastBattle;
    if (!lastBattle) return;
    const diamonds = Number(data.diamondCount||0) * Number(data.repeatCount||1);
    if (diamonds <= 0) return;
    const key = ownerUsername||username;
    peakPoints[key] = (peakPoints[key]||0) + diamonds;
    const updated = { ...lastBattle, teams: applyPeakPoints(lastBattle.teams), timestamp:Date.now() };
    sessions[username].lastBattle = updated;
    io.emit("battle", updated);
  });

  tiktok.on("chat",     (d) => { registerUser(d); io.emit("event", { type:"chat",   user:d.uniqueId, nickname:d.nickname||d.uniqueId, comment:d.comment, timestamp:Date.now() }); });
  tiktok.on("follow",   (d) => { registerUser(d); io.emit("event", { type:"follow", user:d.uniqueId, nickname:d.nickname||d.uniqueId, timestamp:Date.now() }); });
  tiktok.on("like",     (d) => { registerUser(d); io.emit("event", { type:"like",   user:d.uniqueId, nickname:d.nickname||d.uniqueId, likeCount:d.likeCount||1, timestamp:Date.now() }); });
  tiktok.on("subscribe",(d) => {                  io.emit("event", { type:"sub",    user:d.uniqueId, nickname:d.nickname||d.uniqueId, timestamp:Date.now() }); });
  tiktok.on("share",    (d) => {                  io.emit("event", { type:"share",  user:d.uniqueId, nickname:d.nickname||d.uniqueId, timestamp:Date.now() }); });

  tiktok.on("roomUser", (data) => {
    if (Array.isArray(data.topViewers)) {
      data.topViewers.forEach(v => {
        registerUser(v.user||v);
        const u = v.user||v;
        const uid = u.uniqueId||u.displayId||"";
        if (uid) activeUsersMap.set(uid, { user:uid, nickname:u.nickname||uid, viewers:v.memberCount||0, joinTime: activeUsersMap.get(uid)?.joinTime||Date.now() });
      });
    }
    io.emit("viewers", { count:data.viewerCount||0, topViewers:[...activeUsersMap.values()].sort((a,b)=>b.viewers-a.viewers) });
  });

  tiktok.on("member", (d) => {
    registerUser(d);
    io.emit("member", { user:d.uniqueId||"", nickname:d.nickname||d.uniqueId||"", timestamp:Date.now() });
  });

  const emitUpdatedBattle = (ownerName, lastTeams, status) => (resolvedId, uniqueId, nickname) => {
    const updated = lastTeams.map(t => (String(t.userId)===String(resolvedId)||t.hostName===resolvedId) ? { ...t, hostName:uniqueId, hostNickname:nickname } : t);
    const payload  = { status, teams:updated, ownerUsername:ownerName, timestamp:Date.now() };
    if (sessions[username]) sessions[username].lastBattle = status===0 ? null : payload;
    io.emit("battle", payload);
  };

  tiktok.on("linkMicBattle", (data) => {
    if (Array.isArray(data.battleUsers)) data.battleUsers.forEach(u => registerUser(u));
    const status = data.battleStatus !== undefined ? Number(data.battleStatus) : 1;
    if (status === 0) {
      resetPeakPoints();
      if (sessions[username]) sessions[username].lastBattle = null;
      io.emit("battle", { status:0, teams:[], ownerUsername:ownerUsername||username, timestamp:Date.now() });
      return;
    }
    resetPeakPoints();
    const teams   = applyPeakPoints(extractTeams(data));
    const payload = { status, teams, ownerUsername:ownerUsername||username, timestamp:Date.now() };
    if (sessions[username]) sessions[username].lastBattle = payload;
    io.emit("battle", payload);
    const cb = emitUpdatedBattle(ownerUsername||username, teams, status);
    teams.forEach(t => { if (/^\d{8,}$/.test(t.hostName)) resolveUserId(t.hostName, cb); });
  });

  tiktok.on("linkMicArmies", (data) => {
    const rawTeams = extractTeams(data);
    if (!rawTeams.length) return;
    const teams   = applyPeakPoints(rawTeams);
    const payload = { status:1, teams, ownerUsername:ownerUsername||username, timestamp:Date.now() };
    if (sessions[username]) sessions[username].lastBattle = payload;
    io.emit("battle", payload);
    io.emit("battle_internal", payload);
    const cb = emitUpdatedBattle(ownerUsername||username, teams, 1);
    teams.forEach(t => { if (/^\d{8,}$/.test(t.hostName)) resolveUserId(t.hostName, cb); });
  });

  tiktok.on("disconnected", () => {
    console.log(`❌ Desconectado de @${username}`);
    if (sessions[username]) delete sessions[username].tiktok;
    io.emit("tiktok_disconnected", { username });
  });

  tiktok.on("error", (err) => {
    console.error(`Error @${username}:`, err.message);
    io.emit("tiktok_error", { username, message:err.message });
  });

  return tiktok;
}

// ── REST endpoints ────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.json({ status:"TikPanel Server ✅ v2", connections:Object.keys(sessions).length }));

app.get("/status/:username", authMiddleware, (req, res) => {
  const s = getSessionRecord(req.params.username);
  res.json({ connected:!!s?.tiktok, battle:s?.lastBattle||null });
});

app.get("/battle/:username", authMiddleware, (req, res) => {
  const s = getSessionRecord(req.params.username);
  res.json(s?.lastBattle || { status:0, teams:[], timestamp:Date.now() });
});

app.get("/battle-stream/:username", authMiddleware, (req, res) => {
  res.setHeader("Content-Type","text/event-stream");
  res.setHeader("Cache-Control","no-cache");
  res.setHeader("Connection","keep-alive");
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.flushHeaders();

  const username = req.params.username;
  const sendData = (d) => res.write(`data: ${JSON.stringify(d)}\n\n`);
  const s = getSessionRecord(username);
  sendData(s?.lastBattle || { status:0, teams:[], timestamp:Date.now() });

  const onBattle = (payload) => {
    const own = getSessionRecord(username);
    if (own && payload.ownerUsername === own.ownerUsername) sendData(payload);
  };
  io.on("battle_internal", onBattle);
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => { clearInterval(ping); io.off("battle_internal", onBattle); });
});

app.post("/connect", authMiddleware, async (req, res) => {
  const { username, sessionId } = req.body || {};
  if (!username) return res.status(400).json({ error:"Username requerido" });

  // Sanitizar username
  const clean = String(username).replace(/[^a-zA-Z0-9._]/g,"").slice(0,50);
  if (!clean) return res.status(400).json({ error:"Username inválido" });

  cleanSession(clean);
  try {
    await startTikTokConnection(clean, sessionId || null, req.user.name);
    return res.json({ success:true, message:`Conectado a @${clean}` });
  } catch(err) {
    const msg = err.message || "Error desconocido";
    console.warn(`Conexión fallida para @${clean}: ${msg}`);
    // Si el error es de websocket upgrade, dar mensaje claro
    if (msg.includes("websocket upgrade") || msg.includes("sessionId")) {
      return res.status(500).json({ error: "¿Estás en LIVE? Si tu cuenta es privada, ingresa tu Session ID." });
    }
    res.status(500).json({ error: msg || "No se pudo conectar. ¿Estás en LIVE?" });
  }
});

app.post("/disconnect", authMiddleware, (req, res) => {
  const { username } = req.body || {};
  if (username) cleanSession(String(username).replace(/[^a-zA-Z0-9._]/g,"").slice(0,50));
  res.json({ success:true });
});

// ── Socket.io events ──────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`Socket conectado: user#${socket.user?.id}`);
  socket.on("disconnect", () => console.log(`Socket desconectado: user#${socket.user?.id}`));
});

// ── Arranque ──────────────────────────────────────────────────────────────────
server.listen(PORT, () => console.log(`🚀 TikPanel Server v2 en puerto ${PORT}`));
