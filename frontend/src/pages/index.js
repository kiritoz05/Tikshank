import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import s from '../styles/Home.module.css'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const WS  = process.env.NEXT_PUBLIC_WS_URL  || 'ws://localhost:3001'

const NAV = [
  ['⚡','Dashboard'],['🔔','Alertas'],['🎙️','TTS & Sonidos'],
  ['🧩','Overlays'],['📈','Analítica'],['🛡️','Moderación'],
  ['⚔️','Batallas'],['🎮','Gaming'],['📅','Eventos'],
]

export default function Home() {
  const [user, setUser]           = useState('tu_usuario')
  const [connected, setConnected] = useState(false)
  const [drawer, setDrawer]       = useState(false)
  const [events, setEvents]       = useState([])
  const [st, setSt]               = useState({ viewers:0,gifts:0,followers:0,messages:0,likes:0,diamonds:0 })
  const ws = useRef(null)

  useEffect(() => {
    try {
      ws.current = new WebSocket(WS)
      ws.current.onmessage = e => {
        const d = JSON.parse(e.data)
        if (d.state) setSt({ viewers:d.state.viewers, gifts:d.state.gifts, followers:d.state.followers, messages:d.state.messages, likes:d.state.likes, diamonds:d.state.diamonds })
        if (d.type === 'EVENT')        setEvents(prev => [d.event, ...prev].slice(0,20))
        if (d.type === 'CONNECTED')    setConnected(true)
        if (d.type === 'DISCONNECTED') { setConnected(false); setEvents([]) }
      }
    } catch(e) {}
    return () => ws.current?.close()
  }, [])

  const post = path => fetch(API+path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user }) })

  const toggleConnect = async () => {
    if (connected) { await post('/disconnect'); setConnected(false); setEvents([]); setSt({ viewers:0,gifts:0,followers:0,messages:0,likes:0,diamonds:0 }) }
    else           { await post('/connect');    setConnected(true) }
  }

  return (<>
    <Head><title>TikShankz</title><meta name="viewport" content="width=device-width,initial-scale=1"/></Head>
    <div className={s.screen}>

      {/* Drawer */}
      <aside className={`${s.drawer} ${drawer ? s.drawerOpen : ''}`}>
        <div className={s.dInner}>
          <div className={s.brand}><div className={s.bLogo}>T</div><div className={s.bName}>Tik<span className={s.bPink}>Shankz</span></div></div>
          <div className={s.dProfile}><div className={s.dAv}>S</div><div><strong>Streamer</strong><span>Pro Live Tools</span></div></div>
          <nav className={s.dNav}>
            {NAV.map(([ico,label],i) => (
              <a key={i} href="#" className={i===0?s.dNavActive:''}>{ico} {label}</a>
            ))}
          </nav>
          <div className={s.dFooter}><button className={s.logout}>Cerrar sesión</button></div>
        </div>
      </aside>
      {drawer && <div className={s.backdrop} onClick={()=>setDrawer(false)}/>}

      {/* Main */}
      <div>
        <header className={s.header}>
          <button className={s.menuBtn} onClick={()=>setDrawer(!drawer)}><span/><span/><span/></button>
          <div className={s.title}>⚡ Dashboard</div>
          {connected && <span className={s.badgeLive}>● EN VIVO</span>}
        </header>

        <main className={s.content}>
          {/* Conectar */}
          <section className={s.panel}>
            <div className={s.sec}><span className={s.dot}/> Conectar al LIVE</div>
            <div className={s.connectRow}>
              <div className={s.inp}><span className={s.at}>@</span><input value={user} onChange={e=>setUser(e.target.value)} placeholder="tu_usuario"/></div>
              <button className={`${s.btnConnect} ${connected?s.btnOff:''}`} onClick={toggleConnect}>{connected?'Desconectar':'Conectar'}</button>
            </div>
          </section>

          {/* Stats */}
          <div className={s.stats}>
            {[['👁️',st.viewers,'Espectadores',s.cyan],['🎁',st.gifts,'Regalos',s.pink],['➕',st.followers,'Seguidores',s.yellow],['💬',st.messages,'Mensajes',s.purple]].map(([ico,val,label,color],i)=>(
              <article key={i} className={`${s.panel} ${s.stat}`}><span className={s.ico}>{ico}</span><strong className={`${s.val} ${color}`}>{val}</strong><span className={s.lbl}>{label}</span></article>
            ))}
          </div>

          {/* Likes + Diamonds */}
          <div className={`${s.panel} ${s.wide}`}>
            <span style={{fontSize:28}}>❤️</span>
            <div><div className={s.bigNum}>{st.likes}</div><div className={s.sub}>LIKES EN LIVE</div></div>
            <div style={{textAlign:'right'}}><div className={s.dia}>{st.diamonds}</div><div className={s.sub}>Diamantes</div></div>
          </div>

          {/* Activity */}
          <section className={`${s.panel} ${s.feedWide}`}>
            <div className={s.sec}>📋 Actividad en tiempo real</div>
            <div className={s.feed}>
              {events.length===0
                ? <div className={s.placeholder}>{connected?'Esperando eventos...':'Conecta tu LIVE'}</div>
                : events.map((ev,i)=>(
                    <div key={i} className={s.event}><strong>{ev.title}</strong><p>{ev.desc}</p></div>
                  ))
              }
            </div>
            {connected && (
              <button className={s.simBtn} onClick={()=>fetch(API+'/simulate',{method:'POST'})}>⚡ Simular evento</button>
            )}
          </section>
        </main>
      </div>
    </div>
  </>)
}
