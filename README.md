# SFIT — Sistema de Fiscalización Inteligente de Transporte

Monorepo NestJS + React 18 para la fiscalización del transporte público en municipalidades de Cotabambas y Chumbivilcas (Apurímac / Cusco, Perú).

---

## Estructura del proyecto

```
/sfit
├── backend/          NestJS 10 · TypeORM · PostgreSQL · Redis · Socket.io
├── frontend/         React 18 · Vite · TypeScript · Tailwind CSS
├── shared/           Types compartidos
├── docker-compose.yml
├── .env.example      ← Copiar a .env y ajustar
└── README.md
```

---

## Requisitos previos

| Herramienta | Versión mínima |
|---|---|
| Node.js | >= 18 |
| npm | >= 9 |
| Docker | >= 24 |
| Docker Compose | >= 2.20 |

---

## Instalación y ejecución

### 1. Variables de entorno

```bash
cp .env.example .env
# Editar .env con tus valores reales (JWT_SECRET, SMTP, etc.)
```

### 2. Levantar PostgreSQL + Redis

```bash
docker-compose up -d
# Verificar que ambos contenedores estén healthy:
docker-compose ps
```

### 3. Instalar dependencias (root + backend + frontend)

```bash
npm install           # instala workspaces
# o manualmente:
cd backend  && npm install
cd ../frontend && npm install
```

### 4. Inicializar la base de datos con datos de prueba

```bash
cd backend
npm run seed
```

La semilla crea:
- 4 municipalidades (Cotabambas, Challhuahuacho, Chumbivilcas, Colquemarca)
- 6 usuarios por municipalidad (admin, fiscal, 2 operadores, 2 ciudadanos)
- 3 empresas × 4 municipalidades = 12 empresas
- 5 conductores × 12 empresas = 60 conductores (mix APTO/RIESGO/NO_APTO)
- 3 vehículos × 12 empresas = 36 vehículos con QR
- Rutas especiales (Arequipa→Challhuahuacho, Cusco→Tambobamba) + rutas locales
- 20 viajes, 10 reportes ciudadanos, 5 sanciones de ejemplo

### 5. Iniciar en desarrollo

```bash
# Terminal 1 — Backend  (http://localhost:3000)
cd backend && npm run dev

# Terminal 2 — Frontend (http://localhost:5173)
cd frontend && npm run dev
```

---

## URLs de acceso

| Servicio | URL |
|---|---|
| Frontend (React PWA) | http://localhost:5173 |
| Backend REST API | http://localhost:3000/api |
| Swagger / OpenAPI | http://localhost:3000/api/docs |
| PostgreSQL | localhost:5432 (DB: sfit_db) |
| Redis | localhost:6379 |

---

## Credenciales de prueba (password: `Sfit2026!`)

| Email | Rol | Municipalidad |
|---|---|---|
| admin@tambobamba.gob.pe | ADMIN_MUNICIPAL | Cotabambas |
| fiscal@tambobamba.gob.pe | FISCAL | Cotabambas |
| operador1@cotabambas.test | OPERADOR_EMPRESA | Cotabambas |
| ciudadano1@cotabambas.test | CIUDADANO | Cotabambas |
| admin@challhuahuacho.gob.pe | ADMIN_MUNICIPAL | Challhuahuacho |
| fiscal@challhuahuacho.gob.pe | FISCAL | Challhuahuacho |
| admin@santotomas.gob.pe | ADMIN_MUNICIPAL | Chumbivilcas |
| admin@colquemarca.gob.pe | ADMIN_MUNICIPAL | Colquemarca |

---

## Tests

### Tests unitarios (Jest)

```bash
cd backend
npm test               # todos los tests *.spec.ts
npm run test:cov       # con cobertura
npm run test:watch     # modo watch
```

Módulos con cobertura completa:
`auth` · `fatigue` · `incentives` · `municipal-reports` · `notifications` · `qr` · `reports` · `reputation` · `sanctions`

### Tests E2E (supertest + jest)

