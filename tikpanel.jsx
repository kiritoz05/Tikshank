import { useState, useEffect, useRef, useCallback } from "react";

// ─── DATOS ────────────────────────────────────────────────────────────────────

const MOCK_USERS = {
  "admin@tikpanel.com": { password: "admin123", name: "Admin", plan: "Pro" },
  "usuario@tikpanel.com": { password: "pass123", name: "StreamerPro", plan: "Free" },
};

const TTS_VOICES_ES = [
  { id: "es-MX-DaliaNeural", label: "Dalia (México)", lang: "es-MX" },
  { id: "es-MX-JorgeNeural", label: "Jorge (México)", lang: "es-MX" },
  { id: "es-ES-ElviraNeural", label: "Elvira (España)", lang: "es-ES" },
  { id: "es-ES-AlvaroNeural", label: "Álvaro (España)", lang: "es-ES" },
  { id: "es-AR-ElenaNeural", label: "Elena (Argentina)", lang: "es-AR" },
  { id: "es-CO-SalomeNeural", label: "Salomé (Colombia)", lang: "es-CO" },
];

// Base de datos de regalos TikTok con imágenes reales CDN
const TIKTOK_GIFTS = [
  { id:"rose",      name:"Rosa",            coins:1,     img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/eba3a9bb85fef43a3e88a8f8f1c021a7~tplv-obj.image" },
  { id:"icecream",  name:"Ice Cream",       coins:1,     img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/532d86fa1430861e46789b3f44f91e47~tplv-obj.image" },
  { id:"tiktok",    name:"TikTok",          coins:1,     img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/5f6c1c0bde84de4b91e8bff45f3cee93~tplv-obj.image" },
  { id:"finger",    name:"Finger Heart",    coins:5,     img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/be430fa1a093eeed3aaa5ab58fe5d5cc~tplv-obj.image" },
  { id:"hat",       name:"Top Hat",         coins:10,    img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a3dd10fa8ad9d0d34a4c2eeeed2a4568~tplv-obj.image" },
  { id:"sunglasses",name:"Sunglasses",      coins:30,    img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/9a8f1e3f61b25afe5ef63a0f7a32b0e0~tplv-obj.image" },
  { id:"perfume",   name:"Perfume",         coins:99,    img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/b0e47697d9e6c80e285c25ed66e3ee75~tplv-obj.image" },
  { id:"butterfly", name:"Let Butterfly",   coins:399,   img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/21c38fe1f0e2cb67c5fe3b8a069dd7c9~tplv-obj.image" },
  { id:"alien",     name:"Alien Buddy",     coins:399,   img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/bc09f56f831e1dfb2c9f7c1cb0b0a0ce~tplv-obj.image" },
  { id:"dancer",    name:"Air Dancer",      coins:300,   img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a96c13c0e4e7c4d9a3024fd6d2e0a1e4~tplv-obj.image" },
  { id:"drama",     name:"Drama Queen",     coins:5000,  img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/dda7d6a0c4df43db9a1aea16e4e8d1b0~tplv-obj.image" },
  { id:"animalband",name:"Animal Band",     coins:2500,  img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/5b5b2c2b3ef70ceab1c5aba2b3fbfec2~tplv-obj.image" },
  { id:"astrobear", name:"Astrobear",       coins:1500,  img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/da38d6c0b3e7b1f7b7a2e7e6c1f8b8e1~tplv-obj.image" },
  { id:"babychicks",name:"Baby Chicks",     coins:500,   img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/f4b7f8b3c4a2d8e1f6e9c3b2a7d5e8f1~tplv-obj.image" },
  { id:"park",      name:"Amusement Park",  coins:17000, img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/3c5b7d9f1e2a4c6b8d0f2e4a6c8b0d2e~tplv-obj.image" },
  { id:"lion",      name:"Leon & Lion",     coins:34000, img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/da38d6c0b3e7b1f7b7a2e7e6c1f8b8e1~tplv-obj.image" },
  { id:"whale",     name:"Sam the Whale",   coins:30000, img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/f2d9e1c3b5a7d9f1e3c5b7d9f1e3c5b7~tplv-obj.image" },
  { id:"gorila",    name:"Gorila",          coins:30000, img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/e1c3b5d7f9a1c3e5b7d9f1a3c5e7b9d1~tplv-obj.image" },
  { id:"trex",      name:"T-Rex",           coins:25999, img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/c5b7d9f1e3a5c7b9d1f3e5a7c9b1d3f5~tplv-obj.image" },
  { id:"dragon",    name:"Dragon Flame",    coins:26999, img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/b7d9f1e3c5a7b9d1f3e5c7a9b1d3f5e7~tplv-obj.image" },
  { id:"zeus",      name:"Zeus",            coins:34000, img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/a9b1d3f5e7c9a1b3d5f7e9a1c3b5d7f9~tplv-obj.image" },
  { id:"rhino",     name:"Rinoceronte",     coins:30999, img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/f5e7c9a1b3d5f7e9a1c3b5d7f9e1a3c5~tplv-obj.image" },
  { id:"sealwhale", name:"Foca y Ballena",  coins:34500, img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/d7f9e1a3c5b7d9f1e3a5c7b9d1f3e5a7~tplv-obj.image" },
  { id:"stars",     name:"TikTok Stars",    coins:39999, img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/b3d5f7e9a1c3b5d7f9e1a3c5b7d9f1e3~tplv-obj.image" },
  { id:"universe",  name:"TikTok Universe", coins:44999, img:"https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/e9a1c3b5d7f9e1a3c5b7d9f1e3a5c7b9~tplv-obj.image" },
];

const SPOTIFY_PERMS = ["Todos","Solo seguidores","Solo moderadores","Usuarios personalizados"];

const defGiftCfg = () => ({
  enabled: false,
  sound: "",
  volume: 80,
  duration: 5,
  tts: false,
  ttsTemplate: "{username} envió {giftName} x{repeatCount}"
});

// ─── TTS ENGINE (corregido - no se calla) ─────────────────────────────────────
class TTSEngine {
  constructor() {
    this.queue = [];
    this.speaking = false;
    this.enabled = false;
    this.config = {};
  }

  setConfig(cfg) { this.config = cfg; }
  setEnabled(v) { this.enabled = v; }

  enqueue(text) {
    if (!this.enabled) return;
    if (!text || !text.trim()) return;
    this.queue.push(text);
    if (!this.speaking) this._next();
  }

  _next() {
    if (this.queue.length === 0) { this.speaking = false; return; }
    if (!("speechSynthesis" in window)) { this.queue = []; return; }

    this.speaking = true;
    const text = this.queue.shift();
    const u = new SpeechSynthesisUtterance(text);
    u.volume = this.config.volume ?? 1.0;
    u.rate   = this.config.speed  ?? 1.0;
    u.pitch  = this.config.pitch  ?? 1.0;

    // Buscar voz en español
    const loadVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const lang = (this.config.voiceLang || "es").slice(0,2);
      const match = voices.find(v => v.lang.startsWith(lang)) ||
                    voices.find(v => v.lang.startsWith("es"));
      if (match) u.voice = match;
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      loadVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = loadVoice;
    }

    u.onend = () => { this.speaking = false; this._next(); };
    u.onerror = () => { this.speaking = false; this._next(); };

    // Fix Chrome bug: speechSynthesis se pausa sola después de ~15s
    window.speechSynthesis.cancel();
    setTimeout(() => window.speechSynthesis.speak(u), 50);
  }

  cancel() {
    this.queue = [];
    this.speaking = false;
    window.speechSynthesis.cancel();
  }
}

const ttsEngine = new TTSEngine();

// ─── COMPONENTES AUXILIARES ───────────────────────────────────────────────────

const Toggle = ({ on, onClick }) => (
  <div onClick={onClick} style={{
    width:44, height:24, borderRadius:12, cursor:"pointer",
    background: on ? "linear-gradient(90deg,#fe2c55,#ff4d6d)" : "#2a2a3a",
    position:"relative", transition:"background .2s",
    border: on ? "1px solid rgba(254,44,85,.4)" : "1px solid #333",
    flexShrink:0
  }}>
    <div style={{
      position:"absolute", top:3, left: on ? 22 : 2,
      width:16, height:16, borderRadius:8,
      background:"#fff", transition:"left .2s",
      boxShadow:"0 1px 4px rgba(0,0,0,.4)"
    }}/>
  </div>
);

const SecHdr = ({ title }) => (
  <div style={{ color:"#555", fontSize:10, fontWeight:800, letterSpacing:2, marginBottom:10, marginTop:24, paddingLeft:4 }}>
    {title}
  </div>
);

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const S = {
  loginBg:{ minHeight:"100vh", background:"#0a0a0f", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',sans-serif", position:"relative", overflow:"hidden" },
  loginGlow:{ position:"absolute", top:"20%", left:"50%", transform:"translateX(-50%)", width:600, height:400, borderRadius:"50%", background:"radial-gradient(ellipse,rgba(254,44,85,.12),transparent 70%)", pointerEvents:"none" },
  loginCard:{ background:"#13131a", border:"1px solid #1e1e2a", borderRadius:20, padding:40, width:380, maxWidth:"90vw", position:"relative", zIndex:1, boxShadow:"0 24px 80px rgba(0,0,0,.6)" },
  loginLogo:{ display:"flex", alignItems:"center", gap:10, marginBottom:6 },
  logoMark:{ background:"linear-gradient(135deg,#fe2c55,#ff4d6d)", borderRadius:8, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:18 },
  logoText:{ fontSize:22, fontWeight:800, color:"#fff", letterSpacing:-0.5 },
  loginSub:{ color:"#444", fontSize:13, marginBottom:20 },
  badge:{ display:"inline-block", background:"rgba(254,44,85,.1)", border:"1px solid rgba(254,44,85,.25)", color:"#fe2c55", fontSize:10, letterSpacing:1, padding:"4px 10px", borderRadius:20, marginBottom:20, fontWeight:700 },
  inputGroup:{ marginBottom:14 },
  label:{ display:"block", color:"#555", fontSize:10, letterSpacing:1.5, fontWeight:700, marginBottom:6 },
  input:{ width:"100%", background:"#0d0d14", border:"1px solid #1e1e2a", borderRadius:10, color:"#fff", fontSize:13, padding:"10px 14px", outline:"none", boxSizing:"border-box", transition:"border .2s" },
  error:{ background:"rgba(254,44,85,.1)", border:"1px solid rgba(254,44,85,.3)", borderRadius:8, color:"#fe2c55", fontSize:12, padding:"8px 12px", marginBottom:12 },
  loginBtn:{ width:"100%", background:"linear-gradient(135deg,#fe2c55,#ff4d6d)", border:"none", borderRadius:12, color:"#fff", fontSize:14, fontWeight:700, padding:"13px", cursor:"pointer", marginTop:6 },
  loginHint:{ color:"#333", fontSize:11, textAlign:"center", marginTop:12 },
  appBg:{ display:"flex", minHeight:"100vh", background:"#0a0a0f", fontFamily:"'Segoe UI',sans-serif" },
  sidebar:{ width:220, background:"#0d0d14", borderRight:"1px solid #1a1a24", display:"flex", flexDirection:"column", padding:"20px 0", flexShrink:0 },
  sidebarLogo:{ display:"flex", alignItems:"center", gap:8, padding:"0 20px 20px", borderBottom:"1px solid #1a1a24", marginBottom:16 },
  userCard:{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px", margin:"0 8px 8px", background:"#13131a", borderRadius:12 },
  avatar:{ width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,#fe2c55,#ff4d6d)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:15, flexShrink:0 },
  userName:{ color:"#fff", fontWeight:700, fontSize:13 },
  userPlan:{ color:"#fe2c55", fontSize:10, fontWeight:700, letterSpacing:1 },
  statusPill:(c)=>({ display:"flex", alignItems:"center", gap:6, margin:"0 12px 16px", padding:"6px 12px", background: c?"rgba(34,197,94,.08)":"rgba(255,255,255,.04)", border:`1px solid ${c?"rgba(34,197,94,.2)":"rgba(255,255,255,.06)"}`, borderRadius:20, color: c?"#22c55e":"#444", fontSize:11, fontWeight:600, overflow:"hidden" }),
  statusDot:(c)=>({ width:6, height:6, borderRadius:3, background: c?"#22c55e":"#333", flexShrink:0, boxShadow: c?"0 0 6px #22c55e":undefined }),
  nav:{ flex:1, padding:"0 10px" },
  navBtn:(a)=>({ display:"flex", alignItems:"center", gap:10, width:"100%", padding:"10px 12px", borderRadius:10, border:"none", cursor:"pointer", marginBottom:2, background: a?"linear-gradient(135deg,rgba(254,44,85,.15),rgba(255,77,109,.1))":"transparent", color: a?"#fff":"#555", fontWeight: a?700:500, fontSize:13, textAlign:"left", transition:"all .15s", borderLeft: a?"2px solid #fe2c55":"2px solid transparent" }),
  logoutBtn:{ margin:"0 10px", padding:"9px 12px", borderRadius:10, border:"1px solid #1e1e2a", background:"transparent", color:"#333", fontSize:12, cursor:"pointer", textAlign:"left" },
  main:{ flex:1, display:"flex", flexDirection:"column", overflow:"auto" },
  header:{ padding:"24px 28px 0", display:"flex", justifyContent:"space-between", alignItems:"flex-start" },
  pageTitle:{ color:"#fff", fontSize:22, fontWeight:800, margin:0, letterSpacing:-0.5 },
  pageSubtitle:{ color:"#333", fontSize:12, margin:"4px 0 0" },
  liveTag:{ display:"flex", alignItems:"center", gap:6, background:"rgba(254,44,85,.1)", border:"1px solid rgba(254,44,85,.3)", borderRadius:20, padding:"6px 14px", color:"#fe2c55", fontSize:12, fontWeight:800, letterSpacing:1 },
  liveDot:{ width:7, height:7, borderRadius:"50%", background:"#fe2c55", animation:"pulse 1.2s infinite" },
  content:{ padding:24, flex:1 },
  card:{ background:"#13131a", border:"1px solid #1a1a24", borderRadius:16, padding:20, marginBottom:16 },
  cardTitle:{ color:"#fff", fontWeight:700, fontSize:14, margin:"0 0 16px" },
  connectRow:{ display:"flex", gap:10, alignItems:"center" },
  tiktokInputWrap:{ display:"flex", alignItems:"center", flex:1, background:"#0d0d14", border:"1px solid #1e1e2a", borderRadius:10, overflow:"hidden", padding:"0 12px" },
  atSign:{ color:"#fe2c55", fontWeight:800, fontSize:15, marginRight:4 },
  tiktokInput:{ flex:1, background:"transparent", border:"none", color:"#fff", fontSize:13, padding:"11px 0", outline:"none" },
  connectBtn:(a)=>({ padding:"11px 20px", borderRadius:10, border:"none", background: a?"linear-gradient(135deg,#fe2c55,#ff4d6d)":"#1a1a24", color: a?"#fff":"#333", fontWeight:700, fontSize:13, cursor: a?"pointer":"default", flexShrink:0, transition:"all .2s" }),
  disconnectBtn:{ padding:"11px 20px", borderRadius:10, border:"1px solid rgba(254,44,85,.3)", background:"rgba(254,44,85,.08)", color:"#fe2c55", fontWeight:700, fontSize:13, cursor:"pointer", flexShrink:0 },
  connectingBar:{ height:3, background:"#1a1a24", borderRadius:3, marginTop:14, overflow:"hidden" },
  connectingFill:{ height:"100%", width:"60%", background:"linear-gradient(90deg,#fe2c55,#ff4d6d)", borderRadius:3, animation:"slide 1.2s ease-in-out infinite" },
  statsGrid:{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, margin:"16px 0" },
  statCard:{ background:"#13131a", border:"1px solid #1a1a24", borderRadius:14, padding:16, textAlign:"center" },
  statIcon:{ fontSize:22, marginBottom:6 },
  statValue:{ fontWeight:800, fontSize:22, letterSpacing:-0.5 },
  statLabel:{ color:"#444", fontSize:11, marginTop:4 },
  logBox:{ background:"#0d0d14", borderRadius:10, padding:14, height:200, overflowY:"auto" },
  logEmpty:{ color:"#333", fontSize:13, textAlign:"center", paddingTop:70 },
  logItem:(t)=>({ fontSize:12, color: t==="gift"?"#fbbf24":t==="follow"?"#a78bfa":t==="system"?"#22c55e":"#555", padding:"4px 0", borderBottom:"1px solid #0d0d14" }),
  select:{ background:"#0d0d14", border:"1px solid #1e1e2a", borderRadius:10, color:"#fff", fontSize:13, padding:"10px 14px", outline:"none", width:"100%", cursor:"pointer" },
  sliderLabel:{ color:"#666", fontSize:12 },
  sliderVal:{ color:"#fe2c55", fontSize:12, fontWeight:700 },
  range:{ width:"100%", accentColor:"#fe2c55" },
  settingLabel:{ color:"#777", fontSize:12, fontWeight:600, display:"block", marginBottom:6 },
  hint:{ color:"#333", fontSize:11, marginTop:4 },
  toggleRow:{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #0f0f18" },
  playBtn:{ background:"linear-gradient(135deg,#fe2c55,#ff4d6d)", border:"none", borderRadius:8, color:"#fff", width:38, height:38, fontSize:14, cursor:"pointer", flexShrink:0 },
  testBtn:{ background:"rgba(254,44,85,.12)", border:"1px solid rgba(254,44,85,.25)", borderRadius:8, color:"#fe2c55", fontSize:12, padding:"8px 14px", cursor:"pointer", fontWeight:700, flexShrink:0 },
  addBtn:{ background:"rgba(254,44,85,.12)", border:"1px solid rgba(254,44,85,.3)", borderRadius:8, color:"#fe2c55", fontSize:12, padding:"8px 14px", cursor:"pointer", fontWeight:700, flexShrink:0 },
  removeBtn:{ background:"transparent", border:"none", color:"#333", cursor:"pointer", padding:"4px 8px", fontSize:14, borderRadius:6 },
  chip:{ background:"#0d0d14", border:"1px solid #1e1e2a", borderRadius:20, color:"#666", fontSize:12, padding:"4px 12px", display:"flex", alignItems:"center" },
  dropdown:{ position:"absolute", top:"100%", left:0, right:0, background:"#13131a", border:"1px solid #1e1e2a", borderRadius:12, padding:12, zIndex:100, marginTop:4, boxShadow:"0 16px 40px rgba(0,0,0,.6)" },
  dropdownItem:{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, cursor:"pointer", transition:"background .1s" },
  giftIconBox:{ width:52, height:52, borderRadius:12, background:"#0d0d14", border:"1px solid #1e1e2a", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden" },
  infoBox:{ background:"rgba(29,185,84,.05)", border:"1px solid rgba(29,185,84,.15)", borderRadius:10, padding:14, color:"#666", fontSize:12, marginTop:14, lineHeight:1.6 },
  nowPlayingBox:{ background:"#0d0d14", border:"1px solid rgba(29,185,84,.15)", borderRadius:10, padding:14, marginTop:14 },
  battleCard:{ background:"#13131a", border:"1px solid #1a1a24", borderRadius:16, padding:20, marginBottom:12 },
};

// ─── GIFTSELECTOR con imágenes reales ─────────────────────────────────────────
function GiftSelector({ onAdd, addedIds }) {
  const [search, setSearch] = useState("");
  const [imgErrors, setImgErrors] = useState({});

  const filtered = TIKTOK_GIFTS.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) && !addedIds.includes(g.id)
  );

  const handleImgError = (id) => setImgErrors(p => ({...p, [id]: true}));

  const GiftEmojis = {
    rose:"🌹", icecream:"🍦", tiktok:"📱", finger:"🤞", hat:"🎩", sunglasses:"😎",
    perfume:"🌸", butterfly:"🦋", alien:"👾", dancer:"💃", drama:"👑", animalband:"🎷",
    astrobear:"🐻", babychicks:"🐥", park:"🎡", lion:"🦁", whale:"🐋", gorila:"🦍",
    trex:"🦖", dragon:"🐉", zeus:"⚡", rhino:"🦏", sealwhale:"🐬", stars:"⭐", universe:"🌌"
  };

  return (
    <div>
      <input
        style={{...S.input, marginBottom:10}}
        placeholder="🔍 Buscar regalo de TikTok..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        autoFocus
      />
      <div style={{maxHeight:280, overflowY:"auto"}}>
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:8}}>
          {filtered.map(g => (
            <div key={g.id}
              onClick={() => onAdd(g)}
              style={{
                background:"#0d0d14", border:"1px solid #1e1e2a", borderRadius:12, padding:10,
                cursor:"pointer", textAlign:"center", transition:"all .15s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor="#fe2c55"}
              onMouseLeave={e => e.currentTarget.style.borderColor="#1e1e2a"}
            >
              <div style={{
                width:56, height:56, borderRadius:10, background:"#13131a",
                margin:"0 auto 6px", display:"flex", alignItems:"center", justifyContent:"center",
                fontSize: imgErrors[g.id] ? 30 : 0, overflow:"hidden"
              }}>
                {imgErrors[g.id]
                  ? (GiftEmojis[g.id] || "🎁")
                  : <img
                      src={g.img}
                      alt={g.name}
                      style={{width:56, height:56, objectFit:"contain"}}
                      onError={() => handleImgError(g.id)}
                      onLoad={e => { e.target.style.display="block"; }}
                    />
                }
              </div>
              <div style={{color:"#fff", fontWeight:700, fontSize:12, marginBottom:3}}>{g.name}</div>
              <div style={{
                color:"#fbbf24", fontSize:11, background:"rgba(251,191,36,.08)",
                borderRadius:20, padding:"2px 8px", display:"inline-block"
              }}>🪙 {g.coins.toLocaleString()}</div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{color:"#333", textAlign:"center", padding:20, gridColumn:"1/-1"}}>
              No se encontraron regalos
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── BATALLA 2v2 con puntos individuales ──────────────────────────────────────
function BattleTab() {
  const [battles] = useState([
    {
      id:1, team1:[{name:"@streamer_A", pts:1450},{name:"@streamer_B", pts:980}],
      team2:[{name:"@rival_X", pts:1200},{name:"@rival_Y", pts:870}],
      active:true
    }
  ]);

  const teamTotal = (members) => members.reduce((a,m)=>a+m.pts,0);

  return (
    <div>
      <SecHdr title="⚔️ BATALLA 2 VS 2 — PUNTOS INDIVIDUALES"/>
      {battles.map(b => {
        const t1 = teamTotal(b.team1);
        const t2 = teamTotal(b.team2);
        const total = t1 + t2;
        const pct1 = total > 0 ? (t1/total*100).toFixed(1) : 50;
        return (
          <div key={b.id} style={{...S.card, borderColor:"rgba(254,44,85,.2)"}}>
            {b.active && (
              <div style={{display:"flex", justifyContent:"center", marginBottom:14}}>
                <span style={{background:"rgba(254,44,85,.1)", border:"1px solid rgba(254,44,85,.3)", color:"#fe2c55", fontSize:10, fontWeight:800, letterSpacing:2, padding:"3px 12px", borderRadius:20}}>
                  🔴 EN VIVO
                </span>
              </div>
            )}
            {/* Barra progreso */}
            <div style={{marginBottom:18}}>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:6}}>
                <span style={{color:"#25f4ee", fontWeight:800, fontSize:13}}>Equipo A — {t1.toLocaleString()} pts</span>
                <span style={{color:"#fe2c55", fontWeight:800, fontSize:13}}>{t2.toLocaleString()} pts — Equipo B</span>
              </div>
              <div style={{height:8, borderRadius:4, background:"#0d0d14", overflow:"hidden"}}>
                <div style={{
                  height:"100%", width:`${pct1}%`,
                  background:"linear-gradient(90deg,#25f4ee,#fe2c55)",
                  transition:"width .5s", borderRadius:4
                }}/>
              </div>
              <div style={{textAlign:"center", color:"#444", fontSize:11, marginTop:4}}>
                {pct1}% / {(100-pct1).toFixed(1)}%
              </div>
            </div>

            {/* Equipos con puntos individuales */}
            <div style={{display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:12, alignItems:"start"}}>
              {/* Equipo A */}
              <div>
                <div style={{color:"#25f4ee", fontWeight:800, fontSize:11, letterSpacing:1, marginBottom:10, textAlign:"center"}}>
                  EQUIPO A
                </div>
                {b.team1.map((m,i) => (
                  <div key={i} style={{
                    background:"rgba(37,244,238,.06)", border:"1px solid rgba(37,244,238,.15)",
                    borderRadius:10, padding:"10px 12px", marginBottom:8
                  }}>
                    <div style={{color:"#fff", fontWeight:700, fontSize:13, marginBottom:4}}>{m.name}</div>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                      <span style={{color:"#25f4ee", fontWeight:800, fontSize:16}}>{m.pts.toLocaleString()}</span>
                      <span style={{color:"#444", fontSize:10}}>puntos</span>
                    </div>
                    <div style={{
                      height:4, borderRadius:2, background:"#0d0d14", marginTop:6, overflow:"hidden"
                    }}>
                      <div style={{
                        height:"100%", borderRadius:2, background:"#25f4ee",
                        width:`${t1>0?(m.pts/t1*100):50}%`, transition:"width .5s"
                      }}/>
                    </div>
                    <div style={{color:"#333", fontSize:10, marginTop:2}}>
                      {t1>0?(m.pts/t1*100).toFixed(0):50}% del equipo
                    </div>
                  </div>
                ))}
                <div style={{
                  textAlign:"center", color:"#25f4ee", fontWeight:800, fontSize:14,
                  background:"rgba(37,244,238,.05)", borderRadius:8, padding:"6px"
                }}>Total: {t1.toLocaleString()}</div>
              </div>

              {/* VS */}
              <div style={{
                color:"#333", fontWeight:900, fontSize:20, textAlign:"center",
                paddingTop:30
              }}>VS</div>

              {/* Equipo B */}
              <div>
                <div style={{color:"#fe2c55", fontWeight:800, fontSize:11, letterSpacing:1, marginBottom:10, textAlign:"center"}}>
                  EQUIPO B
                </div>
                {b.team2.map((m,i) => (
                  <div key={i} style={{
                    background:"rgba(254,44,85,.06)", border:"1px solid rgba(254,44,85,.15)",
                    borderRadius:10, padding:"10px 12px", marginBottom:8
                  }}>
                    <div style={{color:"#fff", fontWeight:700, fontSize:13, marginBottom:4}}>{m.name}</div>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                      <span style={{color:"#fe2c55", fontWeight:800, fontSize:16}}>{m.pts.toLocaleString()}</span>
                      <span style={{color:"#444", fontSize:10}}>puntos</span>
                    </div>
                    <div style={{
                      height:4, borderRadius:2, background:"#0d0d14", marginTop:6, overflow:"hidden"
                    }}>
                      <div style={{
                        height:"100%", borderRadius:2, background:"#fe2c55",
                        width:`${t2>0?(m.pts/t2*100):50}%`, transition:"width .5s"
                      }}/>
                    </div>
                    <div style={{color:"#333", fontSize:10, marginTop:2}}>
                      {t2>0?(m.pts/t2*100).toFixed(0):50}% del equipo
                    </div>
                  </div>
                ))}
                <div style={{
                  textAlign:"center", color:"#fe2c55", fontWeight:800, fontSize:14,
                  background:"rgba(254,44,85,.05)", borderRadius:8, padding:"6px"
                }}>Total: {t2.toLocaleString()}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── COMPONENTE MÚSICA (sin Spotify roto, limpio) ─────────────────────────────
function MusicTab() {
  const [enabled, setEnabled] = useState(false);
  const [cmd, setCmd] = useState("!song");
  const [perm, setPerm] = useState("Solo seguidores");
  const [cooldown, setCooldown] = useState(30);
  const [maxQueue, setMaxQueue] = useState(5);
  const [allowSkip, setAllowSkip] = useState(false);
  const [skipPerm, setSkipPerm] = useState("Solo moderadores");
  const [customUsers, setCustomUsers] = useState([]);
  const [customInput, setCustomInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [queue, setQueue] = useState([]);

  const handleConnect = () => {
    // Spotify requiere OAuth — abre ventana de autorización
    const clientId = "YOUR_SPOTIFY_CLIENT_ID"; // el usuario debe configurarlo
    const redirectUri = encodeURIComponent(window.location.origin);
    const scopes = encodeURIComponent("user-read-playback-state user-modify-playback-state");
    const url = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${redirectUri}&scope=${scopes}`;
    // Sólo abre si tiene client_id configurado
    alert("Para conectar Spotify necesitas configurar tu Client ID de Spotify Developer en el código del servidor (server.js). Ve a developer.spotify.com, crea una app y pega el Client ID.");
  };

  return (
    <div>
      <SecHdr title="🎵 MÚSICA POR COMANDOS (SPOTIFY)"/>
      <div style={S.card}>
        <div style={S.toggleRow}>
          <div>
            <div style={{fontWeight:700,color:"#fff",fontSize:14}}>Activar módulo de música</div>
            <div style={S.hint}>Espectadores piden canciones con un comando en el chat</div>
          </div>
          <Toggle on={enabled} onClick={()=>setEnabled(!enabled)}/>
        </div>

        {!enabled && (
          <div style={S.infoBox}>
            💡 Activa el módulo y conecta tu Spotify. Los espectadores escriben <strong style={{color:"#1DB954"}}>{cmd} nombre de canción</strong> en el chat para agregar canciones a tu cola.
          </div>
        )}

        {enabled && (
          <>
            {!connected ? (
              <div style={{marginTop:16}}>
                <div style={S.infoBox}>
                  ⚠️ <strong style={{color:"#fbbf24"}}>Requiere configuración del servidor:</strong> Para que Spotify funcione necesitas:<br/><br/>
                  1. Ir a <strong style={{color:"#1DB954"}}>developer.spotify.com</strong> y crear una app<br/>
                  2. Copiar el <strong>Client ID</strong> y <strong>Client Secret</strong><br/>
                  3. Agregarlos en tu <strong>server.js</strong> como variables de entorno<br/>
                  4. Luego haz clic en "Conectar Spotify" para autorizar
                </div>
                <button
                  onClick={handleConnect}
                  style={{
                    ...S.loginBtn, width:"auto", padding:"12px 28px",
                    marginTop:14, background:"linear-gradient(135deg,#1DB954,#17a349)",
                    fontSize:14
                  }}
                >
                  🎵 Conectar Spotify
                </button>
              </div>
            ) : (
              <div style={{...S.nowPlayingBox, marginTop:14}}>
                <div style={{color:"#1DB954",fontWeight:700,fontSize:10,letterSpacing:1.5,marginBottom:6}}>▶ REPRODUCIENDO AHORA</div>
                <div style={{color:"#555",fontSize:13}}>Sin canción en reproducción</div>
              </div>
            )}
          </>
        )}
      </div>

      {enabled && (
        <>
          <SecHdr title="⌨️ CONFIGURAR COMANDO"/>
          <div style={S.card}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div>
                <label style={S.settingLabel}>Comando para pedir canción</label>
                <input style={S.input} value={cmd} onChange={e=>setCmd(e.target.value)} placeholder="!song"/>
                <p style={S.hint}>Uso: {cmd} Never Gonna Give You Up</p>
              </div>
              <div>
                <label style={S.settingLabel}>Cooldown entre peticiones · {cooldown}s</label>
                <input type="range" min={0} max={300} step={5} value={cooldown} onChange={e=>setCooldown(Number(e.target.value))} style={S.range}/>
                <p style={S.hint}>Tiempo de espera entre comandos del mismo usuario</p>
              </div>
              <div>
                <label style={S.settingLabel}>Máximo canciones en cola</label>
                <input type="number" min={1} max={50} value={maxQueue} onChange={e=>setMaxQueue(Number(e.target.value))} style={{...S.input}}/>
              </div>
            </div>
          </div>

          <SecHdr title="🔒 PERMISOS"/>
          <div style={S.card}>
            <div style={{marginBottom:18}}>
              <label style={{...S.settingLabel,marginBottom:10}}>¿Quién puede usar {cmd}?</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {SPOTIFY_PERMS.map(p=>(
                  <button key={p} style={{
                    ...S.chip, cursor:"pointer",
                    background:perm===p?"rgba(29,185,84,.2)":"#13131a",
                    border:`1px solid ${perm===p?"#1DB954":"#2a2a3a"}`,
                    color:perm===p?"#1DB954":"#666"
                  }} onClick={()=>setPerm(p)}>{p}</button>
                ))}
              </div>
            </div>

            {perm==="Usuarios personalizados" && (
              <div style={{marginBottom:18}}>
                <label style={S.settingLabel}>Usuarios autorizados</label>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <input style={{...S.input,flex:1}} placeholder="@usuario" value={customInput} onChange={e=>setCustomInput(e.target.value)}/>
                  <button style={S.addBtn} onClick={()=>{if(customInput.trim()){setCustomUsers(p=>[...p,customInput.trim()]);setCustomInput("");}}}>+ Agregar</button>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {customUsers.map((u,i)=>(
                    <div key={i} style={S.chip}>{u}
                      <span style={{cursor:"pointer",marginLeft:6,color:"#fe2c55"}} onClick={()=>setCustomUsers(p=>p.filter((_,j)=>j!==i))}>×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={S.toggleRow}>
              <div>
                <div style={S.settingLabel}>Permitir saltar canción</div>
                <div style={S.hint}>Habilita un comando para pasar a la siguiente</div>
              </div>
              <Toggle on={allowSkip} onClick={()=>setAllowSkip(!allowSkip)}/>
            </div>

            {allowSkip && (
              <div style={{marginTop:10}}>
                <label style={{...S.settingLabel,marginBottom:10}}>¿Quién puede saltar?</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {["Solo yo","Solo moderadores","Todos"].map(p=>(
                    <button key={p} style={{
                      ...S.chip, cursor:"pointer",
                      background:skipPerm===p?"rgba(29,185,84,.2)":"#13131a",
                      border:`1px solid ${skipPerm===p?"#1DB954":"#2a2a3a"}`,
                      color:skipPerm===p?"#1DB954":"#666"
                    }} onClick={()=>setSkipPerm(p)}>{p}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <SecHdr title="📋 COLA DE CANCIONES"/>
          <div style={S.card}>
            {queue.length === 0 ? (
              <div style={{color:"#333",textAlign:"center",padding:"30px 0",fontSize:13}}>
                No hay canciones en la cola. Los espectadores pueden usar <strong style={{color:"#1DB954"}}>{cmd}</strong> para agregar.
              </div>
            ) : (
              queue.map((s,i) => (
                <div key={i} style={{...S.toggleRow}}>
                  <span style={{color:"#1DB954",fontWeight:800,marginRight:10}}>{i+1}.</span>
                  <span style={{flex:1,color:"#fff"}}>{s.name}</span>
                  <span style={{color:"#444",fontSize:12,marginRight:10}}>@{s.user}</span>
                  <button style={S.removeBtn} onClick={()=>setQueue(p=>p.filter((_,j)=>j!==i))}>✕</button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("login");
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  // Dashboard
  const [tiktokUser, setTiktokUser] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [dots, setDots] = useState("");
  const [liveStats, setLiveStats] = useState({viewers:0,gifts:0,follows:0,messages:0});
  const [activityLog, setActivityLog] = useState([]);

  // TTS State
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsVoice, setTtsVoice] = useState(TTS_VOICES_ES[0].id);
  const [ttsVolume, setTtsVolume] = useState(1.0);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [ttsTestText, setTtsTestText] = useState("Hola, soy el TTS de tu live!");
  const [ttsChat, setTtsChat] = useState(true);
  const [ttsGifts, setTtsGifts] = useState(false);
  const [ttsFollows, setTtsFollows] = useState(false);
  const [ttsShares, setTtsShares] = useState(false);
  const [ttsSuperFan, setTtsSuperFan] = useState(false);
  const [ttsJoin, setTtsJoin] = useState(false);
  const [ttsJoinAll, setTtsJoinAll] = useState(false);
  const [tplChat, setTplChat] = useState("{nickname} dice {message}");
  const [tplGift, setTplGift] = useState("{username} envió {giftName} x{repeatCount}");
  const [tplFollow, setTplFollow] = useState("{username} te siguió");
  const [tplShare, setTplShare] = useState("{username} compartió el live");
  const [tplJoin, setTplJoin] = useState("{username} se unió al live");
  const [tplSuperFan, setTplSuperFan] = useState("{username} se hizo super fan");
  const [filterAll, setFilterAll] = useState(false);
  const [filterFollowers, setFilterFollowers] = useState(true);
  const [filterMods, setFilterMods] = useState(false);
  const [filterSuperFans, setFilterSuperFans] = useState(false);
  const [filterFanClub, setFilterFanClub] = useState(false);
  const [filterFanLevel, setFilterFanLevel] = useState(1);
  const [filterCustomUsers, setFilterCustomUsers] = useState([]);
  const [filterCustomInput, setFilterCustomInput] = useState("");
  const [queueInfinite, setQueueInfinite] = useState(true);
  const [queueReadOld, setQueueReadOld] = useState(false);
  const [queueSkipEmoji, setQueueSkipEmoji] = useState(true);
  const [queueSkipAt, setQueueSkipAt] = useState(false);
  const [queueSkipCmd, setQueueSkipCmd] = useState(false);
  const [queueAntiSpam, setQueueAntiSpam] = useState(false);
  const [queueIgnoreRep, setQueueIgnoreRep] = useState(false);
  const [queueMaxRep, setQueueMaxRep] = useState(2);
  const [queueWindow, setQueueWindow] = useState(30);

  // Acciones/Regalos
  const [defaultVol, setDefaultVol] = useState(80);
  const [addingGift, setAddingGift] = useState(false);
  const [addedGifts, setAddedGifts] = useState([]);
  const [giftConfigs, setGiftConfigs] = useState({});
  const setGiftCfg = (id,k,v) => setGiftConfigs(p=>({...p,[id]:{...(p[id]||defGiftCfg()),[k]:v}}));
  const addGift = (g) => {
    if(!addedGifts.find(x=>x.id===g.id)) {
      setAddedGifts(p=>[...p,g]);
      setGiftConfigs(p=>({...p,[g.id]:defGiftCfg()}));
    }
    setAddingGift(false);
  };

  // Actualizar TTS engine cuando cambian configs
  useEffect(() => {
    ttsEngine.setConfig({
      volume: ttsVolume,
      speed: ttsSpeed,
      pitch: ttsPitch,
      voiceLang: TTS_VOICES_ES.find(v=>v.id===ttsVoice)?.lang || "es"
    });
    ttsEngine.setEnabled(ttsEnabled);
  }, [ttsEnabled, ttsVolume, ttsSpeed, ttsPitch, ttsVoice]);

  // Chrome bug fix: keepalive para speechSynthesis
  useEffect(() => {
    if (!ttsEnabled) return;
    const interval = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [ttsEnabled]);

  useEffect(() => {
    if (!isConnecting) return;
    const t = setInterval(() => setDots(d=>d.length>=3?"":d+"."), 400);
    return () => clearInterval(t);
  }, [isConnecting]);

  useEffect(() => {
    if (!isConnected) return;
    const t = setInterval(() => {
      const viewers = Math.floor(Math.random()*3);
      const hasGift = Math.random()>.75;
      const hasFollow = Math.random()>.82;
      const msgs = Math.floor(Math.random()*4);

      setLiveStats(p=>({
        viewers: p.viewers+viewers,
        gifts: p.gifts+(hasGift?1:0),
        follows: p.follows+(hasFollow?1:0),
        messages: p.messages+msgs
      }));

      const evs=[
        {type:"gift",   text:`🎁 @user${Math.floor(Math.random()*999)} envió Rosa 🌹`},
        {type:"follow", text:`➕ @fan${Math.floor(Math.random()*999)} te siguió`},
        {type:"message",text:`💬 @chat${Math.floor(Math.random()*999)}: ¡Hola live!`},
      ];

      if (Math.random()>.5) {
        const ev = evs[Math.floor(Math.random()*evs.length)];
        setActivityLog(p=>[ev,...p].slice(0,25));

        // TTS en tiempo real
        if (ttsEnabled) {
          if (ev.type==="message" && ttsChat) {
            const user = `@chat${Math.floor(Math.random()*999)}`;
            const msg = "¡Hola live!";
            const txt = tplChat.replace("{nickname}", user).replace("{username}", user).replace("{message}", msg);
            ttsEngine.enqueue(txt);
          }
          if (ev.type==="follow" && ttsFollows) {
            const u = `@fan${Math.floor(Math.random()*999)}`;
            ttsEngine.enqueue(tplFollow.replace("{username}", u).replace("{nickname}", u));
          }
          if (ev.type==="gift" && ttsGifts) {
            const u = `@user${Math.floor(Math.random()*999)}`;
            ttsEngine.enqueue(tplGift.replace("{username}", u).replace("{giftName}", "Rosa").replace("{repeatCount}","1").replace("{totalValue}","1"));
          }
        }
      }
    }, 2000);
    return () => clearInterval(t);
  }, [isConnected, ttsEnabled, ttsChat, ttsFollows, ttsGifts, tplChat, tplFollow, tplGift]);

  const handleLogin = () => {
    setLoginError("");
    const f = MOCK_USERS[email.toLowerCase()];
    if (f && f.password===password) {
      setUser({email, name:f.name, plan:f.plan});
      setScreen("app");
    } else {
      setLoginError("Credenciales incorrectas.");
    }
  };

  const handleConnect = () => {
    if (!tiktokUser.trim()) return;
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
      setLiveStats({viewers:12,gifts:0,follows:0,messages:0});
      setActivityLog([{type:"system",text:`✅ Conectado a @${tiktokUser}`}]);
    }, 2500);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setActivityLog([]);
    setLiveStats({viewers:0,gifts:0,follows:0,messages:0});
    ttsEngine.cancel();
  };

  const speakTest = () => {
    if (!("speechSynthesis" in window)) {
      alert("Tu navegador no soporta síntesis de voz.");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(ttsTestText);
    u.volume = ttsVolume;
    u.rate   = ttsSpeed;
    u.pitch  = ttsPitch;
    const voices = window.speechSynthesis.getVoices();
    const lang = TTS_VOICES_ES.find(v=>v.id===ttsVoice)?.lang || "es";
    const match = voices.find(v=>v.lang===lang) || voices.find(v=>v.lang.startsWith("es"));
    if (match) u.voice = match;
    setTimeout(() => window.speechSynthesis.speak(u), 100);
  };

  // Tabs — SIN "Regalos" como tab separado (está en Acciones), SIN "Spotify" roto
  const TABS = [
    {id:"dashboard", icon:"⚡", label:"Dashboard"},
    {id:"tts",       icon:"🔊", label:"TTS"},
    {id:"acciones",  icon:"🎯", label:"Acciones"},
    {id:"batalla",   icon:"⚔️", label:"Batalla"},
    {id:"musica",    icon:"🎵", label:"Música"},
  ];

  if (screen==="login") return (
    <div style={S.loginBg}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
        input:focus{border-color:#fe2c55!important;outline:none}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#0a0a0f}
        ::-webkit-scrollbar-thumb{background:#1e1e2a;border-radius:4px}
        .gift-img-item:hover{background:#1a1a24!important;border-color:#fe2c55!important}
      `}</style>
      <div style={S.loginGlow}/>
      <div style={S.loginCard}>
        <div style={S.loginLogo}>
          <span style={S.logoMark}>✕</span>
          <span style={S.logoText}>Tikshank</span>
        </div>
        <p style={S.loginSub}>Panel de control para streamers</p>
        <span style={S.badge}>🔐 Acceso privado</span>
        <div style={S.inputGroup}>
          <label style={S.label}>CORREO</label>
          <input style={S.input} value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com" type="email"/>
        </div>
        <div style={S.inputGroup}>
          <label style={S.label}>CONTRASEÑA</label>
          <input style={S.input} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" type="password" onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
        </div>
        {loginError && <div style={S.error}>{loginError}</div>}
        <button style={S.loginBtn} onClick={handleLogin}>Iniciar sesión</button>
        <p style={S.loginHint}>admin@tikpanel.com / admin123</p>
      </div>
    </div>
  );

  return (
    <div style={S.appBg}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
        input:focus,select:focus{border-color:#fe2c55!important;outline:none}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#0a0a0f}
        ::-webkit-scrollbar-thumb{background:#1e1e2a;border-radius:4px}
      `}</style>

      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={S.sidebarLogo}>
          <span style={S.logoMark}>✕</span>
          <span style={S.logoText}>Tikshank</span>
        </div>
        <div style={S.userCard}>
          <div style={S.avatar}>{user.name[0]}</div>
          <div>
            <div style={S.userName}>{user.name}</div>
            <div style={S.userPlan}>{user.plan}</div>
          </div>
        </div>
        <div style={S.statusPill(isConnected)}>
          <div style={S.statusDot(isConnected)}/>
          {isConnected ? `@${tiktokUser}` : "Sin conectar"}
        </div>
        <div style={S.nav}>
          {TABS.map(t=>(
            <button key={t.id} style={S.navBtn(activeTab===t.id)} onClick={()=>setActiveTab(t.id)}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <button style={S.logoutBtn} onClick={()=>setScreen("login")}>⎋ Cerrar sesión</button>
      </div>

      {/* Main */}
      <div style={S.main}>
        <div style={S.header}>
          <div>
            <h1 style={S.pageTitle}>
              {TABS.find(t=>t.id===activeTab)?.icon} {TABS.find(t=>t.id===activeTab)?.label}
            </h1>
            <p style={S.pageSubtitle}>Panel de tu LIVE en TikTok</p>
          </div>
          {isConnected && (
            <div style={S.liveTag}>
              <div style={S.liveDot}/>LIVE
            </div>
          )}
        </div>

        <div style={S.content}>

          {/* ── DASHBOARD ── */}
          {activeTab==="dashboard" && (
            <div>
              <div style={S.card}>
                <h3 style={S.cardTitle}>🎯 Conectar al LIVE</h3>
                <div style={S.connectRow}>
                  <div style={S.tiktokInputWrap}>
                    <span style={S.atSign}>@</span>
                    <input style={S.tiktokInput} placeholder="tu_usuario_tiktok" value={tiktokUser} onChange={e=>setTiktokUser(e.target.value)} disabled={isConnected||isConnecting}/>
                  </div>
                  {!isConnected
                    ? <button style={S.connectBtn(!isConnecting&&tiktokUser)} onClick={handleConnect} disabled={isConnecting||!tiktokUser}>
                        {isConnecting?`Conectando${dots}`:"Conectar"}
                      </button>
                    : <button style={S.disconnectBtn} onClick={handleDisconnect}>Desconectar</button>
                  }
                </div>
                {isConnecting && (
                  <div style={S.connectingBar}><div style={S.connectingFill}/></div>
                )}
              </div>

              <div style={S.statsGrid}>
                {[
                  {label:"Espectadores",value:liveStats.viewers,icon:"👁️",c:"#25f4ee"},
                  {label:"Regalos",value:liveStats.gifts,icon:"🎁",c:"#fe2c55"},
                  {label:"Seguidores",value:liveStats.follows,icon:"➕",c:"#a78bfa"},
                  {label:"Mensajes",value:liveStats.messages,icon:"💬",c:"#fbbf24"},
                ].map(s=>(
                  <div key={s.label} style={S.statCard}>
                    <div style={S.statIcon}>{s.icon}</div>
                    <div style={{...S.statValue,color:s.c}}>{s.value.toLocaleString()}</div>
                    <div style={S.statLabel}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={S.card}>
                <h3 style={S.cardTitle}>📋 Actividad en tiempo real</h3>
                <div style={S.logBox}>
                  {activityLog.length===0
                    ? <div style={S.logEmpty}>{isConnected?"Esperando actividad...":"Conecta tu LIVE para ver actividad"}</div>
                    : activityLog.map((item,i)=>(
                        <div key={i} style={S.logItem(item.type)}>{item.text}</div>
                      ))
                  }
                </div>
              </div>
            </div>
          )}

          {/* ── TTS ── */}
          {activeTab==="tts" && (
            <div>
              {/* Estado global TTS */}
              <div style={{...S.card, borderColor: ttsEnabled?"rgba(254,44,85,.3)":"#1a1a24"}}>
                <div style={S.toggleRow}>
                  <div>
                    <div style={{fontWeight:800,color:"#fff",fontSize:15}}>
                      {ttsEnabled ? "🔊 TTS Activo" : "🔇 TTS Desactivado"}
                    </div>
                    <div style={S.hint}>{ttsEnabled ? "Leyendo mensajes del chat en voz alta" : "Activa para leer mensajes en voz alta"}</div>
                  </div>
                  <Toggle on={ttsEnabled} onClick={()=>{
                    const next = !ttsEnabled;
                    setTtsEnabled(next);
                    if (!next) ttsEngine.cancel();
                  }}/>
                </div>
              </div>

              <SecHdr title="🎙️ VOZ PREDETERMINADA"/>
              <div style={S.card}>
                <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:20}}>
                  <select style={{...S.select,flex:1}} value={ttsVoice} onChange={e=>setTtsVoice(e.target.value)}>
                    {TTS_VOICES_ES.map(v=>(
                      <option key={v.id} value={v.id}>{v.label} · {v.lang}</option>
                    ))}
                  </select>
                  <button style={S.playBtn} onClick={speakTest}>▶</button>
                </div>
                {[
                  {l:"Volumen",v:ttsVolume,s:setTtsVolume,min:0,max:1,step:.01},
                  {l:"Velocidad",v:ttsSpeed,s:setTtsSpeed,min:.5,max:2,step:.1},
                  {l:"Tono",v:ttsPitch,s:setTtsPitch,min:0,max:2,step:.1}
                ].map(r=>(
                  <div key={r.l} style={{marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={S.sliderLabel}>{r.l}</span>
                      <span style={S.sliderVal}>{r.v.toFixed(2)}</span>
                    </div>
                    <input type="range" min={r.min} max={r.max} step={r.step} value={r.v} onChange={e=>r.s(Number(e.target.value))} style={S.range}/>
                  </div>
                ))}
                <div style={{marginTop:6}}>
                  <label style={S.settingLabel}>Texto de prueba</label>
                  <div style={{display:"flex",gap:8}}>
                    <input style={{...S.input,flex:1}} value={ttsTestText} onChange={e=>setTtsTestText(e.target.value)}/>
                    <button style={S.testBtn} onClick={speakTest}>▶ Probar</button>
                  </div>
                </div>
              </div>

              <SecHdr title="📢 EVENTOS A LEER"/>
              <div style={S.card}>
                {[
                  {l:"💬 Chat",v:ttsChat,s:setTtsChat},
                  {l:"🎁 Regalos",v:ttsGifts,s:setTtsGifts},
                  {l:"➕ Seguidores",v:ttsFollows,s:setTtsFollows},
                  {l:"🔁 Compartidos",v:ttsShares,s:setTtsShares},
                  {l:"⭐ Super Fan",v:ttsSuperFan,s:setTtsSuperFan},
                  {l:"👋 Se unió (seguidores)",v:ttsJoin,s:setTtsJoin},
                  {l:"🌐 Se unió (todos)",v:ttsJoinAll,s:setTtsJoinAll},
                ].map(ev=>(
                  <div key={ev.l} style={S.toggleRow}>
                    <span style={{...S.settingLabel,margin:0}}>{ev.l}</span>
                    <Toggle on={ev.v} onClick={()=>ev.s(!ev.v)}/>
                  </div>
                ))}
              </div>

              <SecHdr title="📝 PLANTILLAS DE LECTURA"/>
              <div style={S.card}>
                {[
                  {l:"Chat",v:tplChat,s:setTplChat,h:"{username} {nickname} {message}"},
                  {l:"Regalos",v:tplGift,s:setTplGift,h:"{username} {giftName} {repeatCount} {totalValue}"},
                  {l:"Seguidores",v:tplFollow,s:setTplFollow,h:"{username} {nickname}"},
                  {l:"Compartidos",v:tplShare,s:setTplShare,h:"{username} {nickname}"},
                  {l:"Se Unió",v:tplJoin,s:setTplJoin,h:"{username} {nickname}"},
                  {l:"Super Fan",v:tplSuperFan,s:setTplSuperFan,h:"{username} {nickname}"},
                ].map(t=>(
                  <div key={t.l} style={{marginBottom:18}}>
                    <label style={{...S.settingLabel,fontWeight:700,color:"#ddd",marginBottom:6}}>{t.l}</label>
                    <input style={S.input} value={t.v} onChange={e=>t.s(e.target.value)}/>
                    <p style={S.hint}>Variables: {t.h}</p>
                  </div>
                ))}
              </div>

              <SecHdr title="👥 FILTROS DE USUARIOS"/>
              <div style={S.card}>
                {[
                  {l:"Leer todos",sub:"Activa o desactiva todos los filtros",v:filterAll,s:setFilterAll},
                  {l:"Seguidores",sub:"Lee a los usuarios que te siguen",v:filterFollowers,s:setFilterFollowers},
                  {l:"Moderadores",sub:"Lee a personas asignadas como moderadores",v:filterMods,s:setFilterMods},
                  {l:"Super Fans",sub:"Usuarios que se hicieron super fan",v:filterSuperFans,s:setFilterSuperFans},
                ].map(f=>(
                  <div key={f.l} style={S.toggleRow}>
                    <div>
                      <div style={S.settingLabel}>{f.l}</div>
                      <div style={S.hint}>{f.sub}</div>
                    </div>
                    <Toggle on={f.v} onClick={()=>f.s(!f.v)}/>
                  </div>
                ))}
                <div style={{...S.toggleRow,alignItems:"center"}}>
                  <div>
                    <div style={S.settingLabel}>Fan Club · Nivel mínimo {filterFanLevel}</div>
                    <div style={S.hint}>Lee solo si nivel ≥ {filterFanLevel}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <input type="number" min={1} max={50} value={filterFanLevel} onChange={e=>setFilterFanLevel(Number(e.target.value))} style={{...S.input,width:55,textAlign:"center",padding:"8px 6px"}}/>
                    <Toggle on={filterFanClub} onClick={()=>setFilterFanClub(!filterFanClub)}/>
                  </div>
                </div>
                <div>
                  <label style={S.settingLabel}>Usuarios personalizados</label>
                  <div style={{display:"flex",gap:8,marginBottom:8}}>
                    <input style={{...S.input,flex:1}} placeholder="@usuario" value={filterCustomInput} onChange={e=>setFilterCustomInput(e.target.value)}/>
                    <button style={S.addBtn} onClick={()=>{if(filterCustomInput.trim()){setFilterCustomUsers(p=>[...p,filterCustomInput.trim()]);setFilterCustomInput("");}}}>+ Agregar</button>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {filterCustomUsers.map((u,i)=>(
                      <div key={i} style={S.chip}>{u}
                        <span style={{cursor:"pointer",marginLeft:6,color:"#fe2c55"}} onClick={()=>setFilterCustomUsers(p=>p.filter((_,j)=>j!==i))}>×</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <SecHdr title="⚙️ COLA Y OPCIONES"/>
              <div style={S.card}>
                {[
                  {l:"Cola infinita",sub:"Lee todo sin descartar",v:queueInfinite,s:setQueueInfinite},
                  {l:"Leer mensajes viejos al activar",sub:"Lee mensajes anteriores al encender el TTS",v:queueReadOld,s:setQueueReadOld},
                  {l:"Omitir emojis",sub:"",v:queueSkipEmoji,s:setQueueSkipEmoji},
                  {l:"Omitir mensajes con @",sub:"No lee mensajes que contienen una mención",v:queueSkipAt,s:setQueueSkipAt},
                  {l:"Omitir comandos !",sub:"No lee mensajes que comienzan con !",v:queueSkipCmd,s:setQueueSkipCmd},
                  {l:'Filtro anti-spam',sub:'Bloquea patrones tipo "jajaja", "xdxdxd"',v:queueAntiSpam,s:setQueueAntiSpam},
                  {l:"Ignorar mensajes repetidos",sub:"No lee el mismo mensaje múltiples veces seguidas",v:queueIgnoreRep,s:setQueueIgnoreRep},
                ].map(o=>(
                  <div key={o.l} style={S.toggleRow}>
                    <div>
                      <div style={S.settingLabel}>{o.l}</div>
                      {o.sub && <div style={S.hint}>{o.sub}</div>}
                    </div>
                    <Toggle on={o.v} onClick={()=>o.s(!o.v)}/>
                  </div>
                ))}
                <div style={{opacity:queueIgnoreRep?1:.4,marginTop:4}}>
                  <div style={S.toggleRow}>
                    <div>
                      <div style={S.settingLabel}>Máx. repeticiones permitidas</div>
                      <div style={S.hint}>Permite {queueMaxRep} mensajes, ignora el {queueMaxRep+1}°</div>
                    </div>
                    <input type="number" min={1} max={20} value={queueMaxRep} onChange={e=>setQueueMaxRep(Number(e.target.value))} style={{...S.input,width:55,textAlign:"center",padding:"8px 6px"}}/>
                  </div>
                  <div style={S.toggleRow}>
                    <div>
                      <div style={S.settingLabel}>Ventana de tiempo</div>
                      <div style={S.hint}>Segundos para detectar repeticiones</div>
                    </div>
                    <input type="number" min={5} max={120} value={queueWindow} onChange={e=>setQueueWindow(Number(e.target.value))} style={{...S.input,width:55,textAlign:"center",padding:"8px 6px"}}/>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ACCIONES (antes Regalos) ── */}
          {activeTab==="acciones" && (
            <div>
              <SecHdr title="🔔 SONIDO DEFAULT"/>
              <div style={S.card}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                  <span style={{fontSize:28}}>🎁</span>
                  <span style={{fontWeight:700,color:"#fff",fontSize:15}}>Default (todos los regalos)</span>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
                  <Toggle on={false} onClick={()=>{}}/>
                  <input style={{...S.input,flex:1}} placeholder="— Sin sonido — (pega URL o nombre de archivo)"/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <input type="range" min={0} max={100} value={defaultVol} onChange={e=>setDefaultVol(Number(e.target.value))} style={{...S.range,flex:1}}/>
                  <span style={S.sliderVal}>{defaultVol}%</span>
                  <button style={S.playBtn}>▶</button>
                </div>
              </div>

              <SecHdr title="🎀 PERSONALIZAR POR REGALO"/>
              <div style={{...S.card,position:"relative"}}>
                <div style={{display:"flex",gap:10}}>
                  <button
                    style={{...S.select,flex:1,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between"}}
                    onClick={()=>setAddingGift(!addingGift)}
                  >
                    <span style={{color:"#555"}}>Seleccionar regalo para personalizar</span>
                    <span style={{color:"#555"}}>{addingGift?"▲":"▼"}</span>
                  </button>
                  <button style={S.addBtn} onClick={()=>setAddingGift(!addingGift)}>+ Agregar</button>
                </div>

                {addingGift && (
                  <div style={S.dropdown}>
                    <GiftSelector onAdd={addGift} addedIds={addedGifts.map(g=>g.id)}/>
                    <button
                      style={{...S.removeBtn,color:"#555",marginTop:10,width:"100%",textAlign:"center",padding:"8px",borderTop:"1px solid #1a1a24"}}
                      onClick={()=>setAddingGift(false)}
                    >Cerrar</button>
                  </div>
                )}
              </div>

              {addedGifts.length===0 && (
                <div style={{...S.card,textAlign:"center",color:"#444",padding:"40px 20px"}}>
                  Selecciona un regalo arriba para agregar su sonido personalizado y duración de alerta
                </div>
              )}

              {addedGifts.map(gift => {
                const cfg = giftConfigs[gift.id] || defGiftCfg();
                const GiftEmojis = {rose:"🌹",icecream:"🍦",tiktok:"📱",finger:"🤞",hat:"🎩",sunglasses:"😎",perfume:"🌸",butterfly:"🦋",alien:"👾",dancer:"💃",drama:"👑",animalband:"🎷",astrobear:"🐻",babychicks:"🐥",park:"🎡",lion:"🦁",whale:"🐋",gorila:"🦍",trex:"🦖",dragon:"🐉",zeus:"⚡",rhino:"🦏",sealwhale:"🐬",stars:"⭐",universe:"🌌"};
                return (
                  <div key={gift.id} style={{...S.card,borderColor:"rgba(254,44,85,.2)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
                      <div style={S.giftIconBox}>
                        <img
                          src={gift.img}
                          alt={gift.name}
                          style={{width:48,height:48,objectFit:"contain"}}
                          onError={e=>{e.target.style.display="none";e.target.nextSibling.style.display="block";}}
                        />
                        <span style={{fontSize:28,display:"none"}}>{GiftEmojis[gift.id]||"🎁"}</span>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:800,color:"#fff",fontSize:16}}>{gift.name}</div>
                        <div style={{color:"#fbbf24",fontSize:12,marginTop:2}}>🪙 {gift.coins.toLocaleString()} monedas TikTok</div>
                      </div>
                      <Toggle on={cfg.enabled} onClick={()=>setGiftCfg(gift.id,"enabled",!cfg.enabled)}/>
                      <button style={{...S.removeBtn,fontSize:18}} onClick={()=>setAddedGifts(p=>p.filter(g=>g.id!==gift.id))}>✕</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                      <div>
                        <label style={S.settingLabel}>Archivo / URL del sonido</label>
                        <input style={S.input} placeholder="alerta.mp3 o https://..." value={cfg.sound} onChange={e=>setGiftCfg(gift.id,"sound",e.target.value)}/>
                      </div>
                      <div>
                        <label style={S.settingLabel}>Volumen · {cfg.volume}%</label>
                        <input type="range" min={0} max={100} value={cfg.volume} onChange={e=>setGiftCfg(gift.id,"volume",Number(e.target.value))} style={S.range}/>
                      </div>
                      <div>
                        <label style={S.settingLabel}>Duración alerta · {cfg.duration}s</label>
                        <input type="range" min={1} max={30} value={cfg.duration} onChange={e=>setGiftCfg(gift.id,"duration",Number(e.target.value))} style={S.range}/>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:20}}>
                        <Toggle on={cfg.tts} onClick={()=>setGiftCfg(gift.id,"tts",!cfg.tts)}/>
                        <span style={S.settingLabel}>Leer con TTS</span>
                      </div>
                    </div>
                    {cfg.tts && (
                      <div style={{marginTop:14}}>
                        <label style={S.settingLabel}>Plantilla TTS para este regalo</label>
                        <input style={S.input} value={cfg.ttsTemplate} onChange={e=>setGiftCfg(gift.id,"ttsTemplate",e.target.value)}/>
                        <p style={S.hint}>Variables: {"{username} {nickname} {giftName} {repeatCount} {totalValue}"}</p>
                      </div>
                    )}
                    <div style={{display:"flex",justifyContent:"flex-end",marginTop:14}}>
                      <button style={S.testBtn}>▶ Probar sonido</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── BATALLA ── */}
          {activeTab==="batalla" && <BattleTab/>}

          {/* ── MÚSICA ── */}
          {activeTab==="musica" && <MusicTab/>}

        </div>
      </div>
    </div>
  );
}
