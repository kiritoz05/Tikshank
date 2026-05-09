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

// ── Helper: fetch con https nativo (compatible Node 16+) ───────────────────────
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

  // Método 1: API pública de TikTok via https nativo
  try {
    const res = await fetchUrl(
      `https://www.tiktok.com/@id:${numericId}`,
      { timeout: 8000 }
    );
    if (res.ok) {
      const text = await res.text();
      const patterns = [
        /"uniqueId":"([^"]{2,50})"/,
        /"unique_id":"([^"]{2,50})"/,
      ];
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

  // Método 2: Intentar conectar brevemente al live del contrincante
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

// Normalizar participante
function normalizeBattleUser(u) {
  if (!u) return null;
  const hostName     = u.uniqueId || u.displayId || u.userId || u.id || "?";
  const hostNickname = u.nickname || u.displayName || u.name || hostName;
  const points       = Number(u.battleScore || u.score || u.points || u.teamPoints || 0);
  if (hostName === "?") return null;
  return { hostName, hostNickname, points };
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

function extractName(u) {
  if (!u) return { hostName: "", hostNickname: "", userId: "" };
  const uid    = String(u.uniqueId || u.displayId || "");
  const nn     = String(u.nickname || u.displayName || u.name || "");
  const userId = String(u.userId   || u.id || "");
  const hostName     = (uid && !/^\d{8,}$/.test(uid)) ? uid : (resolveNameFromMap(userId)?.uniqueId || userId || "?");
  const hostNickname = nn || resolveNameFromMap(userId)?.nickname || uid || hostName;
  return { hostName, hostNickname, userId };
}


// ─── Obtener puntos de cualquier objeto
function pickPoints(obj) {
  if (!obj) return 0;
  var fields = [
    obj.battleScore, obj.score, obj.points, obj.teamPoints,
    obj.groupScore,  obj.totalScore, obj.totalPoints, obj.point,
    obj.armyScore,   obj.matchScore, obj.displayScore
  ];
  for (var i = 0; i < fields.length; i++) {
    var n = Number(fields[i]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

// ─── Resolver nombre limpio desde objeto usuario
function resolveName(u) {
  if (!u) return { name: "", nick: "", uid: "" };
  var uid  = String(u.uniqueId  || u.displayId  || "");
  var nick = String(u.nickname  || u.displayName || u.name || "");
  var id   = String(u.userId    || u.id          || "");
  var mapE = userMap[id] || userMap[uid] || null;
  var rUid  = (uid  && !/^\d{6,}$/.test(uid))  ? uid  : (mapE && mapE.uniqueId  ? mapE.uniqueId  : "");
  var rNick = (nick && !/^\d{6,}$/.test(nick)) ? nick : (mapE && mapE.nickname  ? mapE.nickname  : rUid);
  return {
    name: rUid  || uid  || id  || "",
    nick: rNick || nick || rUid || uid || id || "",
    uid:  id    || uid  || ""
  };
}

// ─── EXTRACCIÓN PRINCIPAL ─────────────────────────────────────
// Regla: cada army = 1 equipo
//   hostUser  = anfitrión principal del equipo  (SIEMPRE incluir)
//   linkedMicUser / coHostUser = co-anfitrión   (incluir si existe)
//   participants = FANS/MVPs que apoyan          (IGNORAR)
//   army.points / teamPoints                     = puntos del equipo
//
// Para batalla 2 anfitriones (1v1): 2 armies, 1 hostUser c/u → 2 tarjetas
// Para batalla 4 anfitriones (2v2): 2 armies, hostUser + coHostUser c/u → 4 tarjetas
// ─────────────────────────────────────────────────────────────
function extractTeams(data) {
  var armies = data.battleArmies || (data.linkMicBattleInfo && data.linkMicBattleInfo.battleArmies) || [];
  var results = [];

  function pushUnique(arr, item) {
    if (!item) return;
    var key = String(item.userId || item.hostName || '');
    if (!key) return;
    if (arr.some(function(x){ return String(x.userId || x.hostName || '') === key; })) return;
    arr.push(item);
  }

  if (Array.isArray(armies) && armies.length > 0) {
    armies.forEach(function(army, armyIdx) {
      var teamIdx = army.armyType !== undefined ? Number(army.armyType) % 2
                  : army.teamId !== undefined ? Number(army.teamId) % 2
                  : armyIdx % 2;
      var armyPts = pickPoints(army);
      var hosts = [];

      function mkUser(u, isMainHost) {
        if (!u) return null;
        registerUser(u);
        var r = resolveName(u);
        var nm = r.name || r.uid || '';
        if (!nm) return null;
        return {
          hostName: nm,
          hostNickname: r.nick || nm,
          userId: r.uid || String(u.userId || u.id || ''),
          points: 0,
          teamIdx: teamIdx,
          isMainHost: !!isMainHost
        };
      }

      pushUnique(hosts, mkUser(army.hostUser || null, true));
      pushUnique(hosts, mkUser(army.linkedMicUser || army.coHostUser || army.guestUser || army.battleUser || army.invitedUser || null, false));

      if (Array.isArray(army.participants)) {
        army.participants.forEach(function(p) {
          var u = p && p.user ? p.user : p;
          if (!u) return;
          var role = String((p && (p.role || p.userRole || p.type)) || '').toLowerCase();
          var isHostLike = p && (p.isHost === true || role === 'host' || role === 'anchor' || role === 'cohost');
          var sameAsHost = army.hostUser && (String(u.userId || u.id || '') === String(army.hostUser.userId || army.hostUser.id || '') || String(u.uniqueId || '') === String(army.hostUser.uniqueId || ''));
          if (isHostLike && !sameAsHost) pushUnique(hosts, mkUser(u, false));
        });
      }

      hosts = hosts.slice(0, 2);
      if (hosts.length === 0) return;

      if (hosts.length === 1) {
        hosts[0].points = armyPts;
      } else {
        var found = 0;
        if (Array.isArray(army.participants)) {
          hosts.forEach(function(h) {
            var matched = army.participants.find(function(p) {
              var u = p && p.user ? p.user : p;
              return String((u && (u.userId || u.id)) || '') === String(h.userId || '');
            });
            var pts = matched ? (pickPoints(matched) || pickPoints(matched.user || null)) : 0;
            h.points = pts;
            found += pts;
          });
        }
        if (found <= 0) {
          hosts[0].points = Math.ceil(armyPts / 2);
          hosts[1].points = Math.floor(armyPts / 2);
        } else if (armyPts > found) {
          hosts[0].points += (armyPts - found);
        }
      }

      hosts.forEach(function(h) { results.push(h); });
    });
  }

  if (results.length === 0 && Array.isArray(data.battleUsers) && data.battleUsers.length > 0) {
    results = data.battleUsers.slice(0, 2).map(function(u, i) {
      registerUser(u);
      var r = resolveName(u);
      return {
        hostName: r.name || r.uid || ('player_' + i),
        hostNickname: r.nick || r.name || r.uid || ('player_' + i),
        userId: r.uid || '',
        points: pickPoints(u),
        teamIdx: i % 2,
        isMainHost: true
      };
    }).filter(Boolean);
  }

  var left = results.filter(function(x){ return x.teamIdx === 0; }).slice(0, 2);
  var right = results.filter(function(x){ return x.teamIdx === 1; }).slice(0, 2);
  return left.concat(right);
}

function getArmyPoints(army) {
  return pickPoints(army);
}

// Emitir batalla actualizada cuando se resuelva un ID
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

  tiktok.on("chat", (data) => {
    registerUser(data);
    io.emit("event", { type:"chat", user:data.uniqueId, nickname:data.nickname||data.uniqueId, comment:data.comment, timestamp:Date.now() });
  });

  tiktok.on("gift", (data) => {
    registerUser(data);
    if (data.giftType === 1 && !data.repeatEnd) return;
    io.emit("event", { type:"gift", user:data.uniqueId, nickname:data.nickname||data.uniqueId, giftName:data.giftName||"", giftId:data.giftId||0, giftCount:data.repeatCount||1, diamondCount:data.diamondCount||0, timestamp:Date.now() });
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
    const allAccumulated = [...activeUsersMap.values()]
      .sort((a,b) => (b.viewers||0) - (a.viewers||0));
    io.emit("viewers", {
      count: data.viewerCount || 0,
      topViewers: allAccumulated,
    });
  });

  tiktok.on("member", (data) => {
    registerUser(data);
    const user     = data.uniqueId || data.displayId || "";
    const nickname = data.nickname || data.displayName || user;
    io.emit("member", { user, nickname, timestamp:Date.now() });
  });

  // ── linkMicBattle ──────────────────────────────────────────────────────
  tiktok.on("linkMicBattle", (data) => {
    if (Array.isArray(data.battleUsers)) data.battleUsers.forEach(u => registerUser(u));
    console.log("[linkMicBattle] raw:", JSON.stringify(data).slice(0, 600));

    const teams  = extractTeams(data);
    const status = data.battleStatus || 1;
    console.log("[linkMicBattle] players:", teams.length, JSON.stringify(teams));

    const battlePayload = { status, teams, ownerUsername, timestamp: Date.now() };
    if (sessions[username]) sessions[username].lastBattle = status === 0 ? null : battlePayload;
    io.emit("battle", battlePayload);

    if (sessions[username]) sessions[username].lastBattle = status === 0 ? null : { status, teams, ownerUsername, timestamp: Date.now() };
    const cb = emitUpdatedBattle(username, ownerUsername, teams, status);
    teams.forEach(t => {
      if (/^\d{8,}$/.test(t.hostName)) resolveUserId(t.hostName, cb);
      if (/^\d{8,}$/.test(t.userId))   resolveUserId(t.userId,   cb);
    });
  });

  // ── linkMicArmies ──────────────────────────────────────────────────────
  let lastTeams  = [];
  let lastStatus = 1;

  tiktok.on("linkMicArmies", (data) => {
    console.log("[linkMicArmies] RAW FULL:", JSON.stringify(data).slice(0, 8000));
    // Log específico de puntos para debug
    if (Array.isArray(data.battleArmies)) {
      data.battleArmies.forEach((army, i) => {
        const pts = getArmyPoints(army);
        console.log(`[army ${i} POINTS] getArmyPoints=${pts} raw={points:${army.points},teamPoints:${army.teamPoints},score:${army.score},battleScore:${army.battleScore},armyScore:${army.armyScore}}`);
        (army.participants||[]).slice(0,2).forEach((p,j) => {
          console.log(`  [participant ${j}] bs=${p.battleScore} s=${p.score} pts=${p.points} tp=${p.teamPoints} gs=${p.groupScore}`);
        });
      });
    }
    if (Array.isArray(data.battleArmies)) {
      data.battleArmies.forEach((army, i) => {
        console.log(`[army ${i}] hostUserId=${army.hostUserId} armyType=${army.armyType} teamId=${army.teamId} points=${army.points||army.teamPoints||army.score||0}`);
        if (army.hostUser) console.log(`[army ${i}] hostUser: uid=${army.hostUser.uniqueId} nn=${army.hostUser.nickname} id=${army.hostUser.userId||army.hostUser.id}`);
        else console.log(`[army ${i}] hostUser: (vacío)`);
        const parts = (army.participants||[]).slice(0,3).map(p=>({uid:p.uniqueId,nn:p.nickname,id:p.userId||p.id,pts:p.battleScore||p.score||p.points||0}));
        console.log(`[army ${i}] participants[0..2]:`, JSON.stringify(parts));
      });
    }

    const teams = extractTeams(data);
    console.log(`[linkMicArmies] individual players=${teams.length}`);
    if (teams.length === 0) return;

    lastTeams  = teams;
    lastStatus = 1;

    const battlePayload = { status: 1, teams, ownerUsername, timestamp: Date.now() };
    if (sessions[username]) sessions[username].lastBattle = battlePayload;
    io.emit("battle", battlePayload);

    if (sessions[username]) sessions[username].lastBattle = { status: 1, teams, ownerUsername, timestamp: Date.now() };
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

app.get("/battle/:username", (req, res) => {
  const s = getSessionRecord(req.params.username);
  res.json(s?.lastBattle || null);
});

// Endpoint para obtener cualquier batalla activa (sin saber el username)
app.get("/battle-active", (req, res) => {
  for (const [uname, sess] of Object.entries(sessions)) {
    if (sess && sess.lastBattle) return res.json(sess.lastBattle);
  }
  res.json(null);
});

// Al conectar socket, re-enviar batalla activa inmediatamente
io.on("connection", (socket) => {
  for (const [uname, sess] of Object.entries(sessions)) {
    if (sess && sess.lastBattle) {
      socket.emit("battle", sess.lastBattle);
      console.log(`[socket:connect] Re-enviando batalla activa @${uname}`);
      break;
    }
  }
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
