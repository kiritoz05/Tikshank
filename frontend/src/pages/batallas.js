import { useState, useEffect } from 'react'
import Head from 'next/head'
import s from '../styles/Home.module.css'
import Drawer from '../components/Drawer'
export default function Batallas() {
  const [drawer,setDrawer]=useState(false)
  const [prog,setProg]=useState(72)
  useEffect(()=>{const t=setInterval(()=>setProg(p=>Math.min(100,p+Math.random()*1.5)),3000);return()=>clearInterval(t)},[])
  return(<>
    <Head><title>Batallas — TikShankz</title></Head>
    <div className={s.screen}>
      <Drawer open={drawer} onClose={()=>setDrawer(false)}/>
      {drawer&&<div className={s.backdrop} onClick={()=>setDrawer(false)}/>}
      <div>
        <header className={s.header}><button className={s.menuBtn} onClick={()=>setDrawer(!drawer)}><span/><span/><span/></button><div className={s.title}>⚔️ Batallas</div></header>
        <main className={s.secPage}>
          <section className={s.panel}>
            <div className={s.sec}><span className={s.dot}/> Bonus Mission</div>
            <div className={s.progBar}><div className={s.progFill} style={{width:prog+'%'}}/></div>
            <p style={{fontSize:11,color:'#ff8bab',marginTop:8,textAlign:'right'}}>{Math.round(prog)}% completado</p>
          </section>
          <div className={s.row}>
            <div className={s.card}><h3>👑 MVP Rival</h3><p>@rival_top1 — 2,340 pts en la batalla actual.</p><span className={s.tag}>Activo</span></div>
            <div className={s.card}><h3>🔥 Booster</h3><p>x2 activo. Expira en 4:32 min.</p><span className={s.tag}>x2</span></div>
            <div className={s.card}><h3>📊 Score Live</h3><p>846 pts propios vs 1,203 rival.</p><span className={s.tag}>Battle</span></div>
            <div className={s.card}><h3>⏰ Alertas</h3><p>Aviso automático 30s antes de que expire el booster.</p><span className={s.tag}>Config</span></div>
          </div>
        </main>
      </div>
    </div>
  </>)
}
