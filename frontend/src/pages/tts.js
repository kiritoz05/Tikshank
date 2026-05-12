import { useState } from 'react'
import Head from 'next/head'
import s from '../styles/Home.module.css'
import Drawer from '../components/Drawer'
const VOICES=['Español (ES)','Español (MX)','Español (US)','Inglés (US)']
export default function TTS() {
  const [drawer,setDrawer]=useState(false)
  const [text,setText]=useState('')
  const [voice,setVoice]=useState(0)
  const [status,setStatus]=useState('')
  const speak=()=>{
    if(!text.trim())return
    if(!window.speechSynthesis){setStatus('Tu navegador no soporta TTS');return}
    window.speechSynthesis.cancel()
    const u=new SpeechSynthesisUtterance(text)
    const voices=window.speechSynthesis.getVoices()
    const esp=voices.find(v=>v.lang.startsWith('es'))
    if(esp)u.voice=esp
    window.speechSynthesis.speak(u)
    setStatus('Reproduciendo...')
    u.onend=()=>setStatus('')
  }
  return(<>
    <Head><title>TTS — TikShankz</title></Head>
    <div className={s.screen}>
      <Drawer open={drawer} onClose={()=>setDrawer(false)}/>
      {drawer&&<div className={s.backdrop} onClick={()=>setDrawer(false)}/>}
      <div>
        <header className={s.header}><button className={s.menuBtn} onClick={()=>setDrawer(!drawer)}><span/><span/><span/></button><div className={s.title}>🎙️ TTS & Sonidos</div></header>
        <main className={s.secPage}>
          <section className={s.panel}>
            <div className={s.sec}><span className={s.dot}/> Texto a voz</div>
            <div className={s.ttsArea}>
              <textarea className={s.ttsInput} value={text} onChange={e=>setText(e.target.value)} placeholder="Escribe el mensaje a reproducir..."/>
              <div className={s.voiceRow}>{VOICES.map((v,i)=><button key={i} className={`${s.voiceBtn} ${voice===i?s.voiceBtnActive:''}`} onClick={()=>setVoice(i)}>{v}</button>)}</div>
              <button className={s.btnSpeak} onClick={speak}>🔊 Reproducir ahora</button>
              {status&&<div className={s.info}>{status}</div>}
            </div>
          </section>
          <div className={s.row}>
            <div className={s.card}><h3>🔔 Gift Alert</h3><p>Leer nombre del regalo y usuario al recibir un gift.</p><span className={s.tag}>Activo</span></div>
            <div className={s.card}><h3>💬 Chat Reader</h3><p>Leer mensajes del chat según filtros configurados.</p><span className={s.tag}>Config</span></div>
            <div className={s.card}><h3>⭐ VIP Voice</h3><p>Voz especial para gifts premium y MVPs.</p><span className={s.tag}>Premium</span></div>
            <div className={s.card}><h3>📢 Anuncios</h3><p>Mensajes automáticos cada N minutos.</p><span className={s.tag}>Config</span></div>
          </div>
        </main>
      </div>
    </div>
  </>)
}
