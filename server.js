const { WebcastPushConnection } = require("tiktok-live-connector");
const express = require("express");
const http = require("http");
const https = require("https");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingInterval: 10000,
  pingTimeout: 5000,
  connectTimeout: 15000,
});

app.use(cors());
app.use(express.json());

const sessions = {};

// ── Helper: fetch con https nativo ────────────────────────────────────────────
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
      res.on("end", () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text: () => Promise.resolve(data), json: () => Promise.resolve(JSON.parse(data)) }));
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

// ── Mapa global userId -> {uniqueId, nickname} ─────────────────────────────
const userMap = {};
function registerUser(data) {
  if (!data) return;
  const uid      = String(data.userId || data.id || "");
  const uniqueId = data.uniqueId || data.displayId || "";
  const nickname = data.nickname || data.displayName || data.name || "";
  if (uid && (uniqueId || nickname)) {
    userMap[uid] = {
      uniqueId: uniqueId || userMap[uid]?.uniqueId || "",
      nickname: nickname || userMap[uid]?.nickname  || "",
    };
  }
  if (uniqueId) userMap[uniqueId] = userMap[uid] || { uniqueId, nickname };
}

// ── Resolver userId numérico → uniqueId ─────────────────────────────────────
const pendingResolve = new Set();

async function resolveUserId(numericId, emitCallback) {
  if (!numericId || userMap[numericId]?.uniqueId) return;
  if (pendingResolve.has(numericId)) return;
  pendingResolve.add(numericId);

  console.log(`[resolve] Buscando username para userId: ${numericId}`);

  try {
    const res = await fetchUrl(`https://www.tiktok.com/@id:${numericId}`, { timeout: 8000 });
    if (res.ok) {
      const text = await res.text();
      const patterns = [/"uniqueId":"([^"]{2,50})"/, /"unique_id":"([^"]{2,50})"/];
      for (const pat of patterns) {
        const m = text.match(pat);
        if (m && m[1] && !/^\d+$/.test(m[1])) {
          const uniqueId = m[1];
          const nm = text.match(/"nickname":"([^"]+)"/);
          const nickname = nm ? nm[1] : uniqueId;
          console.log(`[resolve] ✅ Método web: ${numericId} → @${uniqueId}`);
          userMap[numericId] = { uniqueId, nickname };
          userMap[uniqueId]  = { uniqueId, nickname };
          pendingResolve.delete(numericId);
          if (emitCallback) emitCallback(numericId, uniqueId, nickname);
          return;
        }
      }
    }
  } catch(e) { console.log("[resolve] Método web falló:", e.message); }

  try {
    const conn = new WebcastPushConnection(numericId, {
      processInitialData: true,
      enableExtendedGiftInfo: false,
      requestPollingIntervalMs: 99999,
    });
    const connectResult = await Promise.race([
      conn.connect(),
      new Promise((_,rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
    ]);
    const roomInfo = connectResult?.roomInfo || connectResult?.room_info || {};
    const owner    = roomInfo.owner || roomInfo.host || {};
    const uniqueId = owner.uniqueId || owner.displayId || owner.unique_id || "";
    const nickname = owner.nickname || owner.display_name || uniqueId;
    try { conn.disconnect(); } catch(e) {}

    if (uniqueId) {
      console.log(`[resolve] ✅ Método live: ${numericId} → @${uniqueId}`);
      userMap[numericId] = { uniqueId, nickname };
      userMap[uniqueId]  = { uniqueId, nickname };
      pendingResolve.delete(numericId);
      if (emitCallback) emitCallback(numericId, uniqueId, nickname);
      return;
    }
  } catch(e) { console.log("[resolve] Método live falló:", e.message); }

  console.log(`[resolve] ❌ No se pudo resolver ${numericId}`);
  pendingResolve.delete(numericId);
}

function getSessionRecord(username) {
  const raw = String(username || '').trim();
  if (!raw) return null;
  if (sessions[raw]) return sessions[raw];
  const normalized = raw.replace(/^@/, '').toLowerCase();
  for (const key of Object.keys(sessions)) {
    if (String(key || '').replace(/^@/, '').toLowerCase() === normalized) return sessions[key];
  }
  return null;
}

function cleanSession(username) {
  if (sessions[username]) {
    clearTimeout(sessions[username].retryTimer);
    try { sessions[username].tiktok.disconnect(); } catch (e) {}
    delete sessions[username];
  }
}

function resolveNameFromMap(userId) {
  if (!userId) return null;
  const key = String(userId);
  const mapped = userMap[key];
  if (mapped && mapped.uniqueId && !/^\d{8,}$/.test(mapped.uniqueId)) {
    return { uniqueId: mapped.uniqueId, nickname: mapped.nickname || mapped.uniqueId };
  }
  return null;
}

// ── Extrae puntos de un army/participant de TikTok ─────────────────────────
function extractPoints(obj) {
  if (!obj) return 0;
  const fields = [
    obj.points, obj.teamPoints, obj.score, obj.battleScore,
    obj.point,  obj.totalScore, obj.totalPoints, obj.teamScore,
    obj.armyScore, obj.matchScore, obj.groupScore, obj.displayScore,
    obj.voteCount, obj.coinCount
  ];
  for (const v of fields) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

// ── Extrae teams del payload de batalla ────────────────────────────────────
function extractTeams(data) {
  const armies = data.battleArmies || (data.linkMicBattleInfo && data.linkMicBattleInfo.battleArmies) || [];

  if (armies.length > 0) {
    return armies.map(function(army, idx) {
      var host     = army.hostUser || {};
      var uid      = host.uniqueId || host.displayId || String(army.hostUserId || "");
      var nn       = host.nickname || host.displayName || uid;
      var userId   = String(host.userId || host.id || army.hostUserId || "");
      // Intentar resolver ID numérico desde userMap ya poblado
      var resolved = (uid && /^\d{8,}$/.test(uid) && userMap[uid]) ? userMap[uid]
                   : (userId && userMap[userId]) ? userMap[userId]
                   : null;
      var hostName     = resolved?.uniqueId || (uid && !/^\d{8,}$/.test(uid) ? uid : (userId || ("player_" + idx)));
      var hostNickname = resolved?.nickname  || nn || hostName;

      // Puntos directos del army
      var points = extractPoints(army);

      // Sumar participantes si no hay puntos directos
      if (points === 0 && Array.isArray(army.participants) && army.participants.length > 0) {
        points = army.participants.reduce(function(sum, p) {
          return sum + extractPoints(p);
        }, 0);
      }

      // Intentar hostUser como último recurso
      if (points === 0 && army.hostUser) {
        points = extractPoints(army.hostUser);
      }

      var teamIdx = army.armyType !== undefined ? Number(army.armyType)
                  : army.teamId  !== undefined ? Number(army.teamId)
                  : idx;

      return { hostName, hostNickname, userId, points, teamIdx };
    }).filter(function(t) { return t.hostName && t.hostName !== "?"; });
  }

  // Fallback: battleUsers
  var users = data.battleUsers || data.participants || [];
  return users.map(function(u, i) {
    return {
      hostName:     u.uniqueId || u.displayId || String(u.userId || i),
      hostNickname: u.nickname || u.displayName || u.uniqueId || "",
      userId:       String(u.userId || u.id || ""),
      points:       extractPoints(u),
      teamIdx:      i % 2,
    };
  }).filter(function(t) { return t.hostName; });
}

// ── Emitir batalla actualizada cuando se resuelva un ID ───────────────────
function emitUpdatedBattle(username, ownerUsername, lastTeams, status) {
  return function(resolvedUserId, uniqueId, nickname) {
    const updated = lastTeams.map(t => {
      if (String(t.userId) === String(resolvedUserId) || t.hostName === resolvedUserId) {
        return { ...t, hostName: uniqueId, hostNickname: nickname };
      }
      return t;
    });
    const payload = { status, teams: updated, ownerUsername, timestamp: Date.now() };
    if (sessions[username]) sessions[username].lastBattle = status === 0 ? null : payload;
    io.emit("battle", payload);
    console.log(`[battle-update] Re-emitido con @${uniqueId} resuelto`);
  };
}

async function startTikTokConnection(username, sessionId) {
  const opts = {
    processInitialData: false,
    enableExtendedGiftInfo: true,
    enableWebsocketUpgrade: true,
    requestPollingIntervalMs: 2000,
  };
  if (sessionId && sessionId.trim()) {
    opts.sessionId = sessionId.trim();
  }
  const tiktok = new WebcastPushConnection(username, opts);

  await tiktok.connect();
  const ownerUsername = username.replace(/^@/, "").toLowerCase();
  sessions[username]  = { tiktok, retryTimer: null, ownerUsername, lastBattle: null };
  console.log(`✅ Conectado a @${username}`);

  const activeUsersMap = new Map();

  // ── ACUMULADOR PERSISTENTE DE PUNTOS DE BATALLA ───────────────────────────
  // Clave: userId o hostName del jugador
  // Valor: máximo de puntos vistos (nunca baja, solo sube)
  // Esto soluciona que TikTok a veces manda 0 aunque ya había puntos antes.
  const peakPoints = {};  // { key: maxPoints }

  function applyPeakPoints(teams) {
    return teams.map(t => {
      const key = t.userId || t.hostName;
      const prev = peakPoints[key] || 0;
      const cur  = t.points || 0;
      const best = Math.max(prev, cur);
      if (best > 0) peakPoints[key] = best;
      return { ...t, points: best };
    });
  }

  function resetPeakPoints() {
    Object.keys(peakPoints).forEach(k => delete peakPoints[k]);
  }

  // ── EVENTO GIFT: Acumular diamantes al equipo del owner ───────────────────
  tiktok.on("gift", (data) => {
    registerUser(data);
    if (data.giftType === 1 && !data.repeatEnd) return; // combo sin terminar
    io.emit("event", { type:"gift", user:data.uniqueId, nickname:data.nickname||data.uniqueId, giftName:data.giftName||"", giftId:data.giftId||0, giftCount:data.repeatCount||1, diamondCount:data.diamondCount||0, timestamp:Date.now() });

    // Si hay batalla activa, acumular diamantes recibidos como puntos del owner
    const lastBattle = sessions[username]?.lastBattle;
    if (!lastBattle) return;
    const diamonds = Number(data.diamondCount || 0) * Number(data.repeatCount || 1);
    if (diamonds <= 0) return;
    const ownerKey = ownerUsername;
    const prev = peakPoints[ownerKey] || 0;
    peakPoints[ownerKey] = prev + diamonds;
    console.log(`[gift→battle] +${diamonds} para ${ownerKey} → total=${peakPoints[ownerKey]}`);

    // Re-emitir batalla con puntos actualizados
    const updatedTeams = applyPeakPoints(lastBattle.teams);
    const updated = { ...lastBattle, teams: updatedTeams, timestamp: Date.now() };
    sessions[username].lastBattle = updated;
    io.emit("battle", updated);
  });

  tiktok.on("chat", (data) => {
    registerUser(data);
    io.emit("event", { type:"chat", user:data.uniqueId, nickname:data.nickname||data.uniqueId, comment:data.comment, timestamp:Date.now() });
  });

  tiktok.on("follow",    (data) => { registerUser(data); io.emit("event", { type:"follow",  user:data.uniqueId, nickname:data.nickname||data.uniqueId, timestamp:Date.now() }); });
  tiktok.on("like",      (data) => { registerUser(data); io.emit("event", { type:"like",    user:data.uniqueId, nickname:data.nickname||data.uniqueId, likeCount:data.likeCount||1, timestamp:Date.now() }); });
  tiktok.on("subscribe", (data) => {                     io.emit("event", { type:"sub",     user:data.uniqueId, nickname:data.nickname||data.uniqueId, timestamp:Date.now() }); });
  tiktok.on("share",     (data) => {                     io.emit("event", { type:"share",   user:data.uniqueId, nickname:data.nickname||data.uniqueId, timestamp:Date.now() }); });

  tiktok.on("roomUser", (data) => {
    if (Array.isArray(data.topViewers)) {
      data.topViewers.forEach(v => {
        registerUser(v.user || v);
        const u = v.user || v;
        const user     = u.uniqueId || u.displayId || u.user || "";
        const nickname = u.nickname || u.displayName || u.name || user;
        if (user && user !== "?") {
          const existing = activeUsersMap.get(user);
          activeUsersMap.set(user, {
            user, nickname,
            viewers: v.memberCount || v.viewerCount || 0,
            joinTime: existing?.joinTime || Date.now()
          });
        }
      });
    }
    const allAccumulated = [...activeUsersMap.values()].sort((a,b) => (b.viewers||0) - (a.viewers||0));
    io.emit("viewers", { count: data.viewerCount || 0, topViewers: allAccumulated });
  });

  tiktok.on("member", (data) => {
    registerUser(data);
    const user     = data.uniqueId || data.displayId || "";
    const nickname = data.nickname || data.displayName || user;
    io.emit("member", { user, nickname, timestamp:Date.now() });
  });

  // ── linkMicBattle: inicio/fin de batalla ─────────────────────────────────
  tiktok.on("linkMicBattle", (data) => {
    if (Array.isArray(data.battleUsers)) data.battleUsers.forEach(u => registerUser(u));
    console.log("[linkMicBattle] raw:", JSON.stringify(data).slice(0, 600));

    const status = data.battleStatus !== undefined ? Number(data.battleStatus) : 1;

    if (status === 0) {
      // Batalla terminada
      console.log("[linkMicBattle] Batalla TERMINADA, limpiando puntos acumulados");
      resetPeakPoints();
      if (sessions[username]) sessions[username].lastBattle = null;
      io.emit("battle", { status: 0, teams: [], ownerUsername, timestamp: Date.now() });
      return;
    }

    const rawTeams = extractTeams(data);
    // ── Reiniciar picos al inicio de cada nueva batalla ────────────────
    const lastBattle2 = sessions[username]?.lastBattle;
    const prevIds = (lastBattle2?.teams || []).map(t => t.userId || t.hostName).sort().join(",");
    const newIds  = rawTeams.map(t => t.userId || t.hostName).sort().join(",");
    if (!lastBattle2 || prevIds !== newIds) {
      resetPeakPoints();
      console.log("[linkMicBattle] Nueva batalla detectada → puntos reiniciados");
    }
    const teams    = applyPeakPoints(rawTeams);
    console.log("[linkMicBattle] players:", teams.length, JSON.stringify(teams));

    const payload = { status, teams, ownerUsername, timestamp: Date.now() };
    if (sessions[username]) sessions[username].lastBattle = payload;
    io.emit("battle", payload);

    const cb = emitUpdatedBattle(username, ownerUsername, teams, status);
    teams.forEach(t => {
      if (/^\d{8,}$/.test(t.hostName)) resolveUserId(t.hostName, cb);
      if (/^\d{8,}$/.test(t.userId))   resolveUserId(t.userId,   cb);
    });
  });

  // ── linkMicArmies: actualización de puntos en tiempo real ─────────────────
  tiktok.on("linkMicArmies", (data) => {
    console.log("[linkMicArmies] RAW:", JSON.stringify(data).slice(0, 600));

    if (Array.isArray(data.battleArmies)) {
      data.battleArmies.forEach((army, i) => {
        const pts = extractPoints(army);
        const participantPts = (army.participants||[]).reduce((s,p) => s + extractPoints(p), 0);
        console.log(`[army ${i}] hostUserId=${army.hostUserId} uid=${army.hostUser?.uniqueId} pts=${pts} participantSum=${participantPts}`);
      });
    }

    const rawTeams = extractTeams(data);
    if (rawTeams.length === 0) return;

    // Aplicar peak: nunca dejar que un jugador baje de sus puntos máximos vistos
    const teams = applyPeakPoints(rawTeams);

    console.log(`[linkMicArmies] ${teams.length} jugadores con puntos:`, teams.map(t => `${t.hostName}=${t.points}`).join(", "));

    const payload = { status: 1, teams, ownerUsername, timestamp: Date.now() };
    if (sessions[username]) sessions[username].lastBattle = payload;
    io.emit("battle", payload);
    io.emit("battle_internal", payload);

    const cb = emitUpdatedBattle(username, ownerUsername, teams, 1);
    teams.forEach(t => {
      if (/^\d{8,}$/.test(t.hostName)) resolveUserId(t.hostName, cb);
      if (/^\d{8,}$/.test(t.userId))   resolveUserId(t.userId,   cb);
    });
  });

  tiktok.on("disconnected", () => {
    console.log(`❌ Desconectado de @${username}`);
    if (sessions[username]) delete sessions[username].tiktok;
    io.emit("tiktok_disconnected", { username });
  });

  tiktok.on("error", (err) => {
    console.error(`Error @${username}:`, err.message);
    io.emit("tiktok_error", { username, message: err.message });
  });

  return tiktok;
}

// ── SSE: stream de batalla en tiempo real ─────────────────────────────────
app.get("/battle-stream/:username", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const username = req.params.username;

  const sendData = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Enviar estado actual inmediatamente
  const s = getSessionRecord(username);
  sendData(s?.lastBattle || { status: 0, teams: [], timestamp: Date.now() });

  // Suscribirse a actualizaciones via socket interno
  const onBattle = (payload) => {
    const own = getSessionRecord(username);
    if (!own) return;
    if (payload.ownerUsername === own.ownerUsername) sendData(payload);
  };
  io.on("battle_internal", onBattle);

  // Ping cada 15s para mantener conexión viva
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);

  req.on("close", () => {
    clearInterval(ping);
    io.off("battle_internal", onBattle);
  });
});

