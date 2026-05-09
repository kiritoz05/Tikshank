import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

const SERVER = "https://tikshank-production.up.railway.app";
const EL_KEY = "sk_c59a0c3dddc47a866083fc9b58a7dbd92b722fb2fb12da11";

/* ─── Storage helpers ───────────────────────────────── */
const sv = (k, v) => { try { localStorage.setItem("tp_" + k, JSON.stringify(v)); } catch (e) { } };
const ld = (k, d) => { try { const v = localStorage.getItem("tp_" + k); return v !== null ? JSON.parse(v) : d; } catch (e) { return d; } };

/* ─── TTS ENGINE ──────────────────────────────────────── */
const ttsQueue = [];
let ttsActive = false;

function enqueueTTS(text, voiceId, vol, mode) {
  if (!text || !text.trim()) return;
  ttsQueue.push({ text: text.trim(), voiceId, vol, mode });
  if (!ttsActive) drainQueue();
}

async function drainQueue() {
  if (ttsQueue.length === 0) { ttsActive = false; return; }
  ttsActive = true;
  const item = ttsQueue.shift();
  try {
    if (item.mode === "elevenlabs") {
      await speakElevenLabs(item.text, item.voiceId, item.vol);
    } else {
      await speakNative(item.text, item.voiceId, item.vol);
    }
  } catch (e) {
    console.warn("TTS falló:", e.message);
  }
  setTimeout(drainQueue, 50);
}

async function speakElevenLabs(text, voiceId, vol) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json", "Accept": "audio/mpeg" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error("EL HTTP " + r.status);
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  await playAudio(url, vol);
  URL.revokeObjectURL(url);
}

