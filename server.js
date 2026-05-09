const { WebcastPushConnection } = require("tiktok-live-connector");
const express = require("express");
const http = require("http");
const https = require("https");
const { Server } = require("socket.io");
const cors = require("cors");

// ── Evitar crash por Promises no capturadas ──────────────────────────────────
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason?.message || reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err?.message || err);
});


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
  try {
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
  } catch(outerErr) {
    console.error("[resolveUserId] outer catch:", outerErr?.message || outerErr);
    pendingResolve.delete(numericId);
  }
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

// ── Normalizar puntos de batalla (estaba faltando esta función) ──────────────
function normalizeBattlePoints(src) {
  if (!src) return 0;
  return Number(
    src.battleScore || src.score || src.points || src.teamPoints ||
    src.battlePoints || src.point || src.pts || 0
  );
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

function extractTeams(data) {
  if (Array.isArray(data.battleArmies) && data.battleArmies.length > 0) {

    // Registrar todos los usuarios conocidos para el mapa de resolución
    data.battleArmies.forEach(army => {
      if (army.hostUser) registerUser(army.hostUser);
      if (Array.isArray(army.participants)) army.participants.forEach(p => registerUser(p));
    });

    const result = [];
    const seen = new Set();

    data.battleArmies.forEach((army, armyIdx) => {
      // Determinar teamIdx (equipo 0 o 1)
      let teamIdx;
      if (army.armyType !== undefined && army.armyType !== null) {
        teamIdx = Number(army.armyType) % 2;
      } else if (army.teamId !== undefined && army.teamId !== null) {
        teamIdx = Number(army.teamId) % 2;
      } else {
        teamIdx = armyIdx % 2;
      }

      // Los puntos del army son los del ANFITRIÓN principal
      const armyPoints = Number(
        army.points || army.teamScore || army.teamPoints ||
        army.score || army.battleScore || army.point ||
        army.totalScore || army.totalPoints || 0
      );

      // El anfitrión principal: army.hostUser o buscar en participants por army.hostUserId
      const hostUserId = String(army.hostUserId || army.hostId || "");
      let hostEntry = army.hostUser || null;

      // Si no hay hostUser pero hay participants, buscar el que coincide con hostUserId
      if (!hostEntry && hostUserId && Array.isArray(army.participants)) {
        hostEntry = army.participants.find(p =>
          String(p.userId || p.id || "") === hostUserId
        ) || null;
      }
      // Si aún no, usar el primer participante como host
      if (!hostEntry && Array.isArray(army.participants) && army.participants.length > 0) {
        hostEntry = army.participants[0];
      }

      // Crear entrada para el anfitrión con los puntos del army
      if (hostEntry || hostUserId) {
        const src = hostEntry || {};
        const r = extractName(src);
        const userId = String(src.userId || src.id || hostUserId || r.userId || "");
        let hostName = r.hostName;
        let hostNickname = r.hostNickname;

        if (!hostName || /^\d{8,}$/.test(hostName)) {
          const resolved = resolveNameFromMap(userId);
          if (resolved) {
            hostName = resolved.uniqueId;
            hostNickname = resolved.nickname || hostNickname || resolved.uniqueId;
          }
        }
        if (!hostName) hostName = userId || `host_${armyIdx}`;
        if (!hostNickname) hostNickname = hostName;

        const dedupeKey = String(userId || hostName);
        if (dedupeKey && !seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          result.push({ hostName, hostNickname, userId, points: armyPoints, teamIdx });
        }
      }

      // Agregar otros participantes con sus puntos individuales (si tienen pts > 0)
      if (Array.isArray(army.participants)) {
        army.participants.forEach((p, partIdx) => {
          const pId = String(p.userId || p.id || "");
          const hostUserId2 = String(army.hostUserId || army.hostId || "");
          // Saltar el que ya pusimos como host
          if (pId && pId === hostUserId2) return;
          if (result[0] && pId === String(result.find(r2 => r2.teamIdx === teamIdx)?.userId || "")) return;

          const pPoints = normalizeBattlePoints(p);
          // Solo incluir participantes con puntos propios
          if (pPoints <= 0) return;

          const r = extractName(p);
          const userId = pId || r.userId || "";
          let hostName = r.hostName;
          let hostNickname = r.hostNickname;

          if (!hostName || /^\d{8,}$/.test(hostName)) {
            const resolved = resolveNameFromMap(userId);
            if (resolved) { hostName = resolved.uniqueId; hostNickname = resolved.nickname; }
          }
          if (!hostName) hostName = userId || `player_${armyIdx}_${partIdx}`;
          if (!hostNickname) hostNickname = hostName;

          const dedupeKey = String(userId || hostName);
          if (!dedupeKey || seen.has(dedupeKey)) return;
          seen.add(dedupeKey);
          result.push({ hostName, hostNickname, userId, points: pPoints, teamIdx });
        });
      }
    });

    if (result.length > 0) return result;
  }

  if (Array.isArray(data.battleUsers) && data.battleUsers.length > 0) {
    return data.battleUsers.map((u, idx) => {
      let hostName = u.uniqueId || u.displayId || "";
      let hostNickname = u.nickname || u.displayName || hostName;
      const userId = String(u.userId || u.id || "");

      if (!hostName || /^\d{8,}$/.test(hostName)) {
        const resolved = resolveNameFromMap(userId);
        if (resolved) { hostName = resolved.uniqueId; hostNickname = resolved.nickname; }
        else hostName = userId || "?";
      }
      return {
        hostName, hostNickname, userId,
        points: normalizeBattlePoints(u),
        teamIdx: u.teamIdx !== undefined && u.teamIdx !== null ? Number(u.teamIdx) : (u.teamId !== undefined && u.teamId !== null ? Number(u.teamId) % 2 : idx % 2)
      };
    }).filter(t => t.hostName !== "?");
  }

  const candidates = [data.battleItems, data.users, data.armies, data.items, data.teams].filter(Array.isArray);
  for (const arr of candidates) {
    const teams = arr.map((item, idx) => {
      const u    = item.hostUser || item.host || item.user || item;
      const base = normalizeBattleUser(u);
      if (!base) return null;
      const pts  = normalizeBattlePoints(item) || base.points || 0;
      return { ...base, userId: String(u.userId || u.id || ""), points: pts, teamIdx: item.teamIdx !== undefined && item.teamIdx !== null ? Number(item.teamIdx) : (item.teamId !== undefined && item.teamId !== null ? Number(item.teamId) % 2 : idx % 2) };
    }).filter(Boolean);
    if (teams.length > 0) return teams;
  }
  return [];
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

    const teamsSnap2 = teams.map(t => ({ ...t }));
    const battlePayload = { status, teams: teamsSnap2, ownerUsername, timestamp: Date.now() };
    if (sessions[username]) sessions[username].lastBattle = status === 0 ? null : battlePayload;
    io.emit("battle", battlePayload);

    const cb = emitUpdatedBattle(username, ownerUsername, teamsSnap2, status);
    teamsSnap2.forEach(t => {
      if (/^\d{8,}$/.test(t.hostName)) resolveUserId(t.hostName, cb).catch(e => console.error("[resolve]", e?.message));
      if (/^\d{8,}$/.test(t.userId))   resolveUserId(t.userId,   cb).catch(e => console.error("[resolve]", e?.message));
    });
  });

  // ── linkMicArmies ──────────────────────────────────────────────────────
  let lastTeams  = [];
  let lastStatus = 1;

  tiktok.on("linkMicArmies", (data) => {
    console.log("[linkMicArmies] RAW FULL:", JSON.stringify(data).slice(0, 4000));
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

    const teamsSnap = teams.map(t => ({ ...t }));
    const battlePayload = { status: 1, teams: teamsSnap, ownerUsername, timestamp: Date.now() };
    if (sessions[username]) sessions[username].lastBattle = battlePayload;
    io.emit("battle", battlePayload);

    const cb = emitUpdatedBattle(username, ownerUsername, teamsSnap, 1);
    teamsSnap.forEach(t => {
      if (/^\d{8,}$/.test(t.hostName)) resolveUserId(t.hostName, cb).catch(e => console.error("[resolve]", e?.message));
      if (/^\d{8,}$/.test(t.userId))   resolveUserId(t.userId,   cb).catch(e => console.error("[resolve]", e?.message));
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

// ── Re-emitir lastBattle a nuevos clientes (fix recarga de página) ──────────
io.on("connection", (socket) => {
  for (const key of Object.keys(sessions)) {
    const s = sessions[key];
    if (s?.lastBattle) {
      console.log(`[socket-join] Re-emitiendo lastBattle a ${socket.id}`);
      socket.emit("battle", s.lastBattle);
      break;
    }
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 TikPanel Server en puerto ${PORT}`));