app.get("/battle/:username", (req, res) => {
  const s = getSessionRecord(req.params.username);
  // Devolver {status:0} en lugar de null para que el frontend sepa que terminó
  res.json(s?.lastBattle || { status: 0, teams: [], timestamp: Date.now() });
});

app.get("/", (req, res) => res.json({ status:"TikPanel Server ✅", connections:Object.keys(sessions).length, users:Object.keys(sessions) }));
app.get("/status/:username", (req, res) => {
  const s = getSessionRecord(req.params.username);
  res.json({ connected: !!s?.tiktok, battle: s?.lastBattle || null });
});

app.post("/connect", async (req, res) => {
  const { username, sessionId } = req.body;
  if (!username) return res.status(400).json({ error:"Username requerido" });
  cleanSession(username);
  let lastErr = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await startTikTokConnection(username, sessionId);
      return res.json({ success:true, message:`Conectado a @${username}` });
    } catch(err) {
      lastErr = err.message || "Error desconocido";
      console.warn(`Intento ${attempt}/3 fallido para @${username}: ${lastErr}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
    }
  }
  res.status(500).json({ error: lastErr || "No se pudo conectar. ¿Estás en LIVE?" });
});

app.post("/disconnect", (req, res) => {
  const { username } = req.body;
  if (username) cleanSession(username);
  res.json({ success:true });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 TikPanel Server en puerto ${PORT}`));
