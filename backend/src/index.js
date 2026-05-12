const express   = require('express')
const http      = require('http')
const WebSocket = require('ws')
const cors      = require('cors')
const { WebcastPushConnection } = require('tiktok-live-connector')

const app    = express()
const ORIGIN = process.env.ALLOWED_ORIGIN || '*'
app.use(cors({ origin: ORIGIN }))
app.use(express.json())

const server = http.createServer(app)
const wss    = new WebSocket.Server({ server })

let tiktok  = null
let state   = { connected:false, user:null, viewers:0, gifts:0, followers:0, messages:0, likes:0, diamonds:0 }

function broadcast(data) {
  const msg = JSON.stringify(data)
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg) })
}

function resetState(user) {
  state = { connected:true, user, viewers:0, gifts:0, followers:0, messages:0, likes:0, diamonds:0 }
}

// ── Conectar a TikTok LIVE ────────────────────────────────────────────────────
app.post('/connect', async (req, res) => {
  const { user } = req.body
  if (!user) return res.status(400).json({ error: 'user required' })

  try {
    if (tiktok) { try { tiktok.disconnect() } catch(e) {} }

    tiktok = new WebcastPushConnection(user)

    tiktok.on('streamEnd',  ()  => { state.connected = false; broadcast({ type:'STREAM_END' }) })
    tiktok.on('roomUser',   (d) => { state.viewers = d.viewerCount; broadcast({ type:'STATE', state }) })
    tiktok.on('like',       (d) => { state.likes += d.likeCount; broadcast({ type:'EVENT', event:{ title:`❤️ @${d.uniqueId} dio likes`, desc:`+${d.likeCount} likes` }, state }) })
    tiktok.on('follow',     (d) => { state.followers++; broadcast({ type:'EVENT', event:{ title:`➕ @${d.uniqueId} te siguió`, desc:'Nuevo seguidor en el live.' }, state }) })
    tiktok.on('gift',       (d) => {
      if (d.giftType === 1 && !d.repeatEnd) return
      state.gifts++
      state.diamonds += d.diamondCount * d.repeatCount
      broadcast({ type:'EVENT', event:{ title:`🎁 @${d.uniqueId} envió ${d.repeatCount}x ${d.giftName}`, desc:`+${d.diamondCount * d.repeatCount} diamantes` }, state })
    })
    tiktok.on('chat', (d) => {
      state.messages++
      broadcast({ type:'EVENT', event:{ title:`💬 @${d.uniqueId}: "${d.comment}"`, desc:'Mensaje en el chat del live.' }, state })
    })

    const info = await tiktok.connect()
    resetState(user)
    state.viewers = info.roomInfo?.userCount || 0
    broadcast({ type:'CONNECTED', user, state })
    res.json({ ok:true, roomId: info.roomId })

  } catch(err) {
    res.status(400).json({ error: err.message || 'No se pudo conectar. Verifica que el usuario esté en LIVE.' })
  }
})

app.post('/disconnect', (_, res) => {
  try { if (tiktok) tiktok.disconnect() } catch(e) {}
  tiktok = null
  state = { connected:false, user:null, viewers:0, gifts:0, followers:0, messages:0, likes:0, diamonds:0 }
  broadcast({ type:'DISCONNECTED', state })
  res.json({ ok:true })
})

app.get('/state',  (_, res) => res.json(state))
app.get('/status', (_, res) => res.json({ ok:true }))

// Simular eventos de prueba
const DEMO = [
  { title:'❤️ @miguelgamer dio 21 likes',  desc:'+21 likes',          apply:s=>{ s.likes+=21 } },
  { title:'🎁 @jibenv6 envió 7x Rose',      desc:'+35 diamantes',      apply:s=>{ s.gifts++; s.diamonds+=35 } },
  { title:'➕ @newcomer00 te siguió',        desc:'Nuevo seguidor.',    apply:s=>{ s.followers++ } },
  { title:'💬 @fanprimero: "Hola!"',        desc:'Mensaje en el chat.',apply:s=>{ s.messages++ } },
  { title:'⚔️ Bonus Mission detectada',     desc:'72% completado.',    apply:s=>{}  },
  { title:'🎁 @mvpking envió 1x Lion',      desc:'+199 diamantes.',    apply:s=>{ s.gifts++; s.diamonds+=199 } },
]
let demoIdx = 0

app.post('/simulate', (_, res) => {
  const ev = DEMO[demoIdx++ % DEMO.length]
  ev.apply(state)
  state.viewers = Math.max(1, state.viewers + (Math.random()>.5?1:-1))
  const event = { title:ev.title, desc:ev.desc }
  broadcast({ type:'EVENT', event, state })
  res.json({ ok:true })
})

wss.on('connection', ws => ws.send(JSON.stringify({ type:'HELLO', state })))

const PORT = process.env.PORT || 3001
server.listen(PORT, () => console.log(`TikShankz backend :${PORT}`))
