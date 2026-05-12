# TikShankz — Live Dashboard

Panel tipo TikControl para TikTok LIVE.

## Stack
- **Frontend** → Vercel (Next.js)
- **Backend** → Railway (Node.js + WebSocket)
- **Repo** → GitHub

## Cómo subir

```bash
git init
git add .
git commit -m "init TikShankz"
git remote add origin https://github.com/TU_USUARIO/tikshankz.git
git push -u origin main
```

Luego:
1. Railway → New Project → Deploy from GitHub → carpeta `backend`
2. Vercel → New Project → Import GitHub → carpeta `frontend` → agregar variables `.env`