```bash
# Instalar dependencias E2E (solo primera vez)
cd backend && npm i -D supertest @types/supertest

# Asegurar que la DB esté activa
docker-compose up -d

# Ejecutar tests E2E
npm run test:e2e

# Un suite específico
npm run test:e2e -- trip-flow
npm run test:e2e -- citizen-report
npm run test:e2e -- sanctions-flow
```

Los tests E2E crean y limpian sus propios datos en la BD. No modifican los datos del seed.

---

## Arquitectura de módulos (backend)

```
auth            → JWT, registro/login, refresh token
routes          → CRUD de rutas + validación de requisitos
fatigue         → Motor de evaluación de fatiga (FatigueEngine)
trips           → Registro de viajes, control pre-salida, auto-cierre
qr              → Generación/escaneo de QR con HMAC
reports         → Reportes ciudadanos con sistema anti-fraude 5 capas
sanctions       → Motor de sanciones + apelaciones
notifications   → Multi-canal: WEB (Socket.io) + WhatsApp + Email
reputation      → Cálculo ponderado de reputación (conductores, vehículos, empresas)
incentives      → Sistema de puntos para ciudadanos + rankings
municipal-reports → Reportes semanales/mensuales + CSV + email automático
companies       → CRUD de empresas de transporte
drivers         → CRUD de conductores
vehicles        → CRUD de vehículos + generación QR
```

---

## Seguridad

| Mecanismo | Implementación |
|---|---|
| Autenticación | JWT (access token en memoria + refresh token en sessionStorage) |
| Autorización | RBAC con `RolesGuard` + decorador `@Roles()` |
| Multi-tenancy | `MunicipalityGuard` — cada query filtra por `municipality_id` |
| Rate limiting | `ThrottlerModule` — 100 req/min por defecto (configurable en .env) |
| QR anti-fraude | HMAC-SHA256 firmado con `QR_HMAC_SECRET` |
| CORS | Configurado en `main.ts` — solo permite `FRONTEND_URL` |
| Contraseñas | bcrypt con 12 rounds |
| Anti-fraude reportes | 5 capas: identidad, contexto, límite diario, QR-HMAC, corroboración |

---

## Variables de entorno — referencia completa

Ver `.env.example` para la lista completa con descripción de cada variable.

Variables **obligatorias** antes de ir a producción:
- `JWT_SECRET` — clave aleatoria de al menos 32 caracteres
- `JWT_REFRESH_SECRET` — idem
- `QR_HMAC_SECRET` — clave aleatoria de al menos 32 caracteres
- `DB_PASSWORD` — contraseña segura para PostgreSQL
- `DB_SYNCHRONIZE=false` — nunca sincronización automática en producción

---

## Docker Compose

```bash
docker-compose up -d          # Levanta PostgreSQL 16 + Redis 7
docker-compose down           # Detiene y elimina contenedores
docker-compose down -v        # También elimina volúmenes (¡borra datos!)
docker-compose logs -f        # Ver logs en tiempo real
```

---

## Comandos útiles

```bash
# Backend
cd backend
npm run dev                   # Desarrollo con hot-reload
npm run build                 # Compilar para producción
npm run start:prod            # Iniciar compilado
npm run seed                  # Poblar BD con datos de prueba
npm run lint                  # ESLint

# Frontend
cd frontend
npm run dev                   # Desarrollo
npm run build                 # Build para producción
npm run preview               # Preview del build
```

---

## Verificación de filtro de municipalidad

El sistema es multi-tenant: cada usuario solo puede ver y gestionar datos de su municipalidad. Esto se verifica a nivel de:

1. **Guard** (`MunicipalityGuard`) — bloquea requests a rutas de otra municipalidad
2. **Service** — todos los `findAll`, `findOne` filtran por `municipality_id`
3. **TripService** — valida que vehículo y ruta pertenezcan al `municipality_id` del operador
4. **ReportsService** — valida que el ciudadano esté en la misma municipalidad del vehículo

Para verificar manualmente: intentar acceder a `/api/trips` con un token de Cotabambas no debe retornar datos de Challhuahuacho.

---

> SFIT © 2026 — Municipalidades de Cotabambas y Chumbivilcas
