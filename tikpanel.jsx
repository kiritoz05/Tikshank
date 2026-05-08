import { useState, useEffect } from "react";

// ─── DATOS ────────────────────────────────────────────────────────────────────
const MOCK_USERS = {
  "admin@tikpanel.com": { password: "admin123", name: "Admin", plan: "Pro" },
  "usuario@tikpanel.com": { password: "pass123", name: "StreamerPro", plan: "Free" },
};

const TTS_VOICES_ES = [
  { id: "es-MX-DaliaNeural",  label: "Dalia (México)",    lang: "es-MX" },
  { id: "es-MX-JorgeNeural",  label: "Jorge (México)",    lang: "es-MX" },
  { id: "es-ES-ElviraNeural", label: "Elvira (España)",   lang: "es-ES" },
  { id: "es-ES-AlvaroNeural", label: "Álvaro (España)",   lang: "es-ES" },
  { id: "es-AR-ElenaNeural",  label: "Elena (Argentina)", lang: "es-AR" },
  { id: "es-CO-SalomeNeural", label: "Salomé (Colombia)", lang: "es-CO" },
];

const TIKTOK_GIFTS = [
  { id:"rose",       name:"Rose",           emoji:"🌹", coins:1     },
  { id:"icecream",   name:"Ice Cream",      emoji:"🍦", coins:1     },
  { id:"tiktok",     name:"TikTok",         emoji:"📱", coins:1     },
  { id:"finger",     name:"Finger Heart",   emoji:"🤞", coins:5     },
  { id:"hat",        name:"Hat",            emoji:"🎩", coins:10    },
  { id:"sunglasses", name:"Sunglasses",     emoji:"😎", coins:30    },
  { id:"perfume",    name:"Perfume",        emoji:"🌸", coins:99    },
  { id:"butterfly",  name:"Let Butterfly",  emoji:"🦋", coins:399   },
  { id:"alien",      name:"Alien Buddy",    emoji:"👾", coins:399   },
  { id:"dancer",     name:"Air Dancer",     emoji:"💃", coins:300   },
  { id:"animalband", name:"Animal Band",    emoji:"🎷", coins:2500  },
  { id:"astrobear",  name:"Astrobear",      emoji:"🐻", coins:1500  },
  { id:"babychicks", name:"Baby Chicks",    emoji:"🐥", coins:500   },
  { id:"park",       name:"Amusement Park", emoji:"🎡", coins:17000 },
  { id:"adream",     name:"Adam's Dream",   emoji:"🌌", coins:25999 },
  { id:"universe",   name:"Universe",       emoji:"🌍", coins:34999 },
  { id:"leon",       name:"Lion",           emoji:"🦁", coins:1000  },
  { id:"drama",      name:"Drama Queen",    emoji:"👑", coins:5000  },
];

