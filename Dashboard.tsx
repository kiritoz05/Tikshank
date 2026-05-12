"use client"

import { useState } from 'react'

const stats = [
  { icon: '👁️', value: '0', label: 'Espectadores', color: '#45e9ff' },
  { icon: '🎁', value: '0', label: 'Regalos', color: '#ff4d7a' },
  { icon: '➕', value: '0', label: 'Seguidores', color: '#e8cf36' },
  { icon: '💬', value: '0', label: 'Mensajes', color: '#b891ff' }
]

const features = [
  ['Alertas', 'Acciones y eventos en tiempo real'],
  ['TTS & Sonidos', 'Lectura de mensajes y sound alerts'],
  ['Overlays', 'Galería y editor por enlace único'],
  ['Moderación', 'Panel anti spam y gestión básica'],
  ['Batallas', 'Bonus mission, MVP rival y boosters'],
  ['Analítica', 'General y de batallas'],
  ['Gaming', 'Base para juegos interactivos'],
  ['Eventos', 'Calendario inteligente del mes']
]

export default function Dashboard() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{minHeight:'100vh'}}>
      <div style={{maxWidth:1200, margin:'0 auto', minHeight:'100vh', display:'grid', gridTemplateColumns:'300px 1fr'}} className="shell">
        <aside style={{background:'linear-gradient(180deg,#070811,#05050d)', borderRight:'1px solid rgba(123,92,255,.15)', padding:14}} className={open ? 'drawer open' : 'drawer'}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 2px 10px'}}>
            <div style={{width:30,height:30,borderRadius:9,background:'linear-gradient(135deg,#58e9ff,#ff5e8e)',display:'grid',placeItems:'center',fontWeight:900}}>T</div>
            <div style={{fontSize:24,fontWeight:900,letterSpacing:'-.06em'}}>Tik<span style={{color:'#ff4d7a'}}>Shankz</span></div>
          </div>
          <div style={{display:'grid',gap:8, marginTop:12}}>
            {['Dashboard','Alertas','TTS & Sonidos','Overlays','Analítica','Moderación','Batallas','Gaming','Eventos'].map((item,i)=>(
              <div key={item} style={{padding:'11px 12px',borderRadius:12,background:i===0?'linear-gradient(180deg,rgba(255,77,122,.18),rgba(255,77,122,.10))':'transparent',color:i===0?'#fff':'#8f88a9',border:i===0?'1px solid rgba(255,77,122,.14)':'1px solid transparent',fontSize:13}}>{item}</div>
            ))}
          </div>
        </aside>
        <main>
          <header style={{display:'flex',alignItems:'center',gap:12,padding:'14px 14px 10px',borderBottom:'1px solid rgba(255,255,255,.04)',position:'sticky',top:0,background:'rgba(7,7,13,.92)',backdropFilter:'blur(14px)',zIndex:10}}>
            <button onClick={() => setOpen(!open)} style={{width:32,height:32,borderRadius:10,border:'1px solid rgba(255,255,255,.06)',background:'linear-gradient(180deg,#181829,#10101d)',color:'#fff'}}>☰</button>
            <div style={{display:'flex',alignItems:'center',gap:8,fontWeight:900,fontSize:28,letterSpacing:'-.05em'}}><span style={{color:'#ffbf39',fontSize:17}}>⚡</span>Dashboard</div>
          </header>
          <div style={{padding:14,display:'grid',gap:12}}>
            <section style={panel}>
              <div style={sectionTitle}>Conectar al LIVE</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10}}>
                <div style={inputWrap}><span style={{color:'#ff4d7a'}}>@</span><input defaultValue="Ok" style={{width:'100%',background:'transparent',border:'none',outline:'none',color:'#fff'}} /></div>
                <button style={connectBtn}>Conectar</button>
              </div>
            </section>
            <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {stats.map(s => (
                <article key={s.label} style={statCard}>
                  <div style={{fontSize:21}}>{s.icon}</div>
                  <div style={{fontSize:34,fontWeight:900,letterSpacing:'-.06em',color:s.color}}>{s.value}</div>
                  <div style={{fontSize:11,color:'#8f88a9'}}>{s.label}</div>
                </article>
              ))}
            </section>
            <section style={{...panel,display:'grid',gridTemplateColumns:'auto 1fr auto',alignItems:'center',gap:10}}>
              <div style={{fontSize:32}}>❤️</div><div><div style={{fontSize:16,fontWeight:900,color:'#ff4d7a'}}>0</div><div style={{fontSize:11,color:'#8f88a9'}}>LIKES EN LIVE</div></div><div style={{textAlign:'right'}}><div style={{fontSize:18,fontWeight:900,color:'#7ed4ff'}}>0</div><div style={{fontSize:11,color:'#8f88a9'}}>Diamantes</div></div>
            </section>
            <section style={panel}>
              <div style={sectionTitle}>Actividad en tiempo real</div>
              <div style={{marginTop:10,borderRadius:14,border:'1px solid rgba(123,92,255,.12)',background:'linear-gradient(180deg,#080910,#05060a)',minHeight:180,padding:12,display:'grid',gap:8}}>
                <div style={eventBox}><strong style={eventStrong}>Alertas</strong><p style={eventText}>Acciones y eventos para gifts, likes, follows y comentarios.</p></div>
                <div style={eventBox}><strong style={eventStrong}>Overlays</strong><p style={eventText}>Editor y galería por enlace único para LIVE Studio.</p></div>
                <div style={eventBox}><strong style={eventStrong}>Batallas</strong><p style={eventText}>Seguimiento de bonus mission, MVP rival y boosters.</p></div>
              </div>
            </section>
            <section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {features.map(([title,desc]) => (
                <article key={title} style={featureCard}>
                  <h3 style={{fontSize:13,margin:'0 0 6px'}}>{title}</h3>
                  <p style={{fontSize:11,color:'#8f88a9',lineHeight:1.45,margin:0}}>{desc}</p>
                </article>
              ))}
            </section>
          </div>
        </main>
      </div>
      <style jsx global>{`
        @media (max-width: 900px){
          .shell{display:block !important;}
          .drawer{position:fixed;top:0;left:0;bottom:0;width:min(86vw,320px);transform:translateX(-100%);transition:.28s cubic-bezier(.16,1,.3,1);z-index:50;box-shadow:40px 0 80px rgba(0,0,0,.55)}
          .drawer.open{transform:translateX(0)}
        }
      `}</style>
    </div>
  )
}

