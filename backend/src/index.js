const express = require('express')
const http    = require('http')
const WebSocket = require('ws')
const cors    = require('cors')

const app = express()
const ORIGIN = process.env.ALLOWED_ORIGIN || '*'

app.use(cors({ origin: ORIGIN }))
app.use(express.json())

// ── Estado del live ──────────────────────────────────────────────────────────
let state = {
  connected: false, user: null,
  viewers: 0, gifts: 0, followers: 0, messages: 0, likes: 0, diamonds: 0,
  events: []
}

const server = http.createServer(app)
const wss    = new WebSocket.Server({ server })

function broadcast(data) {
  const msg = JSON.stringify(data)
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg) })
}

// ── API REST ─────────────────────────────────────────────────────────────────
app.get('/status', (_, res) => res.json({ ok: true }))
app.get('/state',  (_, res) => res.json(state))

app.post('/connect', (req, res) => {
  state.connected = true
  state.user = req.body.user || 'streamer'
  state.viewers = 6
  broadcast({ type: 'CONNECTED', user: state.user, state })
  res.json({ ok: true })
})

app.post('/disconnect', (_, res) => {
  state = { connected:false, user:null, viewers:0, gifts:0, followers:0, messages:0, likes:0, diamonds:0, events:[] }
  broadcast({ type: 'DISCONNECTED', state })
  res.json({ ok: true })
})

const EVENTS = [
  { title:'❤️ @miguelgamer dio 21 likes',   desc:'Trigger: sumar meta de likes + overlay flash.',        apply: s => { s.likes += 21 } },
  { title:'🎁 @jibenv6 envió 7x Rose',       desc:'Gift detectado: TTS "Gracias por tu rosa".',            apply: s => { s.gifts++; s.diamonds += 35 } },
  { title:'➕ @newcomer00 te siguió',         desc:'Seguidor nuevo. Mensaje automático enviado.',           apply: s => { s.followers++ } },
  { title:'💬 @fanprimero: "Hola hermosa!"', desc:'Comentario en chat. Moderación: OK.',                   apply: s => { s.messages++ } },
  { title:'⚔️ Bonus Mission detectada',      desc:'Overlay urgencia activo. 72% completado.',             apply: s => {} },
  { title:'🎁 @mvpking envió 1x Lion',       desc:'Gift VIP: sonido especial + TTS VIP.',                  apply: s => { s.gifts++; s.diamonds += 199 } },
  { title:'💬 @chatero: "cuánto falta?"',   desc:'Comando → respuesta rápida al chat.',                   apply: s => { s.messages++ } },
  { title:'➕ @tiktokfan99 te siguió',        desc:'Meta de seguidores actualizada.',                      apply: s => { s.followers++ } },
]
let evIdx = 0

app.post('/simulate', (_, res) => {
  if (!state.connected) return res.status(400).json({ error: 'not connected' })
  const ev = EVENTS[evIdx++ % EVENTS.length]
  ev.apply(state)
  state.viewers = Math.max(1, state.viewers + (Math.random() > .5 ? 1 : -1))
  const event = { title: ev.title, desc: ev.desc, ts: new Date().toISOString() }
  state.events = [event, ...state.events].slice(0, 50)
  broadcast({ type: 'EVENT', event, state })
  res.json({ ok: true, event })
})

// ── WebSocket handshake ───────────────────────────────────────────────────────
wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'HELLO', state }))
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => console.log(`TikShankz backend :${PORT}`))