const SPOTIFY_PERMS = ["Todos","Solo seguidores","Solo moderadores","Usuarios personalizados"];
const defGiftCfg = () => ({ enabled:false, sound:"", volume:80, duration:5, tts:false, ttsTemplate:"{username} envió {giftName} x{repeatCount}" });

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,setScreen] = useState("login");
  const [user,setUser] = useState(null);
  const [email,setEmail] = useState(""); const [password,setPassword] = useState("");
  const [loginError,setLoginError] = useState("");
  const [activeTab,setActiveTab] = useState("dashboard");

  // Dashboard
  const [tiktokUser,setTiktokUser]=useState(""); const [isConnected,setIsConnected]=useState(false);
  const [isConnecting,setIsConnecting]=useState(false); const [dots,setDots]=useState("");
  const [liveStats,setLiveStats]=useState({viewers:0,gifts:0,follows:0,messages:0});
  const [activityLog,setActivityLog]=useState([]);

  // TTS
  const [ttsVoice,setTtsVoice]=useState(TTS_VOICES_ES[0].id);
  const [ttsVolume,setTtsVolume]=useState(1.0); const [ttsSpeed,setTtsSpeed]=useState(1.0); const [ttsPitch,setTtsPitch]=useState(1.0);
  const [ttsTestText,setTtsTestText]=useState("Hola, soy el TTS de tu live!");
  const [ttsChat,setTtsChat]=useState(true); const [ttsGifts,setTtsGifts]=useState(false);
  const [ttsFollows,setTtsFollows]=useState(false); const [ttsShares,setTtsShares]=useState(false);
  const [ttsSuperFan,setTtsSuperFan]=useState(false); const [ttsJoin,setTtsJoin]=useState(false);
  const [ttsJoinAll,setTtsJoinAll]=useState(false);
  const [tplChat,setTplChat]=useState("{nickname} dice {message}");
  const [tplGift,setTplGift]=useState("{username} envió {giftName} x{repeatCount}, valor {totalValue}");
  const [tplFollow,setTplFollow]=useState("{username} te siguió");
  const [tplShare,setTplShare]=useState("{username} compartió el live");
  const [tplJoin,setTplJoin]=useState("{username} se unió al live");
  const [tplSuperFan,setTplSuperFan]=useState("{username} se hizo super fan");
  const [filterAll,setFilterAll]=useState(false); const [filterFollowers,setFilterFollowers]=useState(true);
  const [filterMods,setFilterMods]=useState(false); const [filterSuperFans,setFilterSuperFans]=useState(false);
  const [filterFanClub,setFilterFanClub]=useState(false); const [filterFanLevel,setFilterFanLevel]=useState(1);
  const [filterCustomUsers,setFilterCustomUsers]=useState([]); const [filterCustomInput,setFilterCustomInput]=useState("");
  const [queueInfinite,setQueueInfinite]=useState(true); const [queueReadOld,setQueueReadOld]=useState(false);
  const [queueSkipEmoji,setQueueSkipEmoji]=useState(true); const [queueSkipAt,setQueueSkipAt]=useState(false);
  const [queueSkipCmd,setQueueSkipCmd]=useState(false); const [queueAntiSpam,setQueueAntiSpam]=useState(false);
  const [queueIgnoreRep,setQueueIgnoreRep]=useState(false); const [queueMaxRep,setQueueMaxRep]=useState(2);
  const [queueWindow,setQueueWindow]=useState(30);

  // Regalos
  const [defaultVol,setDefaultVol]=useState(80); const [addingGift,setAddingGift]=useState(false);
  const [giftSearch,setGiftSearch]=useState(""); const [addedGifts,setAddedGifts]=useState([]);
  const [giftConfigs,setGiftConfigs]=useState({});
  const setGiftCfg=(id,k,v)=>setGiftConfigs(p=>({...p,[id]:{...(p[id]||defGiftCfg()),[k]:v}}));
  const addGift=(g)=>{if(!addedGifts.find(x=>x.id===g.id)){setAddedGifts(p=>[...p,g]);setGiftConfigs(p=>({...p,[g.id]:defGiftCfg()}));}setAddingGift(false);setGiftSearch("");};

  // Spotify
  const [spotifyEnabled,setSpotifyEnabled]=useState(false);
  const [spotifyCmd,setSpotifyCmd]=useState("!song"); const [spotifyPerm,setSpotifyPerm]=useState("Solo seguidores");
  const [spotifyCooldown,setSpotifyCooldown]=useState(30); const [spotifyMaxQueue,setSpotifyMaxQueue]=useState(5);
  const [spotifyAllowSkip,setSpotifyAllowSkip]=useState(false); const [spotifySkipPerm,setSpotifySkipPerm]=useState("Solo moderadores");
  const [spotifyCustomUsers,setSpotifyCustomUsers]=useState([]); const [spotifyCustomInput,setSpotifyCustomInput]=useState("");
  const [spotifyQueue,setSpotifyQueue]=useState([]);

  useEffect(()=>{if(!isConnecting)return;const t=setInterval(()=>setDots(d=>d.length>=3?"":d+"."),400);return()=>clearInterval(t);},[isConnecting]);
  useEffect(()=>{
    if(!isConnected)return;
    const t=setInterval(()=>{
      setLiveStats(p=>({viewers:p.viewers+Math.floor(Math.random()*3),gifts:p.gifts+(Math.random()>.75?1:0),follows:p.follows+(Math.random()>.82?1:0),messages:p.messages+Math.floor(Math.random()*4)}));
      const evs=[{type:"gift",text:`🎁 @user${Math.floor(Math.random()*999)} envió Rosa 🌹`},{type:"follow",text:`➕ @fan${Math.floor(Math.random()*999)} te siguió`},{type:"message",text:`💬 @chat${Math.floor(Math.random()*999)}: ¡Hola live!`},{type:"tts",text:`🔊 TTS reproducido`}];
      if(Math.random()>.5)setActivityLog(p=>[evs[Math.floor(Math.random()*evs.length)],...p].slice(0,25));
    },2000);
    return()=>clearInterval(t);
  },[isConnected]);

  const handleLogin=()=>{setLoginError("");const f=MOCK_USERS[email.toLowerCase()];if(f&&f.password===password){setUser({email,name:f.name,plan:f.plan});setScreen("app");}else setLoginError("Credenciales incorrectas.");};
  const handleConnect=()=>{if(!tiktokUser.trim())return;setIsConnecting(true);setTimeout(()=>{setIsConnecting(false);setIsConnected(true);setLiveStats({viewers:12,gifts:0,follows:0,messages:0});setActivityLog([{type:"system",text:`✅ Conectado a @${tiktokUser}`}]);},2500);};
  const handleDisconnect=()=>{setIsConnected(false);setActivityLog([]);setLiveStats({viewers:0,gifts:0,follows:0,messages:0});};
  const speakTest=()=>{if(!("speechSynthesis"in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(ttsTestText);u.volume=ttsVolume;u.rate=ttsSpeed;u.pitch=ttsPitch;const vs=window.speechSynthesis.getVoices();const m=vs.find(v=>v.lang.startsWith("es"));if(m)u.voice=m;window.speechSynthesis.speak(u);};

  const TABS=[{id:"dashboard",icon:"⚡",label:"Dashboard"},{id:"tts",icon:"🔊",label:"TTS"},{id:"gifts",icon:"🎁",label:"Regalos"},{id:"spotify",icon:"🎵",label:"Música"}];

  if(screen==="login") return (
    <div style={S.loginBg}><div style={S.loginGlow}/>
      <div style={S.loginCard}>
        <div style={S.loginLogo}><span style={S.logoMark}>✕</span><span style={S.logoText}>Tikshank</span></div>
        <p style={S.loginSub}>Panel de control para streamers</p>
        <span style={S.badge}>🔐 Acceso privado</span>
        <div style={S.inputGroup}><label style={S.label}>CORREO</label><input style={S.input} value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com" type="email"/></div>
        <div style={S.inputGroup}><label style={S.label}>CONTRASEÑA</label><input style={S.input} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" type="password" onKeyDown={e=>e.key==="Enter"&&handleLogin()}/></div>
        {loginError&&<div style={S.error}>{loginError}</div>}
        <button style={S.loginBtn} onClick={handleLogin}>Iniciar sesión</button>
        <p style={S.loginHint}>admin@tikpanel.com / admin123</p>
      </div>
    </div>
  );

  return (
    <div style={S.appBg}>
      <div style={S.sidebar}>
        <div style={S.sidebarLogo}><span style={S.logoMark}>✕</span><span style={S.logoText}>Tikshank</span></div>
        <div style={S.userCard}>
          <div style={S.avatar}>{user.name[0]}</div>
          <div><div style={S.userName}>{user.name}</div><div style={S.userPlan}>{user.plan}</div></div>
        </div>
        <div style={S.statusPill(isConnected)}><div style={S.statusDot(isConnected)}/>{isConnected?`@${tiktokUser}`:"Sin conectar"}</div>
        <div style={S.nav}>{TABS.map(t=><button key={t.id} style={S.navBtn(activeTab===t.id)} onClick={()=>setActiveTab(t.id)}><span>{t.icon}</span>{t.label}</button>)}</div>
        <button style={S.logoutBtn} onClick={()=>setScreen("login")}>⎋ Cerrar sesión</button>
      </div>

      <div style={S.main}>
        <div style={S.header}>
          <div>
            <h1 style={S.pageTitle}>{TABS.find(t=>t.id===activeTab)?.icon} {TABS.find(t=>t.id===activeTab)?.label}</h1>
            <p style={S.pageSubtitle}>Panel de tu LIVE en TikTok</p>
          </div>
          {isConnected&&<div style={S.liveTag}><div style={S.liveDot}/>LIVE</div>}
        </div>

        <div style={S.content}>

          {/* ── DASHBOARD ── */}
          {activeTab==="dashboard"&&(
            <div>
              <div style={S.card}>
                <h3 style={S.cardTitle}>🎯 Conectar al LIVE</h3>
                <div style={S.connectRow}>
                  <div style={S.tiktokInputWrap}><span style={S.atSign}>@</span><input style={S.tiktokInput} placeholder="tu_usuario_tiktok" value={tiktokUser} onChange={e=>setTiktokUser(e.target.value)} disabled={isConnected||isConnecting}/></div>
                  {!isConnected?<button style={S.connectBtn(!isConnecting&&tiktokUser)} onClick={handleConnect} disabled={isConnecting||!tiktokUser}>{isConnecting?`Conectando${dots}`:"Conectar"}</button>:<button style={S.disconnectBtn} onClick={handleDisconnect}>Desconectar</button>}
                </div>
                {isConnecting&&<div style={S.connectingBar}><div style={S.connectingFill}/></div>}
              </div>
              <div style={S.statsGrid}>
                {[{label:"Espectadores",value:liveStats.viewers,icon:"👁️",c:"#25f4ee"},{label:"Regalos",value:liveStats.gifts,icon:"🎁",c:"#fe2c55"},{label:"Seguidores",value:liveStats.follows,icon:"➕",c:"#a78bfa"},{label:"Mensajes",value:liveStats.messages,icon:"💬",c:"#fbbf24"}].map(s=>(
                  <div key={s.label} style={S.statCard}><div style={S.statIcon}>{s.icon}</div><div style={{...S.statValue,color:s.c}}>{s.value.toLocaleString()}</div><div style={S.statLabel}>{s.label}</div></div>
                ))}
              </div>
              <div style={S.card}>
                <h3 style={S.cardTitle}>📋 Actividad en tiempo real</h3>
                <div style={S.logBox}>
                  {activityLog.length===0?<div style={S.logEmpty}>{isConnected?"Esperando actividad...":"Conecta tu LIVE para ver actividad"}</div>:activityLog.map((item,i)=><div key={i} style={S.logItem(item.type)}>{item.text}</div>)}
                </div>
              </div>
            </div>
          )}

          {/* ── TTS ── */}
          {activeTab==="tts"&&(
            <div>
              {/* Voz predeterminada */}
              <SecHdr title="🎙️ VOZ PREDETERMINADA"/>
              <div style={S.card}>
                <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:20}}>
                  <select style={{...S.select,flex:1}} value={ttsVoice} onChange={e=>setTtsVoice(e.target.value)}>
                    {TTS_VOICES_ES.map(v=><option key={v.id} value={v.id}>{v.label} · {v.lang}</option>)}
                  </select>
                  <button style={S.playBtn} onClick={speakTest}>▶</button>
                </div>
                {[{l:"Volumen",v:ttsVolume,s:setTtsVolume,min:0,max:1,step:.01},{l:"Velocidad",v:ttsSpeed,s:setTtsSpeed,min:.5,max:2,step:.1},{l:"Tono",v:ttsPitch,s:setTtsPitch,min:0,max:2,step:.1}].map(r=>(
                  <div key={r.l} style={{marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={S.sliderLabel}>{r.l}</span><span style={S.sliderVal}>{r.v.toFixed(2)}</span>
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

              {/* Eventos a leer */}
              <SecHdr title="📢 EVENTOS A LEER"/>
              <div style={S.card}>
                {[{l:"Chat",v:ttsChat,s:setTtsChat},{l:"Regalos",v:ttsGifts,s:setTtsGifts},{l:"Seguidores",v:ttsFollows,s:setTtsFollows},{l:"Compartidos",v:ttsShares,s:setTtsShares},{l:"Super Fan",v:ttsSuperFan,s:setTtsSuperFan},{l:"Se unió",v:ttsJoin,s:setTtsJoin},{l:"Todos",v:ttsJoinAll,s:setTtsJoinAll}].map(ev=>(
                  <div key={ev.l} style={S.toggleRow}><span style={{...S.settingLabel,margin:0}}>{ev.l}</span><Toggle on={ev.v} onClick={()=>ev.s(!ev.v)}/></div>
                ))}
              </div>

              {/* Plantillas */}
              <SecHdr title="📝 PLANTILLAS DE LECTURA"/>
              <div style={S.card}>
                {[{l:"Chat",v:tplChat,s:setTplChat,h:"{username} {nickname} {message}"},{l:"Regalos",v:tplGift,s:setTplGift,h:"{username} {giftName} {repeatCount} {totalValue}"},{l:"Seguidores",v:tplFollow,s:setTplFollow,h:"{username} {nickname}"},{l:"Compartidos",v:tplShare,s:setTplShare,h:"{username} {nickname}"},{l:"Se Unió",v:tplJoin,s:setTplJoin,h:"{username} {nickname}"},{l:"Super Fan",v:tplSuperFan,s:setTplSuperFan,h:"{username} {nickname}"}].map(t=>(
                  <div key={t.l} style={{marginBottom:18}}>
                    <label style={{...S.settingLabel,fontWeight:700,color:"#ddd",marginBottom:6}}>{t.l}</label>
                    <input style={S.input} value={t.v} onChange={e=>t.s(e.target.value)}/>
                    <p style={S.hint}>Variables: {t.h}</p>
                  </div>
                ))}
              </div>

              {/* Filtros */}
              <SecHdr title="👥 FILTROS DE USUARIOS"/>
              <div style={S.card}>
                {[{l:"Leer todos",sub:"Activa o desactiva todos los filtros",v:filterAll,s:setFilterAll},{l:"Seguidores",sub:"Lee a los usuarios que te siguen",v:filterFollowers,s:setFilterFollowers},{l:"Moderadores",sub:"Lee a personas asignadas como moderadores",v:filterMods,s:setFilterMods},{l:"Super Fans",sub:"Usuarios que se hicieron super fan",v:filterSuperFans,s:setFilterSuperFans}].map(f=>(
                  <div key={f.l} style={S.toggleRow}>
                    <div><div style={S.settingLabel}>{f.l}</div><div style={S.hint}>{f.sub}</div></div>
                    <Toggle on={f.v} onClick={()=>f.s(!f.v)}/>
                  </div>
                ))}
                <div style={{...S.toggleRow,alignItems:"center"}}>
                  <div><div style={S.settingLabel}>Fan Club · Nivel mínimo {filterFanLevel}</div><div style={S.hint}>Lee solo si nivel ≥ {filterFanLevel}</div></div>
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
                    {filterCustomUsers.map((u,i)=><div key={i} style={S.chip}>{u}<span style={{cursor:"pointer",marginLeft:6,color:"#fe2c55"}} onClick={()=>setFilterCustomUsers(p=>p.filter((_,j)=>j!==i))}>×</span></div>)}
                  </div>
                </div>
              </div>

              {/* Cola */}
              <SecHdr title="⚙️ COLA Y OPCIONES"/>
              <div style={S.card}>
                {[{l:"Cola infinita",sub:"Lee todo sin descartar",v:queueInfinite,s:setQueueInfinite},{l:"Leer mensajes viejos al activar",sub:"Lee mensajes anteriores al encender el TTS",v:queueReadOld,s:setQueueReadOld},{l:"Omitir emojis",sub:"",v:queueSkipEmoji,s:setQueueSkipEmoji},{l:"Omitir mensajes con @",sub:"No lee mensajes que contienen una mención",v:queueSkipAt,s:setQueueSkipAt},{l:"Omitir comandos !",sub:"No lee mensajes que comienzan con !",v:queueSkipCmd,s:setQueueSkipCmd},{l:"Filtro anti-spam",sub:'Bloquea patrones tipo "jajaja", "xdxdxd"',v:queueAntiSpam,s:setQueueAntiSpam},{l:"Ignorar mensajes repetidos",sub:"No lee el mismo mensaje múltiples veces seguidas",v:queueIgnoreRep,s:setQueueIgnoreRep}].map(o=>(
                  <div key={o.l} style={S.toggleRow}>
                    <div><div style={S.settingLabel}>{o.l}</div>{o.sub&&<div style={S.hint}>{o.sub}</div>}</div>
                    <Toggle on={o.v} onClick={()=>o.s(!o.v)}/>
                  </div>
                ))}
                <div style={{opacity:queueIgnoreRep?1:.4,marginTop:4}}>
                  <div style={S.toggleRow}>
                    <div><div style={S.settingLabel}>Máx. repeticiones permitidas</div><div style={S.hint}>Permite {queueMaxRep} mensajes, ignora el {queueMaxRep+1}°</div></div>
                    <input type="number" min={1} max={20} value={queueMaxRep} onChange={e=>setQueueMaxRep(Number(e.target.value))} style={{...S.input,width:55,textAlign:"center",padding:"8px 6px"}}/>
                  </div>
                  <div style={S.toggleRow}>
                    <div><div style={S.settingLabel}>Ventana de tiempo</div><div style={S.hint}>Segundos para detectar repeticiones</div></div>
                    <input type="number" min={5} max={120} value={queueWindow} onChange={e=>setQueueWindow(Number(e.target.value))} style={{...S.input,width:55,textAlign:"center",padding:"8px 6px"}}/>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── REGALOS ── */}
          {activeTab==="gifts"&&(
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
              {/* Dropdown agregar */}
              <div style={{...S.card,position:"relative"}}>
                <div style={{display:"flex",gap:10}}>
                  <button style={{...S.select,flex:1,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between"}} onClick={()=>setAddingGift(!addingGift)}>
                    <span style={{color:"#555"}}>Seleccionar regalo para personalizar</span>
                    <span style={{color:"#555"}}>{addingGift?"▲":"▼"}</span>
                  </button>
                  <button style={S.addBtn} onClick={()=>setAddingGift(!addingGift)}>+ Agregar</button>
                </div>
                {addingGift&&(
                  <div style={S.dropdown}>
                    <input style={{...S.input,marginBottom:10}} placeholder="🔍 Buscar regalo..." value={giftSearch} onChange={e=>setGiftSearch(e.target.value)} autoFocus/>
                    <div style={{maxHeight:240,overflowY:"auto"}}>
                      {TIKTOK_GIFTS.filter(g=>g.name.toLowerCase().includes(giftSearch.toLowerCase())).map(g=>(
                        <div key={g.id} style={S.dropdownItem} onClick={()=>addGift(g)}>
                          <span style={{fontSize:24,minWidth:32}}>{g.emoji}</span>
                          <span style={{flex:1,color:"#fff",fontWeight:600}}>{g.name}</span>
                          <span style={{color:"#fbbf24",fontSize:12,background:"rgba(251,191,36,.1)",padding:"2px 8px",borderRadius:20}}>🪙 {g.coins}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Cards por regalo */}
              {addedGifts.length===0&&(
                <div style={{...S.card,textAlign:"center",color:"#444",padding:"40px 20px"}}>
                  Selecciona un regalo arriba para agregar su sonido personalizado y duración de alerta
                </div>
              )}
              {addedGifts.map(gift=>{
                const cfg=giftConfigs[gift.id]||defGiftCfg();
                return (
                  <div key={gift.id} style={{...S.card,borderColor:"rgba(254,44,85,.2)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
                      <div style={S.giftIconBox}><span style={{fontSize:30}}>{gift.emoji}</span></div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:800,color:"#fff",fontSize:16}}>{gift.name}</div>
                        <div style={{color:"#fbbf24",fontSize:12,marginTop:2}}>🪙 {gift.coins} monedas TikTok</div>
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
                    {cfg.tts&&(
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

          {/* ── MÚSICA / SPOTIFY ── */}
          {activeTab==="spotify"&&(
            <div>
              <SecHdr title="🎵 SPOTIFY POR COMANDOS"/>
              <div style={S.card}>
                <div style={S.toggleRow}>
                  <div>
                    <div style={{fontWeight:700,color:"#fff",fontSize:14}}>Activar módulo Spotify</div>
                    <div style={S.hint}>Los espectadores piden canciones con un comando en el chat de TikTok</div>
                  </div>
                  <Toggle on={spotifyEnabled} onClick={()=>setSpotifyEnabled(!spotifyEnabled)}/>
                </div>
                {!spotifyEnabled&&(
                  <div style={S.infoBox}>
                    💡 Igual que Tikfinity: conecta tu Spotify y tus espectadores escriben <strong style={{color:"#1DB954"}}>!song nombre de canción</strong> en el chat para agregar canciones a tu cola. Puedes elegir quién puede usar el comando (todos, seguidores, mods, usuarios específicos).
                  </div>
                )}
                {spotifyEnabled&&(
                  <>
                    <button style={{...S.loginBtn,width:"auto",padding:"12px 28px",marginBottom:18,background:"linear-gradient(135deg,#1DB954,#17a349)"}}>
                      🎵 Conectar cuenta de Spotify
                    </button>
                    <div style={S.nowPlayingBox}>
                      <div style={{color:"#1DB954",fontWeight:700,fontSize:10,letterSpacing:1.5,marginBottom:6}}>▶ REPRODUCIENDO AHORA</div>
                      <div style={{color:"#555",fontSize:13}}>Sin canción en reproducción</div>
                    </div>
                  </>
                )}
              </div>

              {spotifyEnabled&&(<>
                <SecHdr title="⌨️ CONFIGURAR COMANDO"/>
                <div style={S.card}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                    <div>
                      <label style={S.settingLabel}>Comando para pedir canción</label>
                      <input style={S.input} value={spotifyCmd} onChange={e=>setSpotifyCmd(e.target.value)} placeholder="!song"/>
                      <p style={S.hint}>Uso: {spotifyCmd} Never Gonna Give You Up</p>
                    </div>
                    <div>
                      <label style={S.settingLabel}>Cooldown entre peticiones · {spotifyCooldown}s</label>
                      <input type="range" min={0} max={300} step={5} value={spotifyCooldown} onChange={e=>setSpotifyCooldown(Number(e.target.value))} style={S.range}/>
                      <p style={S.hint}>Tiempo de espera entre comandos del mismo usuario</p>
                    </div>
                    <div>
                      <label style={S.settingLabel}>Máximo canciones en cola</label>
                      <input type="number" min={1} max={50} value={spotifyMaxQueue} onChange={e=>setSpotifyMaxQueue(Number(e.target.value))} style={S.input}/>
                    </div>
                  </div>
                </div>

                <SecHdr title="🔒 PERMISOS"/>
                <div style={S.card}>
                  <div style={{marginBottom:18}}>
                    <label style={{...S.settingLabel,marginBottom:10}}>¿Quién puede usar {spotifyCmd}?</label>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {SPOTIFY_PERMS.map(p=>(
                        <button key={p} style={{...S.chip,cursor:"pointer",background:spotifyPerm===p?"rgba(29,185,84,.2)":"#13131a",border:`1px solid ${spotifyPerm===p?"#1DB954":"#2a2a3a"}`,color:spotifyPerm===p?"#1DB954":"#666"}} onClick={()=>setSpotifyPerm(p)}>{p}</button>
                      ))}
                    </div>
                  </div>
                  {spotifyPerm==="Usuarios personalizados"&&(
                    <div style={{marginBottom:18}}>
                      <label style={S.settingLabel}>Usuarios autorizados</label>
                      <div style={{display:"flex",gap:8,marginBottom:8}}>
                        <input style={{...S.input,flex:1}} placeholder="@usuario" value={spotifyCustomInput} onChange={e=>setSpotifyCustomInput(e.target.value)}/>
                        <button style={S.addBtn} onClick={()=>{if(spotifyCustomInput.trim()){setSpotifyCustomUsers(p=>[...p,spotifyCustomInput.trim()]);setSpotifyCustomInput("");}}}>+ Agregar</button>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {spotifyCustomUsers.map((u,i)=><div key={i} style={S.chip}>{u}<span style={{cursor:"pointer",marginLeft:6,color:"#fe2c55"}} onClick={()=>setSpotifyCustomUsers(p=>p.filter((_,j)=>j!==i))}>×</span></div>)}
                      </div>
                    </div>
                  )}
                  <div style={S.toggleRow}>
                    <div><div style={S.settingLabel}>Permitir saltar canción</div><div style={S.hint}>Habilita un comando para pasar a la siguiente</div></div>
                    <Toggle on={spotifyAllowSkip} onClick={()=>setSpotifyAllowSkip(!spotifyAllowSkip)}/>
                  </div>
                  {spotifyAllowSkip&&(
                    <div style={{marginTop:10}}>
                      <label style={{...S.settingLabel,marginBottom:10}}>¿Quién puede saltar canciones?</label>
                      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                        {SPOTIFY_PERMS.map(p=>(
                          <button key={p} style={{...S.chip,cursor:"pointer",background:spotifySkipPerm===p?"rgba(29,185,84,.2)":"#13131a",border:`1px solid ${spotifySkipPerm===p?"#1DB954":"#2a2a3a"}`,color:spotifySkipPerm===p?"#1DB954":"#666"}} onClick={()=>setSpotifySkipPerm(p)}>{p}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <SecHdr title="🎶 COLA DE CANCIONES"/>
                <div style={S.card}>
                  {spotifyQueue.length===0
                    ? <div style={{color:"#444",textAlign:"center",padding:"28px 0",fontSize:13}}>
                        Cola vacía · Los espectadores usan <span style={{color:"#1DB954"}}>{spotifyCmd} [canción]</span> en el chat para agregar canciones
                      </div>
                    : spotifyQueue.map((s,i)=>(
                        <div key={i} style={S.queueItem}>
                          <span style={{color:"#555",minWidth:22}}>{i+1}.</span>
                          <span style={{flex:1,color:"#fff"}}>{s.title}</span>
                          <span style={{color:"#666",fontSize:12}}>@{s.user}</span>
                          <button style={S.removeBtn}>✕</button>
                        </div>
                      ))
                  }
                </div>
              </>)}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Componentes pequeños ──────────────────────────────────────────────────────
function Toggle({on,onClick}){
  return <div onClick={onClick} style={{width:46,height:26,borderRadius:13,cursor:"pointer",position:"relative",flexShrink:0,background:on?"#fe2c55":"#2a2a3a",transition:"background .2s"}}>
    <div style={{position:"absolute",top:4,left:on?24:4,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.4)"}}/>
  </div>;
}
function SecHdr({title}){
  return <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,marginTop:4}}>
    <div style={{width:8,height:8,borderRadius:"50%",background:"linear-gradient(135deg,#fe2c55,#25f4ee)",flexShrink:0}}/>
    <span style={{color:"#fe2c55",fontSize:10,fontWeight:800,letterSpacing:2}}>{title}</span>
  </div>;
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const S={
  loginBg:{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0a0a0f",fontFamily:"'Syne',sans-serif",position:"relative"},
  loginGlow:{position:"absolute",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(254,44,85,.15) 0%,transparent 70%)",top:"50%",left:"50%",transform:"translate(-50%,-50%)",pointerEvents:"none"},
  loginCard:{background:"#13131a",border:"1px solid #2a2a3a",borderRadius:24,padding:"48px 40px",width:"100%",maxWidth:420,boxShadow:"0 32px 80px rgba(0,0,0,.6)",position:"relative",zIndex:1},
  loginLogo:{display:"flex",alignItems:"center",gap:8,marginBottom:8},
  logoMark:{background:"linear-gradient(135deg,#fe2c55,#25f4ee)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontSize:36,fontWeight:900},
  logoText:{color:"#fff",fontSize:28,fontWeight:800,letterSpacing:-1},
  loginSub:{color:"#666",fontSize:14,marginBottom:20,marginTop:4},
  badge:{display:"inline-block",background:"rgba(254,44,85,.1)",border:"1px solid rgba(254,44,85,.3)",color:"#fe2c55",borderRadius:20,padding:"4px 14px",fontSize:12,marginBottom:28},
  inputGroup:{marginBottom:16},
  label:{display:"block",color:"#888",fontSize:12,marginBottom:6,letterSpacing:.5},
  input:{width:"100%",background:"#0d0d15",border:"1px solid #2a2a3a",borderRadius:10,padding:"12px 16px",color:"#fff",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"},
  error:{background:"rgba(254,44,85,.1)",border:"1px solid rgba(254,44,85,.3)",borderRadius:8,padding:"10px 14px",color:"#fe2c55",fontSize:13,marginBottom:16},
  loginBtn:{width:"100%",background:"linear-gradient(135deg,#fe2c55,#ff6b81)",border:"none",borderRadius:10,padding:14,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",marginTop:8,fontFamily:"inherit"},
  loginHint:{color:"#444",fontSize:12,textAlign:"center",marginTop:20},
  appBg:{display:"flex",minHeight:"100vh",background:"#0a0a0f",fontFamily:"'Syne',sans-serif",color:"#fff"},
  sidebar:{width:240,background:"#10101a",borderRight:"1px solid #1e1e2e",display:"flex",flexDirection:"column",padding:"24px 16px",position:"sticky",top:0,height:"100vh",boxSizing:"border-box"},
  sidebarLogo:{display:"flex",alignItems:"center",gap:6,marginBottom:24,paddingLeft:8},
  userCard:{display:"flex",alignItems:"center",gap:10,background:"#1a1a2a",borderRadius:12,padding:"12px 14px",marginBottom:16},
  avatar:{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#fe2c55,#25f4ee)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:16,flexShrink:0},
  userName:{color:"#fff",fontSize:13,fontWeight:700},
  userPlan:{color:"#fe2c55",fontSize:11,fontWeight:600,marginTop:2},
  statusPill:(on)=>({display:"flex",alignItems:"center",gap:8,background:on?"rgba(37,244,238,.08)":"rgba(255,255,255,.05)",border:`1px solid ${on?"rgba(37,244,238,.3)":"#2a2a3a"}`,borderRadius:20,padding:"6px 14px",fontSize:12,color:on?"#25f4ee":"#666",marginBottom:24,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}),
  statusDot:(on)=>({width:7,height:7,borderRadius:"50%",flexShrink:0,background:on?"#25f4ee":"#444",boxShadow:on?"0 0 8px #25f4ee":"none"}),
  nav:{display:"flex",flexDirection:"column",gap:4,flex:1},
  navBtn:(active)=>({display:"flex",alignItems:"center",gap:12,background:active?"rgba(254,44,85,.12)":"transparent",border:active?"1px solid rgba(254,44,85,.25)":"1px solid transparent",borderRadius:10,padding:"11px 14px",color:active?"#fff":"#666",cursor:"pointer",fontSize:13,fontWeight:active?700:500,fontFamily:"inherit",textAlign:"left"}),
  logoutBtn:{background:"transparent",border:"1px solid #2a2a3a",borderRadius:10,padding:"10px 14px",color:"#555",cursor:"pointer",fontSize:13,fontFamily:"inherit",marginTop:8},
  main:{flex:1,display:"flex",flexDirection:"column",overflow:"auto"},
  header:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"28px 32px 20px",borderBottom:"1px solid #1e1e2e"},
  pageTitle:{fontSize:22,fontWeight:800,margin:0,letterSpacing:-.5},
  pageSubtitle:{color:"#555",fontSize:13,marginTop:4,marginBottom:0},
  liveTag:{display:"flex",alignItems:"center",gap:8,background:"rgba(254,44,85,.12)",border:"1px solid rgba(254,44,85,.3)",borderRadius:20,padding:"6px 16px",color:"#fe2c55",fontWeight:800,fontSize:12,letterSpacing:1},
  liveDot:{width:8,height:8,borderRadius:"50%",background:"#fe2c55",boxShadow:"0 0 10px #fe2c55"},
  content:{padding:32,flex:1},
  card:{background:"#13131a",border:"1px solid #1e1e2e",borderRadius:16,padding:24,marginBottom:14},
  cardTitle:{fontSize:15,fontWeight:700,margin:"0 0 20px",color:"#fff"},
  statsGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:16},
  statCard:{background:"#13131a",border:"1px solid #1e1e2e",borderRadius:16,padding:20,textAlign:"center"},
  statIcon:{fontSize:24,marginBottom:8},
  statValue:{fontSize:28,fontWeight:900,lineHeight:1},
  statLabel:{color:"#555",fontSize:11,marginTop:4,fontWeight:600,letterSpacing:.5},
  logBox:{background:"#0d0d15",borderRadius:10,padding:16,height:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:6},
  logEmpty:{color:"#444",fontSize:13,textAlign:"center",marginTop:70},
  logItem:(type)=>({fontSize:12,padding:"6px 10px",borderRadius:6,background:type==="gift"?"rgba(254,44,85,.08)":type==="follow"?"rgba(37,244,238,.08)":type==="system"?"rgba(124,58,237,.08)":"rgba(255,255,255,.04)",color:type==="gift"?"#fe2c55":type==="follow"?"#25f4ee":type==="system"?"#a78bfa":"#888",borderLeft:`2px solid ${type==="gift"?"#fe2c55":type==="follow"?"#25f4ee":type==="system"?"#a78bfa":"#333"}`}),
  connectRow:{display:"flex",gap:12,alignItems:"center"},
  tiktokInputWrap:{display:"flex",alignItems:"center",flex:1,background:"#0d0d15",border:"1px solid #2a2a3a",borderRadius:10,overflow:"hidden"},
  atSign:{color:"#fe2c55",fontWeight:800,padding:"0 12px",fontSize:16},
  tiktokInput:{flex:1,background:"transparent",border:"none",padding:"12px 12px 12px 0",color:"#fff",fontSize:14,outline:"none",fontFamily:"inherit"},
  connectBtn:(active)=>({background:active?"linear-gradient(135deg,#fe2c55,#ff6b81)":"#2a2a3a",border:"none",borderRadius:10,padding:"12px 24px",color:active?"#fff":"#555",fontSize:14,fontWeight:700,cursor:active?"pointer":"not-allowed",fontFamily:"inherit",whiteSpace:"nowrap"}),
  disconnectBtn:{background:"rgba(254,44,85,.1)",border:"1px solid rgba(254,44,85,.3)",borderRadius:10,padding:"12px 24px",color:"#fe2c55",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"},
  connectingBar:{height:3,background:"#1e1e2e",borderRadius:2,marginTop:16,overflow:"hidden"},
  connectingFill:{height:"100%",width:"60%",background:"linear-gradient(90deg,#25f4ee,#fe2c55)",borderRadius:2},
  toggleRow:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,paddingBottom:14,borderBottom:"1px solid #1a1a2a"},
  settingLabel:{color:"#aaa",fontSize:13,display:"block",marginBottom:2},
  hint:{color:"#555",fontSize:11,margin:"3px 0 0"},
  sliderLabel:{color:"#aaa",fontSize:13},
  sliderVal:{color:"#fff",fontSize:13,fontWeight:700,minWidth:38,textAlign:"right"},
  select:{width:"100%",background:"#0d0d15",border:"1px solid #2a2a3a",borderRadius:10,padding:"10px 14px",color:"#fff",fontSize:14,outline:"none",fontFamily:"inherit"},
  range:{width:"100%",accentColor:"#fe2c55",cursor:"pointer"},
  infoBox:{background:"rgba(37,244,238,.06)",border:"1px solid rgba(37,244,238,.15)",borderRadius:10,padding:"14px 16px",color:"#aaa",fontSize:13,lineHeight:1.6,marginBottom:12},
  playBtn:{width:42,height:42,borderRadius:"50%",background:"linear-gradient(135deg,#fe2c55,#ff6b81)",border:"none",color:"#fff",fontSize:16,cursor:"pointer",fontFamily:"inherit",flexShrink:0},
  testBtn:{background:"rgba(254,44,85,.12)",border:"1px solid rgba(254,44,85,.25)",borderRadius:10,padding:"10px 20px",color:"#fe2c55",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"},
  addBtn:{background:"rgba(124,58,237,.2)",border:"1px solid rgba(124,58,237,.4)",borderRadius:10,padding:"10px 18px",color:"#a78bfa",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"},
  chip:{background:"#1a1a2a",border:"1px solid #2a2a3a",borderRadius:20,padding:"5px 12px",color:"#aaa",fontSize:12,display:"flex",alignItems:"center"},
  removeBtn:{background:"transparent",border:"none",color:"#555",cursor:"pointer",fontSize:15,padding:"4px 8px",fontFamily:"inherit"},
  giftIconBox:{width:54,height:54,borderRadius:14,background:"#0d0d15",border:"1px solid #2a2a3a",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  dropdown:{position:"absolute",top:"calc(100% + 8px)",left:0,right:0,zIndex:100,background:"#1a1a2a",border:"1px solid #2a2a3a",borderRadius:14,padding:14,boxShadow:"0 20px 60px rgba(0,0,0,.8)"},
  dropdownItem:{display:"flex",alignItems:"center",gap:10,padding:"10px 8px",borderRadius:8,cursor:"pointer"},
  nowPlayingBox:{background:"rgba(29,185,84,.06)",border:"1px solid rgba(29,185,84,.2)",borderRadius:12,padding:"14px 16px"},
  queueItem:{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid #1a1a2a"},
};
