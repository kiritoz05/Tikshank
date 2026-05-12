import { useState } from 'react'
import Head from 'next/head'
import s from '../styles/Home.module.css'
import Drawer from '../components/Drawer'

const BASE = typeof window !== 'undefined' ? window.location.origin : 'https://tikshankz.vercel.app'
const SCENES = [
  { name:'alerts/main',  desc:'Alertas generales de gifts, follows y likes.' },
  { name:'goals/likes',  desc:'Barra de progreso de meta de likes.' },
  { name:'battle/score', desc:'Marcador de batalla en tiempo real.' },
  { name:'goals/diamonds',desc:'Contador de diamantes del live.' },
]

export default function Overlays() {
  const [drawer, setDrawer] = useState(false)
  const [copied, setCopied] = useState('')

  const copy = (url) => { navigator.clipboard.writeText(url); setCopied(url); setTimeout(()=>setCopied(''),2000) }

  return (<>
    <Head><title>Overlays — TikShankz</title></Head>
    <div className={s.screen}>
      <Drawer open={drawer} onClose={()=>setDrawer(false)} active="overlays"/>
      {drawer && <div className={s.backdrop} onClick={()=>setDrawer(false)}/>}
      <div>
        <header className={s.header}>
          <button className={s.menuBtn} onClick={()=>setDrawer(!drawer)}><span/><span/><span/></button>
          <div className={s.title}>🧩 Overlays</div>
        </header>
        <main className={s.secPage}>
          <section className={s.panel}>
            <div className={s.sec}><span className={s.dot}/> URLs de escena</div>
            <p style={{fontSize:12,color:'#8f88a9',marginBottom:12}}>Pega estas URLs en TikTok LIVE Studio como Browser Source.</p>
            {SCENES.map((sc,i) => {
              const url = BASE+'/overlay/'+sc.name
              return (
                <div key={i} style={{marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>🧩 {sc.name}</div>
                  <div style={{fontSize:11,color:'#8f88a9',marginBottom:6}}>{sc.desc}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8}}>
                    <div className={s.overlayUrl}>{url}</div>
                    <button className={s.copyBtn} onClick={()=>copy(url)}>{copied===url?'✅':'Copiar'}</button>
                  </div>
                </div>
              )
            })}
          </section>
          <div className={s.row}>
            <div className={s.card}><h3>🎨 Editor</h3><p>Personaliza colores, fuentes y animaciones de cada overlay.</p><span className={s.tag}>Próximo</span></div>
            <div className={s.card}><h3>📦 Galería</h3><p>Plantillas listas para importar y usar al instante.</p><span className={s.tag}>Próximo</span></div>
          </div>
        </main>
      </div>
    </div>
  </>)
}
