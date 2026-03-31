# SFIT — Despliegue en Railway

## Requisitos
- Cuenta en [railway.app](https://railway.app) (login con GitHub)
- Repositorio de SFIT en GitHub (puede ser privado)

---

## Paso 1 — Subir el código a GitHub

```bash
# En la raíz del proyecto (si aún no está en git)
git init
git add .
git commit -m "SFIT listo para deploy en Railway"
git remote add origin https://github.com/yeisonccosccochahua-bot/sfit.git
git push -u origin main
```

---

## Paso 2 — Crear proyecto en Railway

1. Ir a **railway.app/new**
2. Click **"Deploy from GitHub repo"** → seleccionar tu repo de SFIT
3. Railway detecta automáticamente el monorepo

---

## Paso 3 — Agregar PostgreSQL

1. En el proyecto → **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway crea la instancia y genera `DATABASE_URL` automáticamente

---

## Paso 4 — Agregar Redis

1. **"New"** → **"Database"** → **"Add Redis"**
2. Railway genera `REDIS_URL` automáticamente

---

## Paso 5 — Configurar servicio Backend

1. **"New"** → **"GitHub Repo"** → mismo repo
2. En **Settings** del servicio:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node dist/main.js`
3. Vincular PostgreSQL y Redis al servicio (Railway inyecta `DATABASE_URL` y `REDIS_URL`)
4. En **Variables**, agregar:

| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DB_SYNCHRONIZE` | `true` *(solo primer deploy)* |
| `JWT_SECRET` | *(genera: `openssl rand -hex 32`)* |
| `JWT_EXPIRATION` | `8h` |
| `JWT_REFRESH_SECRET` | *(genera: `openssl rand -hex 32`)* |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `QR_HMAC_SECRET` | *(genera: `openssl rand -hex 32`)* |
| `SWAGGER_ENABLED` | `true` |
| `FRONTEND_URL` | *(se completa en Paso 7)* |

5. Click **"Generate Domain"** → anota la URL (ej: `https://sfit-backend.up.railway.app`)

---

## Paso 6 — Ejecutar seed de datos demo

Una vez que el backend arrancó (logs muestran `🚀 SFIT Backend corriendo`):

**Opción A — Railway CLI:**
```bash
# Instalar Railway CLI
npm install -g @railway/cli
railway login
railway link   # seleccionar tu proyecto y servicio backend

# Ejecutar seed
railway run npm run seed:prod
```

**Opción B — Railway Shell (desde el panel):**
En el servicio backend → pestaña "Deploy" → "Railway Shell":
```bash
npm run seed:prod
```

**Tras el seed**, deshabilitar synchronize:
- En Variables del backend: cambiar `DB_SYNCHRONIZE` a `false`
- Railway re-desplegará automáticamente

---

## Paso 7 — Configurar servicio Frontend

1. **"New"** → **"GitHub Repo"** → mismo repo
2. En **Settings**:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npx serve dist -s -l tcp://0.0.0.0:$PORT`
3. En **Variables**, agregar:

| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | `https://sfit-backend.up.railway.app` *(URL del Paso 5)* |
| `VITE_WS_URL` | `https://sfit-backend.up.railway.app` *(misma URL)* |

4. Click **"Generate Domain"** → anota la URL (ej: `https://sfit-frontend.up.railway.app`)

---

## Paso 8 — Actualizar CORS del backend

1. En Variables del servicio backend, actualizar:
   - `FRONTEND_URL` = `https://sfit-frontend.up.railway.app`
2. Railway redespliega automáticamente

---

## Paso 9 — Verificar

```
✅ https://sfit-backend.up.railway.app/health        → {"status":"ok"}
✅ https://sfit-backend.up.railway.app/api/docs      → Swagger UI
✅ https://sfit-frontend.up.railway.app              → Login SFIT
```

---

## Usuarios para la exposición

| Email | Password | Rol |
|-------|----------|-----|
| `admin@sfit.gob.pe` | `Demo2026!` | Admin Municipal |
| `fiscal@sfit.gob.pe` | `Demo2026!` | Fiscal |
| `inspector@sfit.gob.pe` | `Demo2026!` | Inspector |
| `operador@sfit.gob.pe` | `Demo2026!` | Operador Empresa |
| `ciudadano@sfit.gob.pe` | `Demo2026!` | Ciudadano |

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| Error CORS | Verificar que `FRONTEND_URL` en backend coincida exactamente con la URL del frontend (con `https://`) |
| Error de BD | Verificar que `DATABASE_URL` esté vinculada al servicio PostgreSQL |
| Frontend no llama a la API | Verificar `VITE_API_URL` apunta al backend correcto (se bake en build time) |
| WebSocket no conecta | Verificar `VITE_WS_URL` = misma URL que el backend |
| Fotos no persisten al redeploy | Normal en Railway (filesystem efímero). Para producción real, migrar a Cloudinary/S3 |
| Error 503 al entrar | El servicio tarda 30-60s en arrancar en el primer request (cold start en plan gratuito) |
| `relation does not exist` | Correr seed:prod o activar `DB_SYNCHRONIZE=true` temporalmente y reiniciar |

---

## Dominio personalizado (opcional)

1. En Railway → servicio frontend → **Settings** → **Domains** → **Custom Domain**
2. Ingresar tu dominio (ej: `sfit.tudominio.com`)
3. Railway da un registro CNAME → agregarlo en tu proveedor DNS
4. Esperar 5-15 min para propagación
5. Repetir para el backend: `api.tudominio.com`
6. Actualizar `FRONTEND_URL` y `VITE_API_URL` con los nuevos dominios

---

## Costos estimados (Railway Hobby Plan — $5/mes)

| Servicio | Costo |
|----------|-------|
| Backend (NestJS) | ~$1-2/mes |
| Frontend (serve) | ~$0.50/mes |
| PostgreSQL | ~$1/mes |
| Redis | ~$0.50/mes |
| **Total** | **~$3-4/mes** |
