# Variables de entorno — Railway Dashboard

Ve a tu proyecto en Railway → Settings → Variables y agrega:

| Variable         | Valor                              | Descripción                         |
|------------------|------------------------------------|-------------------------------------|
| `EL_KEY`         | sk_tu_key_de_elevenlabs            | API Key ElevenLabs (NO en el código)|
| `ADMIN_SECRET`   | una_contraseña_segura_larga        | Contraseña del panel admin          |
| `SESSION_SECRET` | string_aleatorio_muy_largo_64chars | Firma JWT (genera uno aleatorio)    |
| `ALLOWED_ORIGIN` | https://tikshank.vercel.app        | URL de tu Vercel (sin / al final)   |

## Generar SESSION_SECRET seguro:
En tu terminal: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

## Flujo de autenticación ahora:
1. Frontend hace POST /auth/login con email+password
2. Backend devuelve JWT token
3. Frontend guarda token en memoria (NO localStorage)
4. Todas las llamadas incluyen: Authorization: Bearer <token>
5. Socket.io conecta con: io(SERVER, { auth: { token } })
