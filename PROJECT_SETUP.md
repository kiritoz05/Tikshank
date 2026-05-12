# TikShankz setup

## Qué incluye
- Base monorepo
- `apps/web` con Next.js y dashboard inicial
- `apps/api` con Fastify
- README con stack y objetivo

## Cómo usar
### Web
```bash
cd apps/web
npm install
npm run dev
```

### API
```bash
cd apps/api
npm install
npm run dev
```

## Despliegue
- Vercel para `apps/web`
- Railway para `apps/api` con PostgreSQL y Redis
