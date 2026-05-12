if (!global._tks) global._tks = { conn:null, state:{connected:false,user:null,viewers:0,gifts:0,followers:0,messages:0,likes:0,diamonds:0}, events:[] }
const G = global._tks
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  try { if (G.conn) G.conn.disconnect() } catch(e) {}
  G.conn = null
  G.state = { connected:false, user:null, viewers:0, gifts:0, followers:0, messages:0, likes:0, diamonds:0 }
  G.events = []
  res.json({ ok: true })
}