const panel = { background:'linear-gradient(180deg,rgba(14,15,28,.98),rgba(9,10,18,.98))', border:'1px solid rgba(123,92,255,.14)', borderRadius:18, boxShadow:'0 20px 50px rgba(0,0,0,.45)', padding:14 }
const sectionTitle = { display:'flex', alignItems:'center', gap:8, fontSize:15, fontWeight:700, marginBottom:12 }
const inputWrap = { background:'#080910', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, padding:'12px 14px', color:'#fff', display:'flex', alignItems:'center', gap:8, minHeight:46 }
const connectBtn = { padding:'0 18px', minHeight:46, border:'none', borderRadius:12, background:'linear-gradient(135deg,#ff4d7a,#ff5ca8)', color:'#fff', fontWeight:800 }
const statCard = { padding:'14px 12px', borderRadius:16, background:'linear-gradient(180deg,#0d0f1d,#090b14)', border:'1px solid rgba(123,92,255,.14)', minHeight:94, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6 }
const eventBox = { background:'linear-gradient(180deg,rgba(255,77,122,.14),rgba(255,77,122,.07))', border:'1px solid rgba(255,77,122,.12)', borderRadius:12, padding:'10px 12px' }
const eventStrong = { display:'block', fontSize:12, color:'#ff8bab', marginBottom:4 }
const eventText = { fontSize:12, color:'#dfcfe3', margin:0 }
const featureCard = { padding:12, borderRadius:16, background:'linear-gradient(180deg,#0d0f1d,#090b14)', border:'1px solid rgba(123,92,255,.14)' }
