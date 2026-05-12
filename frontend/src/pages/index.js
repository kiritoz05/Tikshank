import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import s from '../styles/Home.module.css'
import Drawer from '../components/Drawer'

const API = process.env.NEXT_PUBLIC_API_URL || ''
const WS  = process.env.NEXT_PUBLIC_WS_URL  || ''

const DEMO_EVENTS = [
  { title:'❤️ @miguelgamer dio 21 likes',  desc:'+21 likes acumulados en el live.' },
  { title:'🎁 @jibenv6 envió 7x Rose',      desc:'+35 diamantes. TTS activado.' },
  { title:'➕ @newcomer00 te siguió',        desc:'Nuevo seguidor. Mensaje automático enviado.' },
  { title:'💬 @fanprimero: "Hola hermosa!"',desc:'Mensaje en el chat del live.' },
  { title:'⚔️ Bonus Mission detectada',     desc:'Overlay urgencia activo. 72% completado.' },
  { title:'🎁 @mvpking envió 1x Lion',      desc:'+199 diamantes. Sonido VIP activado.' },
  { title:'💬 @chatero: "cuánto falta?"',  desc:'Comando detectado. Respuesta enviada.' },
  { title:'➕ @tiktokfan99 te siguió',       desc:'Meta de seguidores actualizada.' },
]

export default function Home() {
  const [user, setUser]           = useState('tu_usuario')
  const [connected, setConnected] = useState(false)
  const [drawer, setDrawer]       = useState(false)
  const [events, setEvents]       = useState([])
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [st, setSt] = useState({ viewers:0,gifts:0,followers:0,messages:0,likes:0,diamonds:0 })
  const ws   = useRef(null)
  const idx  = useRef(0)
  const timer= useRef(null)

  const addEvent = (ev) => setEvents(p => [ev,...p].slice(0,20))
  const updateSt = (newSt) => setSt({ viewers:newSt.viewers||0,gifts:newSt.gifts||0,followers:newSt.followers||0,messages:newSt.messages||0,likes:newSt.likes||0,diamonds:newSt.diamonds||0 })

  // Modo demo (sin backend)
  const startDemo = () => {
    setSt(p => ({...p, viewers:6}))
    timer.current = setInterval(() => {
      const ev = DEMO_EVENTS[idx.current % DEMO_EVENTS.length]; idx.current++
      addEvent(ev)
      setSt(p => ({
        viewers:   Math.max(1, p.viewers + (Math.random()>.45?1:-1)),
        gifts:     p.gifts    + (ev.title.includes('🎁')?1:0),
        followers: p.followers + (ev.title.includes('➕')?1:0),
        messages:  p.messages  + (ev.title.includes('💬')?1:0),
        likes:     p.likes     + (ev.title.includes('❤️')?Math.floor(Math.random()*20)+5:0),
        diamonds:  p.diamonds  + (ev.title.includes('🎁')?Math.floor(Math.random()*80)+10:0),
      }))
    }, 2200)
  }

  useEffect(() => {
    if (!WS) return
    try {
      ws.current = new WebSocket(WS)
      ws.current.onmessage = e => {
        const d = JSON.parse(e.data)
        if (d.state) updateSt(d.state)
        if (d.type==='EVENT')        addEvent(d.event)
        if (d.type==='CONNECTED')    setConnected(true)
        if (d.type==='DISCONNECTED') { setConnected(false); setEvents([]); setSt({viewers:0,gifts:0,followers:0,messages:0,likes:0,diamonds:0}) }
      }
    } catch(e) {}
    return () => { ws.current?.close(); clearInterval(timer.current) }
  }, [])

  const toggleConnect = async () => {
    if (connected) {
      clearInterval(timer.current)
      setConnected(false); setEvents([]); setError('')
      setSt({viewers:0,gifts:0,followers:0,messages:0,likes:0,diamonds:0})
      if (API) fetch(API+'/disconnect',{method:'POST'})
      return
    }
    setError(''); setLoading(true)
    if (API) {
      try {
        const r = await fetch(API+'/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user})})
        const d = await r.json()
        if (!r.ok) { setError(d.error||'No se pudo conectar'); setLoading(false); return }
        setConnected(true)
      } catch(e) { setError('Sin conexión al servidor. Modo demo activado.'); startDemo(); setConnected(true) }
    } else {
      startDemo(); setConnected(true)
    }
    setLoading(false)
  }

  return (<>
    <Head><title>TikShankz</title><meta name="viewport" content="width=device-width,initial-scale=1"/></Head>
    <div className={s.screen}>
      <Drawer open={drawer} onClose={()=>setDrawer(false)} active="dashboard"/>
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
              <button className={`${s.btnConnect} ${connected?s.btnOff:''}`} onClick={toggleConnect} disabled={loading}>
                {loading?'...':connected?'Desconectar':'Conectar'}
              </button>
            </div>
            {error && <div className={s.err}>{error}</div>}
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
                ? <div className={s.placeholder}>{connected?'Iniciando feed...':'Conecta tu LIVE'}</div>
                : events.map((ev,i)=><div key={i} className={s.event}><strong>{ev.title}</strong><p>{ev.desc}</p></div>)
              }
            </div>
          </section>
        </main>
      </div>
    </div>
  </>)
}
