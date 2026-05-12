import { useRouter } from 'next/router'
import s from '../styles/Home.module.css'

const NAV = [
  ['⚡','Dashboard','/'],
  ['🎙️','TTS & Sonidos','/tts'],
  ['🧩','Overlays','/overlays'],
  ['⚔️','Batallas','/batallas'],
  ['🔔','Alertas','#'],
  ['📈','Analítica','#'],
  ['🛡️','Moderación','#'],
  ['🎮','Gaming','#'],
  ['📅','Eventos','#'],
]

export default function Drawer({ open, onClose, active }) {
  const router = useRouter()
  return (
    <aside className={`${s.drawer} ${open?s.drawerOpen:''}`}>
      <div className={s.dInner}>
        <div className={s.brand}>
          <div className={s.bLogo}>T</div>
          <div className={s.bName}>Tik<span className={s.bPink}>Shankz</span></div>
        </div>
        <div className={s.dProfile}>
          <div className={s.dAv}>S</div>
          <div><strong>Streamer</strong><span>Pro Live Tools</span></div>
        </div>
        <nav className={s.dNav}>
          {NAV.map(([ico,label,href],i)=>(
            <a key={i} href={href} className={router.pathname===href?s.dNavActive:''}
               onClick={e=>{ if(href==='#'){e.preventDefault()} else { onClose && onClose() } }}>
              {ico} {label}
            </a>
          ))}
        </nav>
        <div className={s.dFooter}><button className={s.logout}>Cerrar sesión</button></div>
      </div>
    </aside>
  )
}