function speakNative(text, voiceId, vol) {
  return new Promise((res) => {
    if (!window.speechSynthesis) { res(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.volume = Math.min(1, Math.max(0, vol));
    utt.rate = 1.05;
    utt.pitch = 1;
    utt.lang = "es-MX";
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.name === voiceId || v.lang.startsWith("es"));
    if (match) utt.voice = match;
    utt.onend = res;
    utt.onerror = res;
    window.speechSynthesis.speak(utt);
    setTimeout(res, 15000);
  });
}

function playAudio(src, vol) {
  return new Promise((res) => {
    const a = new Audio(src);
    a.volume = Math.min(1, Math.max(0, vol));
    a.onended = res;
    a.onerror = res;
    a.play().catch(res);
    setTimeout(res, 30000);
  });
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ─── Datos de TikTok ───────────────────────────────── */
const EV_TYPES = ["Follow Alert", "Gift Alert", "Like Alert", "Sub Alert", "Share Alert"];
const TIKTOK_GIFTS = [
  "Cualquier regalo", "Rose", "You're awesome", "GG", "TikTok", "Ice Cream Cone", "Pop",
  "Love you so much", "Wink wink", "Glow Stick", "Cake Slice", "Heart Me", "Thumbs Up",
  "Heart", "Love you", "Heart Puff", "Blue Heart", "Flame heart", "Power hug", "Squirrel",
  "Chilli Pepper", "Tulip", "Graduation Bouquet", "Wink Charm", "Team Bracelet", "Overreact",
  "Finger Heart", "Name shoutout", "Pomegranate", "Embroidered Heart", "Super Popular",
  "Cheer You Up", "Club Power", "Rosa", "Friendship Necklace", "Panda", "Sunflower",
  "Birthday Cake", "Doughnut", "Lollipop", "Rainbow Puke", "Great", "LMAO", "Perfume",
  "I Love You", "Garfield", "Confetti", "Sun Cream", "Sunglasses", "Hashtag", "Bunny",
  "Pixel Heart", "Owl", "Money Rain", "Newspaper", "Corgi", "Drama Queen", "Tiny Diny",
  "Fashion Brand", "Castle", "Gem", "Mishka", "Star Shower", "Disco Ball", "Lovely",
  "Interstellar", "GG EZ", "Dolphin", "Elephant", "Cap", "Ferris Wheel", "Mermaid",
  "Rocket", "Galaxy", "Airplane", "Planet", "Diamond Flight", "Lion", "Universe",
  "Diamond Tree", "Concert", "Crown", "Big Cat", "Boxing Gloves", "Super Nova",
  "UFO", "Dragon", "Phoenix", "Bear",
];

const DEF_VOICES_EL = [
  { id: "cgSgspJ2msm6clMCkdW9", name: "Bella - Natural (Femenina)" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel - Multilingüe" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi - Energética" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Elli - Joven" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni - Natural (Masculina)" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold - Profunda" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam - Narrador" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam - Cálida" },
];

const DEF_ACTIONS = [
  { id: 1, enabled: true, name: "Follow Alert", event: "Follow Alert", giftName: "", minCount: 1, duration: 5, soundName: "", soundData: "", ttsOn: false, ttsText: "¡Gracias @usuario por seguirme!" },
  { id: 2, enabled: true, name: "Rosa Gift", event: "Gift Alert", giftName: "Rose", minCount: 1, duration: 5, soundName: "", soundData: "", ttsOn: false, ttsText: "¡Gracias @usuario por la rosa!" },
  { id: 3, enabled: true, name: "Like Alert", event: "Like Alert", giftName: "", minCount: 1, duration: 5, soundName: "", soundData: "", ttsOn: false, ttsText: "" },
  { id: 4, enabled: false, name: "Sub Alert", event: "Sub Alert", giftName: "", minCount: 1, duration: 10, soundName: "", soundData: "", ttsOn: false, ttsText: "¡Gracias @usuario por suscribirte!" },
  { id: 5, enabled: false, name: "León Gift", event: "Gift Alert", giftName: "Lion", minCount: 1, duration: 8, soundName: "", soundData: "", ttsOn: false, ttsText: "¡WOW! @usuario mandó un LEÓN! 🦁" },
];

const USERS = {
  "admin@tikpanel.com": { password: "admin123", name: "Admin", plan: "Pro", avatar: "A" },
  "luzalva@tikpanel.com": { password: "luz2024", name: "Luz Álva", plan: "Pro", avatar: "L" },
  "usuario@tikpanel.com": { password: "pass123", name: "Streamer", plan: "Free", avatar: "S" },
};

/* ─── Pequeños componentes ──────────────────────────── */
function Toggle({ on, onChange, color = "#fe2c55", size = "md" }) {
  const w = size === "sm" ? 28 : 42, h = size === "sm" ? 16 : 23, dot = size === "sm" ? 12 : 19;
  return (
    <div onClick={onChange} style={{ width: w, height: h, borderRadius: w, cursor: "pointer", position: "relative", background: on ? color : "#1e1e2e", transition: "background .2s", flexShrink: 0, border: "1px solid rgba(255,255,255,.05)" }}>
      <div style={{ position: "absolute", top: 2, left: on ? w - dot - 2 : 2, width: dot, height: dot, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 4px rgba(0,0,0,.5)" }} />
    </div>
  );
}

function IBtn({ ico, onClick, color = "#aaa", title = "" }) {
  return (
    <button onClick={onClick} title={title}
      style={{ background: "transparent", border: "1px solid #1e1e2e", borderRadius: 5, width: 24, height: 24, cursor: "pointer", color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, transition: "border-color .15s" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = color}
      onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e2e"}>
      {ico}
    </button>
  );
}

/* ─── Modal Acción ──────────────────────────────────── */
function ActModal({ action, ttsMode, ttsVoiceId, ttsNativeVoice, vol, onSave, onClose }) {
  const def = { id: Date.now(), enabled: true, name: "", event: "Gift Alert", giftName: "Cualquier regalo", minCount: 1, duration: 5, soundName: "", soundData: "", ttsOn: false, ttsText: "" };
  const [f, setF] = useState(action ? { ...action } : def);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const lbl = { display: "block", color: "#556", fontSize: 9, fontWeight: 700, letterSpacing: .8, textTransform: "uppercase", marginBottom: 5 };
  const inp = { width: "100%", background: "#0a0a0f", border: "1px solid #252535", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 12, outline: "none" };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    try {
      const data = await fileToBase64(file);
      set("soundData", data);
      set("soundName", file.name);
    } catch (err) { alert("Error al leer el archivo"); }
    setBusy(false);
  };

  const testSound = () => { if (!f.soundData) return; playAudio(f.soundData, (vol || 80) / 100); };
  const testTTS = () => {
    const text = (f.ttsText || "Hola, esto es una prueba").replace(/@usuario/gi, "UsuarioPrueba");
    enqueueTTS(text, ttsMode === "elevenlabs" ? ttsVoiceId : ttsNativeVoice, (vol || 80) / 100, ttsMode);
  };

  return (
    <div className="mo" onClick={e => e.target.classList.contains("mo") && onClose()}>
      <div className="mb">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16 }}>{action ? "✏️ Editar Acción" : "➕ Nueva Acción"}</div>
          <button onClick={onClose} style={{ background: "#1a1a28", border: "none", borderRadius: 6, width: 26, height: 26, cursor: "pointer", color: "#555", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Nombre de la acción</label>
          <input value={f.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Rosa Sound" style={inp} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Evento</label>
            <select value={f.event} onChange={e => set("event", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              {EV_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Duración (seg)</label>
            <input type="number" min="1" max="120" value={f.duration} onChange={e => set("duration", Number(e.target.value))} style={inp} />
          </div>
        </div>
        {f.event === "Gift Alert" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Regalo de TikTok</label>
              <select value={f.giftName} onChange={e => set("giftName", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                {TIKTOK_GIFTS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Cantidad mínima</label>
              <input type="number" min="1" value={f.minCount} onChange={e => set("minCount", Number(e.target.value))} style={inp} />
            </div>
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Sonido de alerta (MP3/WAV/OGG)</label>
          <div className={`ua ${f.soundName ? "has" : ""}`}>
            <input type="file" accept="audio/*" onChange={handleFile} disabled={busy} />
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(37,244,238,.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
              {busy ? <span className="spinner" /> : "🎵"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: f.soundName ? "#25f4ee" : "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {busy ? "Cargando..." : f.soundName || "Toca para subir audio"}
              </div>
              <div style={{ fontSize: 9, color: f.soundName ? "rgba(37,244,238,.6)" : "#444", marginTop: 2 }}>
                {f.soundName ? "✓ Guardado — no se pierde al recargar" : "MP3, WAV, OGG"}
              </div>
            </div>
            {f.soundData && (
              <button onClick={e => { e.preventDefault(); e.stopPropagation(); testSound(); }}
                style={{ background: "rgba(37,244,238,.1)", border: "1px solid rgba(37,244,238,.3)", borderRadius: 7, padding: "5px 10px", color: "#25f4ee", fontSize: 10, fontWeight: 700, cursor: "pointer", zIndex: 2, position: "relative", flexShrink: 0 }}>▶ Probar</button>
            )}
            {f.soundName && (
              <button onClick={e => { e.preventDefault(); e.stopPropagation(); set("soundData", ""); set("soundName", ""); }}
                style={{ background: "rgba(254,44,85,.08)", border: "1px solid rgba(254,44,85,.2)", borderRadius: 7, padding: "5px 9px", color: "#fe2c55", fontSize: 10, fontWeight: 700, cursor: "pointer", zIndex: 2, position: "relative", flexShrink: 0 }}>✕</button>
            )}
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ display: "block", color: "#556", fontSize: 9, fontWeight: 700, letterSpacing: .8, textTransform: "uppercase" }}>Mensaje TTS al activarse</label>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Toggle on={f.ttsOn} onChange={() => set("ttsOn", !f.ttsOn)} color="#25f4ee" size="sm" />
              <span style={{ fontSize: 9, color: f.ttsOn ? "#25f4ee" : "#444", fontWeight: 700 }}>{f.ttsOn ? "ACTIVO" : "APAGADO"}</span>
            </div>
          </div>
          <div style={{ background: "#0a0a0f", border: `1px solid ${f.ttsOn ? "rgba(37,244,238,.25)" : "#252535"}`, borderRadius: 9, overflow: "hidden", transition: "border-color .2s" }}>
            <textarea value={f.ttsText} onChange={e => set("ttsText", e.target.value)} disabled={!f.ttsOn}
              placeholder="Ej: ¡Gracias @usuario por la rosa!"
              style={{ width: "100%", background: "transparent", border: "none", padding: "9px 12px", color: f.ttsOn ? "#fff" : "#333", fontSize: 12, outline: "none", resize: "vertical", minHeight: 55, lineHeight: 1.6 }} />
            {f.ttsOn && f.ttsText && (
              <div style={{ borderTop: "1px solid #1a1a28", padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, color: "#444" }}>Motor: <span style={{ color: "#fe2c55" }}>{ttsMode === "elevenlabs" ? "ElevenLabs" : "Voz del navegador (gratis)"}</span></span>
                <button onClick={testTTS} style={{ background: "rgba(254,44,85,.08)", border: "1px solid rgba(254,44,85,.2)", borderRadius: 6, padding: "4px 10px", color: "#fe2c55", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>🔊 Probar</button>
              </div>
            )}
          </div>
          <div style={{ color: "#444", fontSize: 9, marginTop: 4 }}>💡 <span style={{ color: "#25f4ee", fontFamily: "monospace" }}>@usuario</span> se reemplaza con el nombre</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: "transparent", border: "1px solid #252535", borderRadius: 9, padding: "10px", color: "#555", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
          <button onClick={() => { if (!f.name.trim()) { alert("Ponle un nombre a la acción"); return; } onSave({ ...f }); }}
            style={{ flex: 2, background: "linear-gradient(135deg,#fe2c55,#ff6b81)", border: "none", borderRadius: 9, padding: "10px", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
            💾 Guardar Acción
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Login ─────────────────────────────────────────── */
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const go = () => {
    setErr(""); setLoading(true);
    setTimeout(() => {
      const u = USERS[email.toLowerCase()];
      if (u && u.password === pass) { onLogin({ ...u, email }); }
      else { setErr("Correo o contraseña incorrectos."); setLoading(false); }
    }, 600);
  };

  const inp = { width: "100%", background: "#0d0d18", border: "1px solid #1e1e2e", borderRadius: 10, padding: "11px 14px", color: "#fff", fontSize: 13, outline: "none" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f", padding: 20 }}>
      <div style={{ background: "#12121e", border: "1px solid #1e1e2e", borderRadius: 22, padding: "40px 32px", width: "100%", maxWidth: 380, boxShadow: "0 40px 80px rgba(0,0,0,.7)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "linear-gradient(135deg,#fe2c55,#25f4ee)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 17 }}>T</div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 21, letterSpacing: -.5 }}>ik<span style={{ color: "#fe2c55" }}>Panel</span></span>
        </div>
        <p style={{ color: "#555", fontSize: 12, marginBottom: 22 }}>Panel de control para TikTok LIVE</p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", color: "#555", fontSize: 9, fontWeight: 700, letterSpacing: .8, textTransform: "uppercase", marginBottom: 6 }}>Correo</label>
          <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} type="email" placeholder="tu@correo.com" style={inp} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", color: "#555", fontSize: 9, fontWeight: 700, letterSpacing: .8, textTransform: "uppercase", marginBottom: 6 }}>Contraseña</label>
          <input value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} type="password" placeholder="••••••••" style={inp} />
        </div>
        {err && <div style={{ background: "rgba(254,44,85,.08)", border: "1px solid rgba(254,44,85,.2)", borderRadius: 8, padding: "8px 12px", color: "#fe2c55", fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <button onClick={go} disabled={loading}
          style={{ width: "100%", background: loading ? "#1e1e2e" : "linear-gradient(135deg,#fe2c55,#ff6b81)", border: "none", borderRadius: 10, padding: "12px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {loading ? "Verificando..." : "Ingresar →"}
        </button>
      </div>
    </div>
  );
}

/* ─── App Principal ─────────────────────────────────── */
export default function App() {
  const [user, setUser] = useState(() => ld("session", null));
  const [tab, setTab] = useState(() => ld("tab", "dashboard"));
  const [sb, setSb] = useState(false);
  const [battle, setBattle] = useState(null);
  const [tUser, setTUser] = useState(() => ld("tuser", ""));
  const [sessId, setSessId] = useState(() => ld("sessid", ""));
  const [conn, setConn] = useState(false);
  const [conn2, setConn2] = useState(false);
  const wakeLockRef = useRef(null);
  const [wakeLockOn, setWakeLockOn] = useState(false);
  const [dots, setDots] = useState("");
  const [connErr, setConnErr] = useState("");
  const [stats, setStats] = useState({ viewers: 0, gifts: 0, follows: 0, messages: 0, likes: 0 });
  const [log, setLog] = useState([]);
  const [lAnim, setLAnim] = useState(false);
  const [fh, setFh] = useState([]);
  const [totDia, setTotDia] = useState(() => ld("totDia", 0));
  const [totLike, setTotLike] = useState(() => ld("totLike", 0));
  const [tapR, setTapR] = useState(() => ld("tapR", []));
  const [likeR, setLikeR] = useState(() => ld("likeR", []));
  const [viewR, setViewR] = useState(() => ld("viewR", []));
  const [topViewers, setTopViewers] = useState([]);
  const [vTab, setVTab] = useState("historial");
  const [ttsMode, setTtsMode] = useState(() => ld("ttsMode", "native"));
  const [ttsOn, setTtsOn] = useState(() => ld("ttsOn", true));
  const [ttsVol, setTtsVol] = useState(() => ld("ttsVol", 80));
  const [ttsVoice, setTtsVoice] = useState(() => ld("ttsVoice", "cgSgspJ2msm6clMCkdW9"));
  const [nativeVoices, setNativeVoices] = useState([]);
  const [nativeVoice, setNativeVoice] = useState(() => ld("nativeVoice", ""));
  const [elVoices, setElVoices] = useState(DEF_VOICES_EL);
  const [elOk, setElOk] = useState(null);
  const ttsOnR = useRef(ttsOn);
  const ttsVolR = useRef(ttsVol);
  const ttsModeR = useRef(ttsMode);
  const ttsVoiceR = useRef(ttsVoice);
  const nativeVoiceR = useRef(nativeVoice);
  const actsR = useRef([]);
  const likeUserMapR = useRef({});
  const alertsOnR = useRef(true);
  const [actions, setActions] = useState(() => ld("actions4", DEF_ACTIONS));
  const [alertsOn, setAlertsOn] = useState(() => ld("alertsOn", true));
  const [showM, setShowM] = useState(false);
  const [editA, setEditA] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [toast, setToast] = useState("");
  const [delConfirm, setDelConfirm] = useState(null);

  const showT = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  /* ─── Wake Lock ─── */
  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      if (wakeLockRef.current) return;
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setWakeLockOn(true);
      wakeLockRef.current.addEventListener('release', () => { wakeLockRef.current = null; setWakeLockOn(false); });
    } catch (e) { console.warn('Wake Lock error:', e.message); }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) { await wakeLockRef.current.release(); wakeLockRef.current = null; setWakeLockOn(false); }
  }, []);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
    document.addEventListener('visibilitychange', onVisible);
    requestWakeLock();
    return () => { document.removeEventListener('visibilitychange', onVisible); releaseWakeLock(); };
  }, [requestWakeLock, releaseWakeLock]);

  /* ─── Sync refs & localStorage ─── */
  useEffect(() => { ttsOnR.current = ttsOn; sv("ttsOn", ttsOn); }, [ttsOn]);
  useEffect(() => { ttsVolR.current = ttsVol; sv("ttsVol", ttsVol); }, [ttsVol]);
  useEffect(() => { ttsModeR.current = ttsMode; sv("ttsMode", ttsMode); }, [ttsMode]);
  useEffect(() => { ttsVoiceR.current = ttsVoice; sv("ttsVoice", ttsVoice); }, [ttsVoice]);
  useEffect(() => { nativeVoiceR.current = nativeVoice; sv("nativeVoice", nativeVoice); }, [nativeVoice]);
  useEffect(() => { actsR.current = actions; sv("actions4", actions); }, [actions]);
  useEffect(() => { alertsOnR.current = alertsOn; sv("alertsOn", alertsOn); }, [alertsOn]);
  useEffect(() => { sv("tab", tab); }, [tab]);
  useEffect(() => { sv("tuser", tUser); }, [tUser]);
  useEffect(() => { sv("sessid", sessId); }, [sessId]);
  useEffect(() => { sv("totDia", totDia); }, [totDia]);
  useEffect(() => { sv("totLike", totLike); }, [totLike]);
  useEffect(() => { sv("tapR", tapR); }, [tapR]);
  useEffect(() => { sv("likeR", likeR); }, [likeR]);
  useEffect(() => { sv("viewR", viewR); }, [viewR]);

  /* ─── Voces nativas ─── */
  useEffect(() => {
    const load = () => {
      const vs = window.speechSynthesis?.getVoices() || [];
      const esList = vs.filter(v => v.lang.startsWith("es") || v.lang.startsWith("en"));
      setNativeVoices(esList.length ? esList : vs);
      if (!nativeVoice && esList.length) {
        const def = esList.find(v => v.lang.startsWith("es-MX")) || esList[0];
        if (def) { setNativeVoice(def.name); nativeVoiceR.current = def.name; }
      }
    };
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);

  /* ─── Voces ElevenLabs ─── */
  useEffect(() => {
    if (ttsMode !== "elevenlabs") return;
    fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": EL_KEY } })
      .then(r => r.json())
      .then(d => {
        if (d.voices?.length) {
          const m = d.voices.map(v => ({ id: v.voice_id, name: v.name }));
          setElVoices([...DEF_VOICES_EL, ...m.filter(v => !DEF_VOICES_EL.find(x => x.id === v.id))]);
          setElOk(true);
        }
      })
      .catch(() => setElOk(false));
  }, [ttsMode]);

  useEffect(() => {
    if (!conn2) return;
    const t = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 400);
    return () => clearInterval(t);
  }, [conn2]);

  /* ─── fireAction ─── */
  const fireAction = useCallback((eventType, giftName = "", nickname = "", giftCount = 1) => {
    if (!alertsOnR.current) return;
    const acts = actsR.current.filter(a => a.enabled && a.event === eventType);
    for (const act of acts) {
      if (act.event === "Gift Alert") {
        const gn = (giftName || "").toLowerCase();
        const an = (act.giftName || "").toLowerCase();
        if (an !== "cualquier regalo" && !gn.includes(an) && !an.includes(gn)) continue;
        if (giftCount < act.minCount) continue;
      }
      if (act.soundData) playAudio(act.soundData, ttsVolR.current / 100);
      if (act.ttsOn && act.ttsText && ttsOnR.current) {
        const text = act.ttsText.replace(/@usuario/gi, nickname);
        if (ttsModeR.current === "elevenlabs") enqueueTTS(text, ttsVoiceR.current, ttsVolR.current / 100, "elevenlabs");
        else enqueueTTS(text, nativeVoiceR.current, ttsVolR.current / 100, "native");
      }
    }
  }, []);

  /* ─── Socket.IO ─── */
  useEffect(() => {
    const sock = io(SERVER, { transports: ["websocket"], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1500, reconnectionDelayMax: 8000, timeout: 12000 });
    sock.on("connect", () => console.log("Socket conectado:", sock.id));
    sock.on("connect_error", e => console.warn("Socket error:", e.message));
    sock.on("event", d => {
      if (d.type === "chat") {
        setLog(p => [{ t: "msg", tx: `💬 @${d.nickname || d.user}: ${d.comment}` }, ...p].slice(0, 50));
        setStats(p => ({ ...p, messages: p.messages + 1 }));
        if (ttsOnR.current) {
          const text = `${d.nickname || d.user} dice: ${d.comment}`;
          if (ttsModeR.current === "elevenlabs") enqueueTTS(text, ttsVoiceR.current, ttsVolR.current / 100, "elevenlabs");
          else enqueueTTS(text, nativeVoiceR.current, ttsVolR.current / 100, "native");
        }
      } else if (d.type === "gift") {
        setLog(p => [{ t: "gift", tx: `🎁 @${d.nickname || d.user} → ${d.giftCount}× ${d.giftName}` }, ...p].slice(0, 50));
        setStats(p => ({ ...p, gifts: p.gifts + 1 }));
        const dm = d.diamondCount || 0;
        setTotDia(p => p + dm);
        setTapR(prev => {
          const ex = prev.find(u => u.user === d.user);
          const upd = ex ? prev.map(u => u.user === d.user ? { ...u, diamonds: u.diamonds + dm, gifts: u.gifts + 1 } : u)
            : [...prev, { user: d.user, nickname: d.nickname || d.user, diamonds: dm, gifts: 1 }];
          return upd.sort((a, b) => b.diamonds - a.diamonds).slice(0, 10);
        });
        fireAction("Gift Alert", d.giftName, d.nickname || d.user, d.giftCount);
      } else if (d.type === "follow") {
        setLog(p => [{ t: "follow", tx: `➕ @${d.nickname || d.user} te siguió` }, ...p].slice(0, 50));
        setStats(p => ({ ...p, follows: p.follows + 1 }));
        fireAction("Follow Alert", "", d.nickname || d.user);
      } else if (d.type === "like") {
        const lc = d.likeCount || 1;
        setLog(p => [{ t: "like", tx: `❤️ ×${lc} likes de @${d.nickname || d.user}` }, ...p].slice(0, 50));
        setStats(p => ({ ...p, likes: p.likes + lc }));
        setTotLike(p => p + lc);
        setLAnim(true); setTimeout(() => setLAnim(false), 300);
        const hid = Date.now();
        setFh(p => [...p, { id: hid, x: Math.random() * 60 + 20 }]);
        setTimeout(() => setFh(p => p.filter(h => h.id !== hid)), 1200);
        setLikeR(prev => {
          const ex = prev.find(u => u.user === d.user);
          const nickname = d.nickname || d.user;
          const upd = ex ? prev.map(u => u.user === d.user ? { ...u, count: u.count + lc, nickname } : u)
            : [...prev, { user: d.user, nickname, count: lc }];
          return upd.sort((a, b) => b.count - a.count).slice(0, 10);
        });
        fireAction("Like Alert", "", d.nickname || d.user);
      } else if (d.type === "sub") {
        setLog(p => [{ t: "sub", tx: `⭐ @${d.nickname || d.user} se suscribió` }, ...p].slice(0, 50));
        fireAction("Sub Alert", "", d.nickname || d.user);
      } else if (d.type === "share") {
        setLog(p => [{ t: "share", tx: `📤 @${d.nickname || d.user} compartió` }, ...p].slice(0, 50));
        fireAction("Share Alert", "", d.nickname || d.user);
      }
    });
    sock.on("viewers", d => {
      setStats(p => ({ ...p, viewers: d.count || 0 }));
      if (Array.isArray(d.topViewers) && d.topViewers.length > 0)
        setTopViewers(d.topViewers.filter(v => v.user && v.user !== "?"));
    });
    sock.on("member", d => {
      if (!d.user) return;
      setViewR(prev => {
        const ex = prev.find(u => u.user === d.user);
        if (ex) return prev.map(u => u.user === d.user ? { ...u, joinTime: d.timestamp || Date.now() } : u);
        return [{ user: d.user, nickname: d.nickname || d.user, joinTime: d.timestamp || Date.now() }, ...prev].slice(0, 300);
      });
    });
    sock.on("battle", d => {
      if (d && d.teams) {
        setBattle({
          ...d,
          ownerUsername: (d.ownerUsername || tUser || "").toLowerCase().replace(/^@/, ""),
          teams: d.teams.map(t => ({
            hostName: t.hostName || t.uniqueId || t.displayId || "?",
            hostNickname: t.hostNickname || t.nickname || t.hostName || "?",
            points: Number(t.points || t.battleScore || t.score || 0),
          })).filter(t => t.hostName !== "?"),
        });
      } else { setBattle(d); }
    });
    sock.on("tiktok_disconnected", d => {
      setConn(false);
      setLog(p => [{ t: "sys", tx: `⚠️ TikTok desconectado (@${d?.username || "?"}). Reconecta.` }, ...p].slice(0, 50));
    });
    sock.on("tiktok_error", d => {
      setLog(p => [{ t: "sys", tx: `⚠️ Error: ${d.message}` }, ...p].slice(0, 50));
    });
    return () => sock.disconnect();
  }, [fireAction]);

  /* ─── Restaurar sesión ─── */
  useEffect(() => {
    const savedUser = ld("tuser", "");
    if (!savedUser) return;
    fetch(`${SERVER}/status/${encodeURIComponent(savedUser)}`)
      .then(r => r.json())
      .then(d => { if (d.connected) { setConn(true); setLog([{ t: "sys", tx: `✅ Sesión restaurada @${savedUser}` }]); } })
      .catch(() => { });
  }, []);

  /* ─── Conectar/Desconectar ─── */
  const connect = async () => {
    if (!tUser.trim()) return;
    setConn2(true); setConnErr("");
    try {
      const r = await fetch(`${SERVER}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: tUser.trim(), sessionId: sessId.trim() || undefined }),
      });
      const d = await r.json();
      if (d.success) {
        setConn2(false); setConn(true);
        setStats({ viewers: 0, gifts: 0, follows: 0, messages: 0, likes: 0 });
        setTopViewers([]); setTotDia(0); setTotLike(0); setTapR([]); setLikeR([]);
        setBattle(null); likeUserMapR.current = {};
        setViewR([]); sv("viewR", []);
        setLog([{ t: "sys", tx: `✅ Conectado a @${tUser}` }]);
      } else {
        setConn2(false); setConnErr(d.error || "¿Estás en LIVE?");
        setLog(p => [{ t: "sys", tx: `⚠️ ${d.error || "¿Estás en LIVE?"}` }, ...p]);
      }
    } catch (e) {
      setConn2(false); setConnErr("Sin respuesta del servidor");
      setLog(p => [{ t: "sys", tx: "⚠️ Sin respuesta del servidor" }, ...p]);
    }
  };

  const disconnect = async () => {
    await fetch(`${SERVER}/disconnect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: tUser }) }).catch(() => { });
    setConn(false); setLog([]); setStats({ viewers: 0, gifts: 0, follows: 0, messages: 0, likes: 0 });
    setTotDia(0); setTotLike(0);
  };

  /* ─── Acciones CRUD ─── */
  const saveAction = (form) => {
    if (form.id && actions.find(a => a.id === form.id)) {
      setActions(p => p.map(a => a.id === form.id ? form : a));
      showT("✅ Acción actualizada");
    } else {
      setActions(p => [...p, { ...form, id: Date.now() }]);
      showT("✅ Acción creada");
    }
    setShowM(false); setEditA(null);
  };

  const deleteAction = (id) => { setActions(p => p.filter(a => a.id !== id)); setDelConfirm(null); showT("🗑️ Acción eliminada"); };

  const testAction = (act) => {
    if (act.soundData) playAudio(act.soundData, ttsVol / 100);
    if (act.ttsOn && act.ttsText) {
      const text = act.ttsText.replace(/@usuario/gi, "UsuarioPrueba");
      enqueueTTS(text, ttsMode === "elevenlabs" ? ttsVoice : nativeVoice, ttsVol / 100, ttsMode);
    }
    showT(`▶ Probando: ${act.name}`);
  };

  if (!user) return <Login onLogin={u => { sv("session", u); setUser(u); }} />;

  const TABS = [
    { id: "dashboard", icon: "⚡", l: "Dashboard" },
    { id: "acciones", icon: "🎬", l: "Acciones" },
    { id: "tts", icon: "🔊", l: "Voz & Audio" },
    { id: "ranking", icon: "🏆", l: "Ranking" },
    { id: "chat", icon: "💬", l: "Chat" },
    { id: "batalla", icon: "⚔️", l: "Batalla" },
    { id: "espect", icon: "👁️", l: "Espectadores" },
  ];

  const LC = { gift: "rgba(254,44,85,.08)", follow: "rgba(37,244,238,.08)", msg: "rgba(255,255,255,.02)", like: "rgba(254,44,85,.05)", sub: "rgba(139,92,246,.08)", share: "rgba(255,255,255,.04)", sys: "rgba(37,244,238,.06)" };
  const LB = { gift: "#fe2c55", follow: "#25f4ee", msg: "#2a2a3a", like: "#fe2c55", sub: "#8b5cf6", share: "#666", sys: "#25f4ee" };
  const bCls = ev => ev.startsWith("Follow") ? "bf" : ev.startsWith("Gift") ? "bg" : ev.startsWith("Like") ? "bl" : ev.startsWith("Sub") ? "bs" : "bsh";
  const bIco = ev => ev.startsWith("Follow") ? "➕" : ev.startsWith("Gift") ? "🎁" : ev.startsWith("Like") ? "❤️" : ev.startsWith("Sub") ? "⭐" : "📤";
  const C = { background: "#12121e", border: "1px solid #1e1e2e", borderRadius: 14, padding: 15, marginBottom: 12 };
  const lbl = { display: "block", color: "#556", fontSize: 9, fontWeight: 700, letterSpacing: .8, textTransform: "uppercase", marginBottom: 5 };
  const inp = { width: "100%", background: "#0a0a0f", border: "1px solid #252535", borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 12, outline: "none" };
  const fActs = actions.filter(a => a.name.toLowerCase().includes(searchQ.toLowerCase()));

  /* ─── TABS CONTENT ─── */
  const renderTab = () => {
    if (tab === "dashboard") return (
      <div style={{ padding: "12px 12px 80px" }}>
        {/* Conexión */}
        <div style={C}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#556", letterSpacing: .8, textTransform: "uppercase", marginBottom: 10 }}>Conectar TikTok LIVE</div>
          <div style={{ display: "flex", gap: 7, marginBottom: 8 }}>
            <input value={tUser} onChange={e => setTUser(e.target.value.replace(/^@/, ""))}
              placeholder="@usuario" style={{ ...inp, flex: 1 }} disabled={conn || conn2} />
            {conn
              ? <button onClick={disconnect} style={{ background: "rgba(254,44,85,.1)", border: "1px solid rgba(254,44,85,.3)", borderRadius: 8, padding: "0 14px", color: "#fe2c55", fontWeight: 700, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}>Desconectar</button>
              : <button onClick={connect} disabled={conn2 || !tUser.trim()} style={{ background: conn2 ? "#1a1a28" : "linear-gradient(135deg,#fe2c55,#ff6b81)", border: "none", borderRadius: 8, padding: "0 16px", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 11, opacity: !tUser.trim() ? .4 : 1 }}>
                {conn2 ? `Conectando${dots}` : "Conectar"}
              </button>}
          </div>
          {connErr && <div style={{ color: "#fe2c55", fontSize: 11, marginBottom: 6 }}>⚠️ {connErr}</div>}
          {conn && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(37,244,238,.05)", border: "1px solid rgba(37,244,238,.15)", borderRadius: 8, padding: "5px 10px" }}>
                <div className="ld" style={{ width: 6, height: 6, borderRadius: "50%", background: "#25f4ee", boxShadow: "0 0 8px #25f4ee" }} />
                <span style={{ fontSize: 10, color: "#25f4ee", fontWeight: 700 }}>EN VIVO</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,.03)", border: "1px solid #1e1e2e", borderRadius: 8, padding: "5px 10px" }}>
                <span style={{ fontSize: 10, color: "#aaa" }}>👁️ {stats.viewers}</span>
              </div>
              {wakeLockOn && <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(245,197,24,.05)", border: "1px solid rgba(245,197,24,.15)", borderRadius: 8, padding: "5px 10px" }}>
                <span style={{ fontSize: 10, color: "#f5c518" }}>🔆 Pantalla activa</span>
              </div>}
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Espectadores", value: stats.viewers, icon: "👁️", color: "#25f4ee" },
            { label: "Regalos", value: stats.gifts, icon: "🎁", color: "#fe2c55" },
            { label: "Seguidores", value: stats.follows, icon: "➕", color: "#4ade80" },
            { label: "Mensajes", value: stats.messages, icon: "💬", color: "#8b5cf6" },
          ].map(s => (
            <div key={s.label} style={{ background: "#12121e", border: "1px solid #1e1e2e", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: s.color }}>{s.value.toLocaleString()}</div>
              <div style={{ fontSize: 9, color: "#444", fontWeight: 700, letterSpacing: .5, textTransform: "uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Diamantes y likes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div style={{ ...C, marginBottom: 0, textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 2 }}>💎</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20, color: "#25f4ee" }}>{totDia.toLocaleString()}</div>
            <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: .5 }}>Diamantes</div>
          </div>
          <div style={{ ...C, marginBottom: 0, textAlign: "center", position: "relative", overflow: "hidden" }}>
            {fh.map(h => <div key={h.id} className="fh" style={{ left: h.x + "%" }}>❤️</div>)}
            <div className={lAnim ? "hpa" : ""} style={{ fontSize: 22, marginBottom: 2, display: "inline-block" }}>❤️</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20, color: "#fe2c55" }}>{totLike.toLocaleString()}</div>
            <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: .5 }}>Likes</div>
          </div>
        </div>

        {/* Log */}
        <div style={C}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#556", letterSpacing: .8, textTransform: "uppercase", marginBottom: 8 }}>Actividad reciente</div>
          {log.length === 0
            ? <div style={{ color: "#333", fontSize: 11, textAlign: "center", padding: "20px 0" }}>Sin actividad aún</div>
            : log.slice(0, 12).map((l, i) => (
              <div key={i} style={{ background: LC[l.t] || "#0a0a0f", borderLeft: `2px solid ${LB[l.t] || "#222"}`, borderRadius: 6, padding: "6px 9px", marginBottom: 4, fontSize: 11, color: "#bbb" }}>{l.tx}</div>
            ))}
        </div>
      </div>
    );

    if (tab === "acciones") return (
      <div style={{ padding: "12px 12px 80px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="🔍 Buscar acción..." style={{ ...inp, flex: 1 }} />
          <button onClick={() => { setEditA(null); setShowM(true); }}
            style={{ background: "linear-gradient(135deg,#fe2c55,#ff6b81)", border: "none", borderRadius: 8, padding: "0 14px", height: 36, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}>
            + Nueva
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Toggle on={alertsOn} onChange={() => setAlertsOn(p => !p)} size="sm" />
          <span style={{ fontSize: 10, color: alertsOn ? "#25f4ee" : "#555", fontWeight: 700 }}>{alertsOn ? "Alertas activas" : "Alertas pausadas"}</span>
        </div>
        <div style={{ background: "#12121e", border: "1px solid #1e1e2e", borderRadius: 12, overflow: "hidden" }}>
          {fActs.length === 0
            ? <div style={{ color: "#333", fontSize: 11, textAlign: "center", padding: "30px 0" }}>Sin acciones. Toca + Nueva.</div>
            : fActs.map(act => (
              <div key={act.id} className={`tr ${act.enabled ? "" : "dis"}`}>
                <Toggle on={act.enabled} onChange={() => setActions(p => p.map(a => a.id === act.id ? { ...a, enabled: !a.enabled } : a))} size="sm" color="#fe2c55" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{act.name}</div>
                  <div style={{ fontSize: 9, color: "#444", marginTop: 1 }}>{act.event === "Gift Alert" && act.giftName ? act.giftName : act.event}</div>
                </div>
                <span className={`badge ${bCls(act.event)}`}>{bIco(act.event)} {act.event.replace(" Alert", "")}</span>
                <span style={{ fontSize: 9, color: "#555", textAlign: "center" }}>{act.duration}s</span>
                <span style={{ fontSize: 11, textAlign: "center" }}>{act.soundData ? "🎵" : "—"}</span>
                <span style={{ fontSize: 11, textAlign: "center" }}>{act.ttsOn ? "🔊" : "—"}</span>
                <div style={{ display: "flex", gap: 3, justifyContent: "flex-end" }}>
                  <IBtn ico="▶" onClick={() => testAction(act)} color="#25f4ee" title="Probar" />
                  <IBtn ico="✏️" onClick={() => { setEditA(act); setShowM(true); }} color="#aaa" title="Editar" />
                  <IBtn ico="🗑" onClick={() => setDelConfirm(act.id)} color="#fe2c55" title="Eliminar" />
                </div>
              </div>
            ))}
        </div>
      </div>
    );

    if (tab === "tts") return (
      <div style={{ padding: "12px 12px 80px" }}>
        <div style={C}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#556", letterSpacing: .8, textTransform: "uppercase", marginBottom: 10 }}>Motor de voz</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {["native", "elevenlabs"].map(m => (
              <button key={m} className={`mode-btn ${ttsMode === m ? "act" : ""}`} onClick={() => setTtsMode(m)}>
                {m === "native" ? "🔈 Navegador (Gratis)" : "⭐ ElevenLabs (HD)"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: "#aaa" }}>TTS en chat activado</span>
            <Toggle on={ttsOn} onChange={() => setTtsOn(p => !p)} size="sm" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>Volumen ({ttsVol}%)</label>
            <input type="range" min="0" max="100" value={ttsVol} onChange={e => setTtsVol(Number(e.target.value))} style={{ width: "100%", accentColor: "#fe2c55" }} />
          </div>
          {ttsMode === "native" && nativeVoices.length > 0 && (
            <div>
              <label style={lbl}>Voz del sistema</label>
              <select value={nativeVoice} onChange={e => setNativeVoice(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                {nativeVoices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
              </select>
            </div>
          )}
          {ttsMode === "elevenlabs" && (
            <div>
              <label style={lbl}>Voz ElevenLabs {elOk === true ? "✅" : elOk === false ? "❌" : ""}</label>
              <select value={ttsVoice} onChange={e => setTtsVoice(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
                {elVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <button onClick={() => enqueueTTS("Hola, soy tu TTS de TikPanel. Todo funciona.", ttsMode === "elevenlabs" ? ttsVoice : nativeVoice, ttsVol / 100, ttsMode)}
          style={{ width: "100%", background: "rgba(37,244,238,.08)", border: "1px solid rgba(37,244,238,.2)", borderRadius: 10, padding: 12, color: "#25f4ee", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
          🔊 Probar TTS
        </button>
      </div>
    );

    if (tab === "ranking") return (
      <div style={{ padding: "12px 12px 80px" }}>
        <div style={C}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#fe2c55", letterSpacing: .8, textTransform: "uppercase", marginBottom: 8 }}>💎 Top Donadores</div>
          {tapR.length === 0
            ? <div style={{ color: "#333", fontSize: 11, textAlign: "center", padding: "16px 0" }}>Sin regalos aún</div>
            : tapR.map((u, i) => (
              <div key={u.user} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderBottom: "1px solid #0f0f1a" }}>
                <div style={{ width: 20, textAlign: "center", fontSize: i < 3 ? 14 : 10, color: i === 0 ? "#f5c518" : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : "#444" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </div>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{u.nickname}</div>
                <div style={{ fontSize: 11, color: "#25f4ee", fontWeight: 700 }}>💎 {u.diamonds.toLocaleString()}</div>
              </div>
            ))}
        </div>
        <div style={C}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#fe2c55", letterSpacing: .8, textTransform: "uppercase", marginBottom: 8 }}>❤️ Top Likes</div>
          {likeR.length === 0
            ? <div style={{ color: "#333", fontSize: 11, textAlign: "center", padding: "16px 0" }}>Sin likes aún</div>
            : likeR.map((u, i) => (
              <div key={u.user} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderBottom: "1px solid #0f0f1a" }}>
                <div style={{ width: 20, textAlign: "center", fontSize: i < 3 ? 14 : 10, color: i === 0 ? "#f5c518" : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : "#444" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </div>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{u.nickname}</div>
                <div style={{ fontSize: 11, color: "#fe2c55", fontWeight: 700 }}>❤️ {u.count.toLocaleString()}</div>
              </div>
            ))}
        </div>
      </div>
    );

    if (tab === "chat") return (
      <div style={{ padding: "12px 12px 80px" }}>
        <div style={C}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#556", letterSpacing: .8, textTransform: "uppercase", marginBottom: 8 }}>Chat en vivo</div>
          {log.filter(l => l.t === "msg").length === 0
            ? <div style={{ color: "#333", fontSize: 11, textAlign: "center", padding: "20px 0" }}>Sin mensajes aún</div>
            : log.filter(l => l.t === "msg").map((l, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,.02)", borderLeft: "2px solid #2a2a3a", borderRadius: 6, padding: "6px 9px", marginBottom: 4, fontSize: 11, color: "#bbb" }}>{l.tx}</div>
            ))}
        </div>
      </div>
    );

    if (tab === "batalla") return (
      <div style={{ padding: "12px 12px 80px" }}>
        <div style={C}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#fe2c55", letterSpacing: .8, textTransform: "uppercase", marginBottom: 10 }}>⚔️ Batalla en vivo</div>
          {!battle
            ? <div style={{ color: "#555", fontSize: 12, textAlign: "center", padding: "20px 0" }}>Sin batalla activa</div>
            : battle.teams && battle.teams.length >= 2
              ? (() => {
                const total = battle.teams.reduce((s, t) => s + t.points, 0) || 1;
                return (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      {battle.teams.map((t, i) => (
                        <div key={i} style={{ textAlign: i === 0 ? "left" : "right", flex: 1 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? "#25f4ee" : "#fe2c55" }}>@{t.hostName}</div>
                          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20 }}>💎 {t.points.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: "#1a1a28", borderRadius: 20, height: 12, overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ width: `${(battle.teams[0].points / total) * 100}%`, height: "100%", background: "linear-gradient(90deg,#25f4ee,#fe2c55)", transition: "width .5s", borderRadius: 20 }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#444" }}>
                      <span>{((battle.teams[0].points / total) * 100).toFixed(1)}%</span>
                      <span>{((battle.teams[1].points / total) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })()
              : <div style={{ color: "#555", fontSize: 11 }}>Esperando datos de batalla…</div>}
        </div>
      </div>
    );

    if (tab === "espect") return (
      <div style={{ padding: "12px 12px 80px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {["historial", "activos"].map(t => (
            <button key={t} className={`mode-btn ${vTab === t ? "act" : ""}`} onClick={() => setVTab(t)}>
              {t === "historial" ? "📋 Historial" : "👁️ Activos"}
            </button>
          ))}
        </div>
        <div style={C}>
          {vTab === "historial"
            ? viewR.length === 0
              ? <div style={{ color: "#333", fontSize: 11, textAlign: "center", padding: "20px 0" }}>Sin espectadores registrados</div>
              : viewR.slice(0, 50).map((v, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #0f0f1a" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#555", flexShrink: 0 }}>{v.nickname?.charAt(0)?.toUpperCase() || "?"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.nickname}</div>
                    <div style={{ fontSize: 9, color: "#444" }}>{v.joinTime ? new Date(v.joinTime).toLocaleTimeString() : ""}</div>
                  </div>
                </div>
              ))
            : topViewers.length === 0
              ? <div style={{ color: "#333", fontSize: 11, textAlign: "center", padding: "20px 0" }}>Sin espectadores activos</div>
              : topViewers.map((v, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #0f0f1a" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#25f4ee", flexShrink: 0 }}>{v.nickname?.charAt(0)?.toUpperCase() || "?"}</div>
                  <div style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>{v.nickname || v.user}</div>
                </div>
              ))}
        </div>
      </div>
    );

    return null;
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0a0f" }}>
      {/* Modales */}
      {showM && <ActModal action={editA} ttsMode={ttsMode} ttsVoiceId={ttsVoice} ttsNativeVoice={nativeVoice} vol={ttsVol} onSave={saveAction} onClose={() => { setShowM(false); setEditA(null); }} />}
      {delConfirm && (
        <div className="mo" onClick={() => setDelConfirm(null)}>
          <div className="mb" style={{ maxWidth: 320 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🗑️</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Eliminar acción</div>
              <div style={{ color: "#555", fontSize: 12 }}>¿Eliminar <span style={{ color: "#fff", fontWeight: 700 }}>"{actions.find(a => a.id === delConfirm)?.name}"</span>? No se puede deshacer.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setDelConfirm(null)} style={{ flex: 1, background: "transparent", border: "1px solid #252535", borderRadius: 9, padding: "10px", color: "#555", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Cancelar</button>
              <button onClick={() => deleteAction(delConfirm)} style={{ flex: 1, background: "rgba(254,44,85,.15)", border: "1px solid rgba(254,44,85,.35)", borderRadius: 9, padding: "10px", color: "#fe2c55", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
      {sb && <div onClick={() => setSb(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 40 }} />}

      {/* Sidebar */}
      <div style={{ width: 215, background: "#0d0d18", borderRight: "1px solid #1a1a28", display: "flex", flexDirection: "column", padding: "13px 10px", position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 50, transform: sb ? "translateX(0)" : "translateX(-100%)", transition: "transform .28s ease" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14, paddingLeft: 2 }}>
          <div style={{ width: 27, height: 27, borderRadius: 7, background: "linear-gradient(135deg,#fe2c55,#25f4ee)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 13 }}>T</div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, letterSpacing: -.5 }}>ik<span style={{ color: "#fe2c55" }}>Panel</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#1a1a28", borderRadius: 9, padding: "7px 9px", marginBottom: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#fe2c55,#25f4ee)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11 }}>{user.avatar}</div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name}</div>
            <div style={{ fontSize: 9, color: "#fe2c55", fontWeight: 600, marginTop: 1 }}>{user.plan}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: conn ? "rgba(37,244,238,.05)" : "rgba(255,255,255,.02)", border: `1px solid ${conn ? "rgba(37,244,238,.18)" : "#1a1a28"}`, borderRadius: 20, padding: "4px 9px", fontSize: 9, color: conn ? "#25f4ee" : "#444", marginBottom: 12, overflow: "hidden" }}>
          <div className={conn ? "ld" : ""} style={{ width: 5, height: 5, borderRadius: "50%", flexShrink: 0, background: conn ? "#25f4ee" : "#252535", boxShadow: conn ? "0 0 7px #25f4ee" : "none" }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conn ? `@${tUser}` : "Sin conexión"}</span>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSb(false); }}
              style={{ display: "flex", alignItems: "center", gap: 7, background: tab === t.id ? "rgba(254,44,85,.1)" : "transparent", border: tab === t.id ? "1px solid rgba(254,44,85,.18)" : "1px solid transparent", borderRadius: 8, padding: "8px 8px", color: tab === t.id ? "#fff" : "#555", cursor: "pointer", fontSize: 11, fontWeight: tab === t.id ? 700 : 500, textAlign: "left" }}>
              <span style={{ fontSize: 13 }}>{t.icon}</span>{t.l}
            </button>
          ))}
        </nav>
        <button onClick={() => { localStorage.removeItem("tp_session"); setUser(null); }}
          style={{ background: "transparent", border: "1px solid #1a1a28", borderRadius: 7, padding: "6px 8px", color: "#444", cursor: "pointer", fontSize: 10, marginTop: 5 }}>
          Cerrar sesión
        </button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderBottom: "1px solid #1a1a28", background: "#0a0a0f", position: "sticky", top: 0, zIndex: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setSb(!sb)} style={{ background: "#1a1a28", border: "1px solid #252535", borderRadius: 6, width: 29, height: 29, cursor: "pointer", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>☰</button>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: "linear-gradient(135deg,#fe2c55,#25f4ee)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 10 }}>T</div>
              <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 13 }}>ik<span style={{ color: "#fe2c55" }}>Panel</span></span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {conn && <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(37,244,238,.05)", border: "1px solid rgba(37,244,238,.15)", borderRadius: 20, padding: "3px 8px" }}>
              <div className="ld" style={{ width: 5, height: 5, borderRadius: "50%", background: "#25f4ee" }} />
              <span style={{ fontSize: 9, color: "#25f4ee", fontWeight: 700 }}>LIVE</span>
            </div>}
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#fe2c55,#25f4ee)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11 }}>{user.avatar}</div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {renderTab()}
        </div>

        {/* Bottom nav */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0d0d18", borderTop: "1px solid #1a1a28", display: "flex", zIndex: 30 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, background: "transparent", border: "none", padding: "10px 4px 8px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span style={{ fontSize: 8, color: tab === t.id ? "#fe2c55" : "#333", fontWeight: 700, letterSpacing: .3 }}>{t.l}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
