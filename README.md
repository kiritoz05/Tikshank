# TikShankz

Monorepo inicial para un panel estilo TikControl enfocado en TikTok LIVE.

## Stack
- Frontend: Next.js para Vercel
- Backend realtime: Node.js para Railway
- Base de datos: PostgreSQL
- Cache/colas: Redis

## Apps
- `apps/web`: dashboard y overlays
- `apps/api`: backend realtime, reglas y sockets

## Despliegue
### Vercel
Vercel detecta proyectos Next.js automáticamente al importar el repositorio desde GitHub.

### Railway
Railway permite desplegar Node.js y aprovisionar PostgreSQL y Redis dentro del mismo proyecto.

## Primer objetivo
1. Dashboard móvil oscuro
2. Menú lateral deslizable
3. KPIs básicos
4. Actividad en tiempo real
5. Base para alertas, TTS, overlays, batallas, analítica y eventos
