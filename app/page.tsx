export default function Home() {
  return (
    <main className="wrap">
      <section className="shell">
        <div className="nav">
          <div className="burger">☰</div>
          <div>
            <div className="brand">TikShankz</div>
            <div className="sub">Control center para TikTok Live</div>
          </div>
          <div className="pill">LIVE</div>
        </div>

        <div className="hero">
          <h1 className="heroTitle">Conecta tu directo</h1>
          <div className="heroText">
            Diseño móvil oscuro con accesos para alertas, TTS, overlays,
            actividad y batallas en una sola vista.
          </div>
        </div>

        <div className="stats">
          <div className="card">
            <div className="label">Viewers</div>
            <div className="num">1,284</div>
          </div>
          <div className="card">
            <div className="label">Likes</div>
            <div className="num">48.2K</div>
          </div>
          <div className="card">
            <div className="label">Diamonds</div>
            <div className="num">9,420</div>
          </div>
          <div className="card">
            <div className="label">Battle score</div>
            <div className="num">+320</div>
          </div>
        </div>

        <div className="sectionTitle">Funciones</div>
        <div className="moduleList">
          <div className="item">
            <span className="itemName">Alerts</span>
            <span className="tag">Ready</span>
          </div>
          <div className="item">
            <span className="itemName">TTS Chat</span>
            <span className="tag">Voice</span>
          </div>
          <div className="item">
            <span className="itemName">Overlay Studio</span>
            <span className="tag">Scene</span>
          </div>
          <div className="item">
            <span className="itemName">Battle Center</span>
            <span className="tag">Live</span>
          </div>
          <div className="item">
            <span className="itemName">Moderation</span>
            <span className="tag">Filters</span>
          </div>
        </div>

        <div className="mini">
          <div className="miniTitle">Actividad</div>
          <div className="miniText">
            Nuevo seguidor, regalo recibido, TTS activo y misión de batalla
            detectada. Esta base está hecha para que luego ampliemos funciones
            reales sin perder el diseño.
          </div>
        </div>

        <div className="dock">
          <div className="dockBtn">Home</div>
          <div className="dockBtn">Alerts</div>
          <div className="dockBtn">Overlay</div>
          <div className="dockBtn">Battle</div>
        </div>
      </section>
    </main>
  )
      }
