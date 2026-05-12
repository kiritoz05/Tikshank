import Fastify from 'fastify'

const app = Fastify({ logger: true })

app.get('/health', async () => ({ status: 'ok', app: 'tikshankz-api' }))
app.get('/features', async () => ({
  alerts: true,
  tts: true,
  overlays: true,
  analytics: true,
  moderation: true,
  battles: true,
  gaming: true,
  events: true
}))

const port = process.env.PORT || 3001
app.listen({ port, host: '0.0.0.0' }).catch(err => {
  app.log.error(err)
  process.exit(1)
})
