import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import s from '../styles/Home.module.css'
import Drawer from '../components/Drawer'

export default function Home() {
  const [user, setUser]           = useState('')
  const [connected, setConnected] = useState(false)
  const [drawer, setDrawer]       = useState(false)
  const [events, setEvents]       = useState([])
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [st, setSt] = useState({ viewers:0,gifts:0,followers:0,messages:0,likes:0,diamonds:0 })
  const poll = useRef(null)
  const prevEvents = useRef([])

  const startPolling = () => {
    poll.current = setInterval(async () => {
      try {
        const r = await fetch('/api/state')
        const d = await r.json()
        if (!d.state.connected) { handleDisconnect(); return }
        setSt({ viewers:d.state.viewers, gifts:d.state.gifts, followers:d.state.followers, messages:d.state.messages, likes:d.state.likes, diamonds:d.state.diamonds })
        if (d.events.length > prevEvents.current.length) {
          setEvents(d.events.slice(0,20))
          prevEvents.current = d.events
        }
      } catch(e) {}
    }, 1500)
  }

  const handleDisconnect = () => {
    clearInterval(poll.current)
    setConnected(false); setEvents([]); setError('')
    setSt({viewers:0,gifts:0,followers:0,messages:0,likes:0,diamonds:0})
    prevEvents.current = []
  }

  const toggleConnect = async () => {
    if (connected) {
      handleDisconnect()
      await fetch('/api/disconnect', { method:'POST' })
      return
    }
    if (!user.trim()) { setError('Escribe tu usuario de TikTok'); return }
    setError(''); setLoading(true)
    try {
      const r = await fetch('/api/connect', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user: user.trim() }) })
      const d = await r.json()
      if (!r.ok) { setError(d.error); setLoading(false); return }
      setConnected(true)
      startPolling()
    } catch(e) {
      setError('Error de red. Intenta de nuevo.')
    }
    setLoading(false)
  }

  useEffect(() => () => clearInterval(poll.current), [])

  return (<>
    <Head><title>TikShankz</title><meta name="viewport" content="width=device-width,initial-scale=1"/></Head>
    <div className={s.screen}>
      <Drawer open={drawer} onClose={()=>setDrawer(false)}/>
      {drawer && <div className={s.backdrop} onClick={()=>setDrawer(false)}/>}
      <div>
        <header className={s.header}>
          <button className={s.menuBtn} onClick={()=>setDrawer(!drawer)}><span/><span/><span/></button>
          <div className={s.title}>⚡ Dashboard</div>
          {connected && <span className={s.badgeLive}>● EN VIVO</span>}
        </header>
        <main className={s.content}>
          <section className={s.panel}>
            <div className={s.sec}><span className={s.dot}/> Conectar al LIVE</div>
            <div className={s.connectRow}>
              <div className={s.inp}><span className={s.at}>@</span><input value={user} onChange={e=>setUser(e.target.value)} placeholder="usuario_tiktok"/></div>
              <button className={`${s.btnConnect} ${connected?s.btnOff:''} ${loading?s.btnDisabled:''}`} onClick={toggleConnect}>
                {loading ? '⏳' : connected ? 'Desconectar' : 'Conectar'}
              </button>
            </div>
            {error  && <div className={s.err}>⚠️ {error}</div>}
            {connected && <div className={s.info}>✅ Conectado a @{user} · actualizando cada 1.5s</div>}
          </section>
          <div className={s.stats}>
            {[['👁️',st.viewers,'Espectadores',s.cyan],['🎁',st.gifts,'Regalos',s.pink],['➕',st.followers,'Seguidores',s.yellow],['💬',st.messages,'Mensajes',s.purple]].map(([ico,val,lbl,c],i)=>(
              <article key={i} className={`${s.panel} ${s.stat}`}><span className={s.ico}>{ico}</span><strong className={`${s.val} ${c}`}>{val}</strong><span className={s.lbl}>{lbl}</span></article>
            ))}
          </div>
          <div className={`${s.panel} ${s.wide}`}>
            <span style={{fontSize:28}}>❤️</span>
            <div><div className={s.bigNum}>{st.likes}</div><div className={s.sub}>LIKES EN LIVE</div></div>
            <div style={{textAlign:'right'}}><div className={s.dia}>{st.diamonds}</div><div className={s.sub}>Diamantes</div></div>
          </div>
          <section className={s.panel}>
            <div className={s.sec}>📋 Actividad en tiempo real</div>
            <div className={s.feed}>
              {events.length===0
                ? <div className={s.placeholder}>{connected?'Esperando eventos del LIVE...':'Escribe tu usuario y conecta'}</div>
                : events.map((ev,i)=><div key={i} className={s.event}><strong>{ev.title}</strong><p>{ev.desc}</p></div>)
              }
            </div>
          </section>
        </main>
      </div>
    </div>
  </>)
}
