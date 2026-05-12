import { WebcastPushConnection } from 'tiktok-live-connector'

// Estado global compartido entre API routes (mismo proceso Node)
if (!global._tks) {
  global._tks = { conn: null, state: { connected:false, user:null, viewers:0, gifts:0, followers:0, messages:0, likes:0, diamonds:0 }, events:[] }
}
const G = global._tks

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { user } = req.body
  if (!user) return res.status(400).json({ error: 'user requerido' })

  try {
    if (G.conn) { try { G.conn.disconnect() } catch(e){} G.conn = null }

    const conn = new WebcastPushConnection(user)
    G.conn = conn
    G.state = { connected:false, user, viewers:0, gifts:0, followers:0, messages:0, likes:0, diamonds:0 }
    G.events = []

    conn.on('roomUser',  d => { G.state.viewers = d.viewerCount })
    conn.on('like',      d => { G.state.likes += d.likeCount; G.events.unshift({ title:`❤️ @${d.uniqueId} dio likes`, desc:`+${d.likeCount} likes` }); G.events = G.events.slice(0,50) })
    conn.on('follow',    d => { G.state.followers++; G.events.unshift({ title:`➕ @${d.uniqueId} te siguió`, desc:'Nuevo seguidor en el live.' }); G.events = G.events.slice(0,50) })
    conn.on('gift',      d => {
      if (d.giftType===1 && !d.repeatEnd) return
      G.state.gifts++; G.state.diamonds += d.diamondCount * d.repeatCount
      G.events.unshift({ title:`🎁 @${d.uniqueId} envió ${d.repeatCount}x ${d.giftName}`, desc:`+${d.diamondCount*d.repeatCount} diamantes` })
      G.events = G.events.slice(0,50)
    })
    conn.on('chat', d => {
      G.state.messages++
      G.events.unshift({ title:`💬 @${d.uniqueId}: "${d.comment}"`, desc:'Mensaje en el chat del live.' })
      G.events = G.events.slice(0,50)
    })
    conn.on('streamEnd', () => { G.state.connected = false })

    const info = await conn.connect()
    G.state.connected = true
    G.state.viewers = info.roomInfo?.userCount || 0
    res.json({ ok: true, roomId: info.roomId })

  } catch(err) {
    G.conn = null
    const msg = err.message || ''
    if (msg.includes('LIVE')) return res.status(400).json({ error: `@${user} no está en LIVE ahora mismo.` })
    return res.status(400).json({ error: `No se encontró el usuario @${user}. Verifica que exista en TikTok.` })
  }
}
