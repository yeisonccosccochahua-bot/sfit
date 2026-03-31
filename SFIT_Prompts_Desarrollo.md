# SFIT v1.0 — Prompts de Desarrollo Secuenciales
## Para usar con Claude como asistente de programación en VS Code

**Stack:** NestJS (TypeScript) + React + Vite + Tailwind + PostgreSQL + Redis
**Instrucciones:** Copia y pega cada prompt uno por uno. Espera a que Claude termine completamente antes de pasar al siguiente. No saltes prompts.

---

## FASE 0: FUNDACIÓN (Prompts 1-5)

---

### PROMPT 1 — Estructura del proyecto monorepo

```
Crea la estructura base de un monorepo para el proyecto "SFIT" (Sistema de Fiscalización Inteligente de Transporte) con la siguiente estructura:

/sfit
├── /backend        → NestJS con TypeScript
├── /frontend       → React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
├── /shared         → Types compartidos entre backend y frontend
├── docker-compose.yml → PostgreSQL 16 + Redis
├── .env.example
├── .gitignore
└── README.md

Para el backend (NestJS):
- Inicializa con `@nestjs/cli`
- Configura TypeORM con PostgreSQL
- Configura Redis con @nestjs/cache-manager
- Agrega dependencias: @nestjs/jwt, @nestjs/passport, passport-jwt, bcrypt, class-validator, class-transformer, @nestjs/swagger, qrcode, socket.io, @nestjs/websockets
- Configura Swagger en /api/docs
- Configura CORS para localhost:5173 (Vite)

Para el frontend (React):
- Inicializa con Vite + React + TypeScript
- Instala: tailwindcss, @shadcn/ui, react-router-dom, axios, socket.io-client, react-qr-reader, lucide-react, recharts, zustand, react-hook-form, zod
- Configura Tailwind CSS
- Configura proxy a localhost:3000 (backend)

Docker-compose:
- PostgreSQL 16 en puerto 5432 (db: sfit_db, user: sfit_user, pass: sfit_pass_2026)
- Redis en puerto 6379

Crea el .env.example con todas las variables necesarias.
No crees ningún módulo funcional aún, solo la estructura base limpia y lista para empezar.
```

---

### PROMPT 2 — Base de datos: entidades y migraciones

```
Dentro del proyecto SFIT backend, crea TODAS las entidades de TypeORM para el sistema. El sistema es multi-municipalidad (4 municipalidades comparten el mismo sistema, filtrado por jurisdicción).

Entidades a crear:

1. **Municipality** — id, name, province, district, region, config_json (umbrales de sanción, pesos de reputación), status, created_at, updated_at

2. **User** — id, email, password_hash, role (ENUM: ADMIN_MUNICIPAL, FISCAL, OPERADOR_EMPRESA, CIUDADANO, INSPECTOR), municipality_id (FK), dni, name, phone, reputation_score (default 100), total_points (default 0), reports_today (default 0), status (ACTIVO|BLOQUEADO|SUSPENDIDO), created_at, updated_at

3. **Company** — id, ruc, name, address, license, municipality_id (FK), status, reputation_score, created_at, updated_at

4. **Vehicle** — id, plate, qr_code (unique), qr_hmac, company_id (FK), status, reputation_score, created_at, updated_at

5. **Driver** — id, dni (unique), name, license_number, license_photo_url, photo_expires_at, company_id (FK), reputation_score (default 100), status (APTO|RIESGO|NO_APTO), total_hours_driven_24h, last_rest_start, created_at, updated_at

6. **Route** — id, origin, destination, stops (json array), estimated_duration_minutes, type (PREDEFINIDA|ESPECIAL), min_drivers (default 1), rest_between_legs_hours (nullable), allows_roundtrip (boolean default false), municipality_id (FK), authorized_by (FK User), status, created_at, updated_at

7. **Trip** — id, vehicle_id (FK), route_id (FK), start_time, end_time (nullable), status (REGISTRADO|EN_CURSO|FINALIZADO|CANCELADO|CERRADO_AUTO), fatigue_result (APTO|RIESGO|NO_APTO), auto_closed (boolean default false), is_return_leg (boolean default false), parent_trip_id (self FK nullable), municipality_id (FK), registered_by (FK User), created_at, updated_at

8. **TripDriver** — id, trip_id (FK), driver_id (FK), role (PRINCIPAL|SUPLENTE|COPILOTO), fatigue_check_result (APTO|RIESGO|NO_APTO), assigned_at

9. **FatigueLog** — id, driver_id (FK), evaluation_date, hours_driven_24h, last_rest_hours, result (APTO|RIESGO|NO_APTO), details_json, created_at

10. **Report** — id, trip_id (FK), citizen_id (FK User), type (ENUM: CONDUCTOR_DIFERENTE, CONDICION_VEHICULO, CONDUCCION_PELIGROSA, EXCESO_VELOCIDAD, OTRO), description, photo_url (nullable), status (PENDIENTE|VALIDO|INVALIDO|EN_REVISION), validation_score, created_at

11. **Sanction** — id, driver_id (FK), level (1|2|3|4), reason, evidence_ids (json array), appeal_status (SIN_APELACION|EN_APELACION|APELACION_ACEPTADA|APELACION_RECHAZADA), appeal_deadline (nullable), fine_amount (nullable decimal), municipality_id (FK), issued_by (FK User), resolved_date (nullable), created_at, updated_at

12. **Appeal** — id, sanction_id (FK), description, evidence_urls (json array), status (PENDIENTE|ACEPTADA|RECHAZADA), submitted_at, resolved_at, resolved_by (FK User nullable)

13. **IncentivePoint** — id, citizen_id (FK User), points, action_type (REPORTE_VALIDO|REPORTE_CON_SANCION|BONUS), report_id (FK nullable), date, created_at

14. **Notification** — id, user_id (FK), channel (WHATSAPP|EMAIL|WEB), type, title, content, status (PENDIENTE|ENVIADO|FALLIDO|LEIDO), sent_at (nullable), created_at

15. **AuditLog** — id, user_id (FK), action, entity_type, entity_id, details_json, ip, created_at

16. **Municipality** ya tiene relación con todas las entidades principales.

Asegúrate de:
- Usar decoradores de TypeORM (@Entity, @Column, @ManyToOne, @OneToMany, @JoinColumn, etc.)
- Agregar índices en: dni, plate, qr_code, municipality_id, status, created_at
- Crear una migración inicial con TypeORM
- Crear un seed para las 4 municipalidades: Cotabambas (provincial, Apurímac), Challhuahuacho (distrital, Apurímac), Chumbivilcas (provincial, Cusco), Colquemarca (distrital, Cusco)
- Crear un seed para las 2 rutas especiales:
  - Arequipa ↔ Challhuahuacho: 660 min, min_drivers=2, tipo PREDEFINIDA
  - Cusco ↔ Tambobamba: 300 min, rest_between_legs_hours=4, allows_roundtrip=true, tipo PREDEFINIDA

Organiza las entidades en /backend/src/entities/ con un archivo por entidad.
```

---

### PROMPT 3 — Módulo de autenticación y RBAC

```
Dentro del backend SFIT, crea el módulo completo de autenticación y autorización:

/backend/src/modules/auth/

Implementa:

1. **AuthModule** con:
   - Registro de usuario (POST /api/auth/register)
     - Campos: email, password, name, dni, phone, role, municipality_id
     - Validar que el DNI sea único
     - Hash de password con bcrypt (12 rounds)
     - El rol CIUDADANO se registra desde la PWA
     - Los roles ADMIN_MUNICIPAL, FISCAL, OPERADOR_EMPRESA, INSPECTOR solo los crea un ADMIN_MUNICIPAL
   - Login (POST /api/auth/login)
     - Retorna JWT (access_token, expires_in: 8h)
     - El JWT debe incluir: userId, role, municipalityId
   - Perfil (GET /api/auth/profile) — datos del usuario autenticado
   - Refresh token (POST /api/auth/refresh)

2. **Guards y Decorators**:
   - JwtAuthGuard — valida JWT en cada request protegido
   - RolesGuard — valida que el usuario tenga el rol requerido
   - @Roles('ADMIN_MUNICIPAL', 'FISCAL') — decorator para definir roles permitidos
   - @CurrentUser() — decorator para obtener el usuario del request
   - MunicipalityGuard — CRÍTICO: filtra automáticamente los datos por municipality_id del usuario logueado. Ningún usuario puede ver datos de otra municipalidad.

3. **DTOs con validación** (class-validator):
   - RegisterDto, LoginDto, UpdateProfileDto

4. **Tests unitarios** para el servicio de autenticación (al menos 5 tests)

Importante:
- Todos los endpoints protegidos deben pasar por JwtAuthGuard + RolesGuard
- El MunicipalityGuard debe inyectar automáticamente el filtro municipality_id en todas las queries
- Documenta todos los endpoints con Swagger (@ApiTags, @ApiOperation, @ApiResponse)
```

---

### PROMPT 4 — Módulos CRUD base (empresas, conductores, vehículos)

```
Dentro del backend SFIT, crea los módulos CRUD para las entidades principales. Todos deben respetar el filtro de municipalidad (solo ver datos de su jurisdicción).

Crea estos 3 módulos:

## 1. CompaniesModule (/api/companies)
- CRUD completo (GET list, GET :id, POST, PATCH :id, DELETE :id)
- Solo ADMIN_MUNICIPAL y FISCAL pueden crear/editar
- OPERADOR_EMPRESA solo ve su propia empresa
- Filtro automático por municipality_id
- Paginación (page, limit, search por nombre/ruc)
- Incluir conteo de vehículos y conductores en la respuesta

## 2. DriversModule (/api/drivers)
- CRUD completo
- OPERADOR_EMPRESA solo CRUD de conductores de su empresa
- ADMIN_MUNICIPAL y FISCAL ven todos los de su municipalidad
- Campos especiales:
  - license_photo_url: subir foto (guardar en /uploads/drivers/)
  - photo_expires_at: automáticamente 30 días desde la subida
  - Un cron job que elimine fotos expiradas cada día a las 00:00
- Incluir último estado de fatiga en la respuesta
- Endpoint especial: GET /api/drivers/:id/fatigue-history (historial de evaluaciones)

## 3. VehiclesModule (/api/vehicles)
- CRUD completo
- Al crear un vehículo, generar automáticamente:
  - qr_code: UUID v4 único
  - qr_hmac: HMAC-SHA256(qr_code, SECRET_KEY)
- Endpoint especial: GET /api/vehicles/:id/qr → retorna imagen QR (usar librería 'qrcode')
  - El QR debe codificar una URL: https://sfit.gob.pe/scan/{qr_code}
- Endpoint: GET /api/vehicles/verify-qr/:qr_code → valida HMAC y retorna datos del vehículo + viaje activo
- Solo OPERADOR_EMPRESA ve vehículos de su empresa
- Paginación + búsqueda por placa

Para todos los módulos:
- DTOs con class-validator
- Swagger completo
- Interceptor de auditoría (registrar en AuditLog cada CREATE, UPDATE, DELETE)
- Manejo de errores consistente con HttpException
```

---

### PROMPT 5 — Módulo de rutas

```
Dentro del backend SFIT, crea el módulo de gestión de rutas:

/backend/src/modules/routes/

El sistema tiene rutas predefinidas y especiales con reglas configurables:

## RoutesModule (/api/routes)

### Endpoints:
- GET /api/routes — lista rutas de la municipalidad (paginación, filtros por tipo/origen/destino)
- GET /api/routes/:id — detalle de ruta con sus reglas
- POST /api/routes — crear ruta (solo ADMIN_MUNICIPAL y FISCAL)
- PATCH /api/routes/:id — editar ruta
- DELETE /api/routes/:id — solo si no tiene viajes asociados

### Reglas por ruta (campos configurables):
- **min_drivers**: conductores mínimos (default 1, puede ser 2 o más)
- **rest_between_legs_hours**: horas de descanso mínimo entre ida y vuelta (nullable)
- **allows_roundtrip**: si permite ida y vuelta con el mismo conductor
- **estimated_duration_minutes**: duración estimada del tramo

### Lógica de negocio:
- Al registrar un viaje, el sistema debe verificar:
  1. Si la ruta requiere min_drivers=2 → bloquear si no hay 2 conductores aptos asignados
  2. Si es viaje de retorno (is_return_leg=true) → verificar que hayan pasado rest_between_legs_hours desde que terminó el viaje de ida
  3. Si la ruta NO permite roundtrip → bloquear el registro de viaje de retorno

### Seed actualizado:
Ya existen estas rutas, verificar que el seed las cree correctamente:
- Arequipa ↔ Challhuahuacho: 660 min, min_drivers=2, PREDEFINIDA
- Cusco ↔ Tambobamba: 300 min, rest_between_legs_hours=4, allows_roundtrip=true, PREDEFINIDA

### Servicio de validación (RouteValidationService):
Crear un servicio reutilizable que otros módulos (como Trips) puedan inyectar para:
- validateDriverRequirements(routeId, driverIds[]) → boolean
- validateReturnLeg(routeId, parentTripId) → { allowed: boolean, reason?: string, waitHours?: number }
- getRouteRules(routeId) → RouteRules

Swagger completo + DTOs + auditoría.
```

---

## FASE 1: NÚCLEO DEL SISTEMA (Prompts 6-10)

---

### PROMPT 6 — Motor de fatiga (cerebro del sistema)

```
Crea el módulo más crítico del sistema SFIT: el Motor de Fatiga.

/backend/src/modules/fatigue/

## FatigueModule

### Servicio principal: FatigueEngineService

Este servicio evalúa si un conductor puede operar basándose en las últimas 24 horas:

#### Reglas de negocio:
- **Tiempo máx. conducción normal:** 8 horas en ventana de 24h
- **Tiempo máx. conducción ruta larga:** 10 horas (solo rutas con estimated_duration > 480 min)
- **Descanso mínimo obligatorio:** 8 horas continuas entre jornadas
- **Alerta de pausa:** A las 4 horas continuas se genera alerta (NO bloqueo)

#### Método principal: evaluateDriver(driverId: string)
Algoritmo:
1. Obtener todos los viajes del conductor en las últimas 24 horas
2. Calcular horas_conducidas_24h = suma de (end_time - start_time) de viajes finalizados + tiempo transcurrido del viaje en curso
3. Calcular last_rest_hours = tiempo desde el último end_time hasta ahora (o hasta el inicio del viaje actual)
4. Determinar estado:
   - **APTO (verde):** descanso >= 8h Y horas_conducidas < 6h
   - **RIESGO (amarillo):** horas_conducidas entre 6-8h O descanso entre 6-8h
   - **NO_APTO (rojo):** descanso < 8h después de jornada completa O horas_conducidas >= 8h
5. Guardar resultado en FatigueLog
6. Actualizar driver.status
7. Si estado es RIESGO → enviar alerta (notificación)
8. Si estado es NO_APTO → el conductor queda bloqueado

#### Método: checkContinuousDriving(driverId: string)
- Si lleva 4+ horas continuas → generar alerta de pausa recomendada
- NO bloquear, solo notificar a empresa y conductor

#### Método: canDriverOperate(driverId: string, routeId: string)
- Ejecuta evaluateDriver()
- Si la ruta tiene min_drivers > 1, esto se valida en otro lugar (RouteValidation)
- Si la ruta es larga (>480min), usar límite de 10h en vez de 8h
- Retorna: { canOperate: boolean, status: APTO|RIESGO|NO_APTO, details: {...} }

### Endpoints:
- GET /api/fatigue/evaluate/:driverId — evaluar conductor ahora
- GET /api/fatigue/history/:driverId — historial de evaluaciones (paginado)
- GET /api/fatigue/dashboard — lista de conductores en RIESGO y NO_APTO (para panel municipal)

### Cron Job:
- Cada 30 minutos: re-evaluar conductores con viajes activos
- Cada 4 horas: verificar conducción continua y enviar alertas

### Tests unitarios (MÍNIMO 8 tests):
1. Conductor con 0h conducidas → APTO
2. Conductor con 7h conducidas → RIESGO
3. Conductor con 9h conducidas → NO_APTO
4. Conductor con descanso de 5h después de jornada → NO_APTO
5. Conductor con descanso de 10h → APTO
6. Ruta larga: conductor con 9h → APTO (límite 10h)
7. Conducción continua 4h+ → genera alerta
8. Conductor sin viajes previos → APTO
```

---

### PROMPT 7 — Módulo de viajes (registro pre-salida)

```
Crea el módulo de gestión de viajes, el flujo principal del sistema SFIT:

/backend/src/modules/trips/

## TripsModule

### Flujo de registro pre-salida:
1. Operador selecciona vehículo (por placa o QR)
2. Selecciona ruta
3. Asigna conductor(es)
4. El sistema evalúa automáticamente:
   a. Fatiga de cada conductor (FatigueEngineService)
   b. Requisitos de la ruta (RouteValidationService)
   c. Si es viaje de retorno: descanso entre tramos
5. Resultado: APROBADO o BLOQUEADO con razón

### Endpoints:

**CRUD de viajes:**
- POST /api/trips — registrar nuevo viaje (pre-salida)
  - Body: { vehicle_id, route_id, driver_ids: [{driver_id, role}], scheduled_start }
  - Validaciones:
    - Vehículo pertenece a la empresa del operador
    - Conductores pertenecen a la empresa
    - Todos los conductores son APTOS (ejecutar evaluación de fatiga)
    - Si ruta requiere min_drivers=2 → verificar
    - Si es retorno → verificar descanso entre tramos
  - Si APROBADO: crear Trip con status REGISTRADO + crear TripDrivers + crear FatigueLogs
  - Si BLOQUEADO: retornar error 409 con detalles (qué conductor falló, por qué)

- PATCH /api/trips/:id/start — iniciar viaje (cambiar a EN_CURSO)
  - Re-evaluar fatiga (pudo cambiar entre registro e inicio)
  - Registrar start_time = now()

- PATCH /api/trips/:id/end — finalizar viaje
  - Registrar end_time = now()
  - Cambiar status a FINALIZADO
  - Recalcular fatiga del conductor

- GET /api/trips — listar viajes (filtros: status, fecha, ruta, conductor, vehículo)
- GET /api/trips/:id — detalle del viaje con conductores y evaluaciones
- GET /api/trips/active — viajes en curso (para dashboard municipal)
- GET /api/trips/vehicle/:vehicleId/active — viaje activo de un vehículo (para escaneo QR)

**Asignación de suplente:**
- PATCH /api/trips/:id/replace-driver
  - Body: { old_driver_id, new_driver_id, role }
  - Validar que el nuevo conductor esté APTO
  - Registrar en AuditLog

**Cierre automático:**
- Cron cada 15 minutos:
  - Buscar viajes EN_CURSO donde (now - start_time) > route.estimated_duration * 1.5
  - Cerrar automáticamente: status=CERRADO_AUTO, auto_closed=true
  - Notificar a la empresa
  - Registrar como incidencia menor

### Viaje de retorno:
- POST /api/trips con is_return_leg=true y parent_trip_id
- El sistema verifica:
  - El viaje padre está FINALIZADO
  - Han pasado route.rest_between_legs_hours desde end_time del padre
  - Si no: retornar cuántas horas faltan

Swagger completo + DTOs + auditoría + manejo de errores.
```

---

### PROMPT 8 — Módulo QR (generación y escaneo)

```
Crea el módulo completo de QR inteligente para SFIT:

/backend/src/modules/qr/

## QrModule

### Generación de QR:
Ya se genera al crear un vehículo (VehiclesModule). Este módulo se enfoca en el ESCANEO y VERIFICACIÓN.

### Endpoints:

1. **GET /api/qr/scan/:qr_code** (PÚBLICO, no requiere auth)
   - Validar HMAC del QR (qr_hmac = HMAC-SHA256(qr_code, SECRET))
   - Si HMAC inválido → 401 "QR no válido o falsificado"
   - Si válido → retornar:
     ```json
     {
       "vehicle": { plate, company_name, qr_valid: true },
       "active_trip": {
         "id", "route": { origin, destination },
         "drivers": [{ name, dni_last_4, photo_url, role, fatigue_status }],
         "start_time", "estimated_arrival",
         "status"
       } | null,
       "can_report": true/false (true si hay viaje activo)
     }
     ```
   - Si no hay viaje activo: active_trip = null, can_report = false

2. **POST /api/qr/validate** (requiere auth CIUDADANO)
   - Body: { qr_code, is_same_driver: boolean, trip_id }
   - El ciudadano confirma si el conductor es el mismo que muestra el sistema
   - Si is_same_driver = false → crear alerta automática para la municipalidad
   - Registrar validación en AuditLog

3. **GET /api/qr/generate/:vehicleId** (requiere auth OPERADOR_EMPRESA)
   - Genera imagen PNG del QR con la URL: https://sfit.gob.pe/scan/{qr_code}
   - Incluir placa del vehículo debajo del QR
   - Retornar como image/png o base64

4. **POST /api/qr/regenerate/:vehicleId** (requiere auth ADMIN_MUNICIPAL)
   - Genera nuevo qr_code y qr_hmac
   - Invalida el anterior
   - Registrar en AuditLog
   - Motivo: QR dañado o comprometido

### Seguridad:
- El QR codifica: https://sfit.gob.pe/scan/{uuid}
- El UUID por sí solo no da acceso sin verificación HMAC en el servidor
- Rate limiting: máximo 30 escaneos por IP por minuto (evitar scraping)

Swagger + DTOs + tests (mínimo 4: HMAC válido, HMAC inválido, viaje activo, sin viaje).
```

---

### PROMPT 9 — Frontend: Layout base, auth y navegación

```
Crea la estructura base del frontend React para SFIT:

/frontend/src/

## Estructura de carpetas:
```
/src
├── /components/ui/        → componentes shadcn/ui
├── /components/layout/    → Header, Sidebar, MainLayout
├── /pages/
│   ├── /auth/            → Login, Register
│   ├── /dashboard/       → DashboardPage (municipal)
│   ├── /operator/        → Panel operador empresa
│   ├── /citizen/         → PWA ciudadano
│   └── /admin/           → Panel admin municipal
├── /hooks/               → useAuth, useApi, useSocket
├── /services/            → api.ts (axios), socket.ts
├── /stores/              → authStore (zustand)
├── /types/               → tipos compartidos
├── /lib/                 → utilidades
├── App.tsx               → Router principal
└── main.tsx
```

## Implementa:

### 1. AuthStore (zustand):
- user, token, isAuthenticated, login(), logout(), checkAuth()
- Persistir token en memoria (NO localStorage por seguridad)
- Interceptor de axios que agrega Authorization header

### 2. API Service (axios):
- Base URL configurable
- Interceptor de request: agrega JWT
- Interceptor de response: si 401 → logout automático
- Métodos tipados: get<T>, post<T>, patch<T>, delete<T>

### 3. Páginas de Auth:
- **LoginPage**: formulario email + password, react-hook-form + zod
  - Diseño centrado, logo SFIT arriba, fondo azul institucional
  - Después del login: redirigir según rol:
    - ADMIN_MUNICIPAL → /admin
    - FISCAL → /dashboard
    - OPERADOR_EMPRESA → /operator
    - CIUDADANO → /citizen
    - INSPECTOR → /inspector

- **RegisterPage**: solo para CIUDADANO
  - Campos: nombre, DNI, email, teléfono, password
  - Selector de municipalidad (las 4 opciones)

### 4. Layout principal (MainLayout):
- Sidebar izquierdo con navegación según rol
- Header con: nombre usuario, municipalidad, botón logout, notificaciones
- Responsive: sidebar se colapsa en móvil
- Colores institucionales: azul oscuro (#1B4F72), azul medio (#2E86C1), blanco

### 5. Router protegido:
- ProtectedRoute: verifica auth + rol
- Redirige a /login si no autenticado
- Muestra 403 si rol no autorizado

### 6. PWA setup:
- Registrar service worker
- manifest.json con nombre "SFIT", colores institucionales, icono
- Meta tags para instalación

Hazlo visualmente profesional. Colores institucionales de gobierno, tipografía limpia (Inter o system-ui), íconos de Lucide.
```

---

### PROMPT 10 — Frontend: Panel operador (registro de viajes)

```
Crea las páginas del panel operador de empresa en el frontend SFIT:

/frontend/src/pages/operator/

## Páginas:

### 1. OperatorDashboard (/operator)
- Resumen rápido en cards:
  - Viajes activos hoy (con estado)
  - Conductores disponibles / en riesgo / bloqueados
  - Vehículos operativos
- Tabla de últimos viajes (últimas 24h)
- Alertas activas (conductores en riesgo, viajes sin cerrar)

### 2. TripRegistrationPage (/operator/trips/new) — FLUJO PRINCIPAL
Wizard de 4 pasos:

**Paso 1: Seleccionar vehículo**
- Buscador por placa
- Mostrar: placa, estado, último viaje, QR activo
- Si vehículo tiene viaje activo → mostrar alerta

**Paso 2: Seleccionar ruta**
- Dropdown de rutas predefinidas de su municipalidad
- Mostrar: origen → destino, duración estimada, reglas especiales
- Si ruta requiere 2 conductores → mostrar badge "2 CONDUCTORES OBLIGATORIOS"
- Si permite ida y vuelta → mostrar opción "¿Es viaje de retorno?"
  - Si sí: seleccionar viaje de ida (parent_trip) y mostrar si ya cumplió descanso

**Paso 3: Asignar conductor(es)**
- Lista de conductores de la empresa con estado de fatiga en tiempo real
- Cada conductor muestra: nombre, DNI, estado (APTO ✅ / RIESGO ⚠️ / NO_APTO ❌), horas conducidas 24h
- Si ruta requiere 2: obligar a seleccionar 2 conductores APTOS
- Si conductor está NO_APTO: mostrar razón y opción "Asignar suplente"
- Llamar al backend para evaluar fatiga en tiempo real al seleccionar

**Paso 4: Confirmación**
- Resumen completo: vehículo, ruta, conductor(es), hora
- Resultado de evaluación de fatiga por cada conductor
- Botón "REGISTRAR VIAJE" (verde si todo OK, deshabilitado si hay bloqueo)
- Si BLOQUEADO: mostrar en rojo la razón exacta

### 3. TripsListPage (/operator/trips)
- Tabla paginada de viajes
- Filtros: estado, fecha, ruta, conductor
- Acciones: ver detalle, iniciar viaje, finalizar viaje
- Badge de color por estado

### 4. DriversListPage (/operator/drivers)
- Tabla de conductores de la empresa
- Estado de fatiga en tiempo real (colores)
- Ver historial de fatiga
- Gestión básica: agregar, editar

### 5. VehiclesListPage (/operator/vehicles)
- Tabla de vehículos
- Descargar/ver QR de cada vehículo
- Estado operativo

Usa shadcn/ui para todos los componentes (Table, Card, Button, Dialog, Badge, Select, Form).
Usa Lucide para íconos. Diseño limpio y profesional.
```

---

## FASE 2: FISCALIZACIÓN Y CONTROL (Prompts 11-15)

---

### PROMPT 11 — Módulo de reportes ciudadanos (backend)

```
Crea el módulo de reportes ciudadanos con el sistema anti-fraude de 5 capas:

/backend/src/modules/reports/

## ReportsModule

### Endpoint principal: POST /api/reports (requiere auth CIUDADANO)
Body: { trip_id, qr_code, type, description, photo_url?, is_same_driver }

### Las 5 capas anti-fraude (ejecutar en orden):

**Capa 1 - Identidad real:**
- El usuario debe estar autenticado con DNI verificado
- El usuario no debe estar BLOQUEADO

**Capa 2 - Contexto válido:**
- El qr_code debe ser válido (HMAC check)
- El trip_id debe corresponder a un viaje EN_CURSO
- El viaje debe estar asociado al vehículo del QR

**Capa 3 - Límite y reputación:**
- Máximo 3 reportes por ciudadano por día (reports_today < 3)
- Si reputation_score del ciudadano < 30 → rechazar reporte
- Resetear reports_today a 0 todos los días a las 00:00 (cron)

**Capa 4 - Verificación cruzada:**
- Buscar reportes del mismo viaje en los últimos 30 minutos
- Si hay 2+ reportes similares (mismo type) → marcar como VALIDO automáticamente
- Si es reporte aislado → marcar como EN_REVISION
- Calcular validation_score (0-100):
  - Base: 50
  - +20 si ciudadano tiene reputation_score > 80
  - +15 si hay foto adjunta
  - +15 si hay otros reportes similares

**Capa 5 - Post-procesamiento:**
- Si is_same_driver = false → alerta prioritaria a municipalidad
- Registrar en AuditLog
- Otorgar puntos al ciudadano (10 puntos por reporte aceptado)
- Incrementar reports_today del ciudadano

### Otros endpoints:
- GET /api/reports — listar reportes (filtros: status, type, fecha, trip_id)
  - CIUDADANO ve solo sus reportes
  - FISCAL y ADMIN ven todos de su municipalidad
- GET /api/reports/:id — detalle
- PATCH /api/reports/:id/validate — FISCAL valida manualmente (VALIDO o INVALIDO)
  - Si INVALIDO: restar puntos al ciudadano y bajar reputación
  - Si VALIDO: otorgar puntos bonus si derivó en sanción
- GET /api/reports/stats — estadísticas de reportes (para dashboard)

### Efecto en reputación del ciudadano:
- Reporte VALIDO: +2 reputation_score (max 100)
- Reporte INVALIDO: -10 reputation_score
- Si reputation_score < 30: usuario se BLOQUEA automáticamente

Tests: mínimo 6 (capa 1-5 + límite diario).
```

---

### PROMPT 12 — Módulo de sanciones (backend)

```
Crea el módulo de sanciones progresivas para SFIT:

/backend/src/modules/sanctions/

## SanctionsModule

### Niveles de sanción (progresivo):
| Nivel | Tipo | Umbral (configurable por municipalidad) | Acción |
|-------|------|----------------------------------------|--------|
| 1 - Alerta | Solo digital | 1-2 incidencias menores en 30 días | Notificación WhatsApp + email |
| 2 - Observación | Solo digital | 3-5 incidencias o 1 grave en 30 días | Registro negativo visible en perfil |
| 3 - Sanción | Digital + multa | 6+ incidencias o 2+ graves en 30 días | Bloqueo en sistema + multa económica |
| 4 - Escalamiento | Legal | Reincidencia post-Nivel 3 o daño comprobado | Reporte automático a autoridad legal |

### Servicio: SanctionEngineService

**evaluateDriver(driverId):**
1. Contar incidencias del conductor en últimos 30 días:
   - Reportes VÁLIDOS = incidencias menores
   - Viajes CERRADO_AUTO = incidencias menores
   - Evaluaciones NO_APTO ignoradas = incidencias graves
2. Obtener umbrales de la config_json de la municipalidad del conductor
3. Determinar nivel de sanción correspondiente
4. Si nivel > sanción actual → crear nueva sanción
5. Ejecutar acción del nivel

**Método: applyLevel(driverId, level):**
- Nivel 1: crear notificación de alerta
- Nivel 2: marcar registro negativo, crear notificación
- Nivel 3: cambiar driver.status = 'NO_APTO', calcular multa, crear notificación, bloquear de operar
- Nivel 4: generar reporte PDF con evidencia, notificar a municipalidad, crear notificación urgente

### Apelaciones:
- POST /api/sanctions/:id/appeal
  - Body: { description, evidence_urls[] }
  - Solo dentro de 3 días hábiles desde la sanción (appeal_deadline)
  - Cambiar appeal_status a EN_APELACION
  - Notificar al FISCAL de la municipalidad
  - La sanción Nivel 3 se MANTIENE activa durante apelación

- PATCH /api/sanctions/:id/appeal/resolve
  - Solo FISCAL o ADMIN_MUNICIPAL
  - Body: { status: ACEPTADA|RECHAZADA, reason }
  - Si ACEPTADA: levantar sanción, restaurar driver.status
  - Si RECHAZADA: mantener sanción, notificar

### Endpoints:
- GET /api/sanctions — lista (filtros: nivel, status, conductor, fecha)
- GET /api/sanctions/:id — detalle con apelación
- GET /api/sanctions/stats — estadísticas para dashboard
- POST /api/sanctions/evaluate/:driverId — forzar evaluación manual (solo FISCAL)

### Cron: Evaluación automática
- Cada 6 horas: evaluar todos los conductores con incidencias recientes
- Generar sanciones automáticas según umbrales

### Efecto en reputación del conductor:
- Nivel 1: -5 puntos reputación
- Nivel 2: -15 puntos
- Nivel 3: -30 puntos
- Nivel 4: -50 puntos
- Apelación aceptada: restaurar puntos perdidos

Swagger + DTOs + auditoría + tests (mínimo 6).
```

---

### PROMPT 13 — Módulo de notificaciones (backend)

```
Crea el módulo de notificaciones multi-canal para SFIT:

/backend/src/modules/notifications/

## NotificationsModule

### Canales:
1. **WhatsApp** (principal): usando WhatsApp Business API de Meta
2. **Email** (respaldo): usando nodemailer con SMTP configurable
3. **Web** (tiempo real): usando WebSockets (Socket.io)

### Servicio: NotificationService

**send(notification: CreateNotificationDto):**
```typescript
{
  userId: string;
  channels: ('WHATSAPP' | 'EMAIL' | 'WEB')[];
  type: 'FATIGA_RIESGO' | 'FATIGA_BLOQUEADO' | 'SANCION' | 'APELACION' | 'REPORTE_NUEVO' | 'VIAJE_CERRADO_AUTO' | 'PAUSA_RECOMENDADA' | 'ALERTA_CONDUCTOR_DIFERENTE';
  title: string;
  content: string;
  priority: 'ALTA' | 'MEDIA' | 'BAJA';
  metadata?: Record<string, any>;
}
```

### WhatsApp Service:
- Integración con WhatsApp Business API (Cloud API)
- Templates predefinidos para cada tipo de notificación
- Configurar en .env: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID
- Para V1 de desarrollo: crear mock que loguea en consola si no hay credenciales
- Rate limiting: máximo 100 mensajes por minuto

### Email Service:
- Templates HTML para cada tipo de notificación
- Configurar en .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL
- Usar plantilla base con logo SFIT y colores institucionales

### WebSocket Gateway:
- Namespace: /notifications
- Eventos:
  - 'notification:new' — nueva notificación en tiempo real
  - 'dashboard:update' — actualización de datos del dashboard
  - 'trip:status_changed' — cambio de estado de viaje
  - 'fatigue:alert' — alerta de fatiga
- Autenticación por JWT en handshake
- Rooms por municipality_id (cada municipalidad recibe solo sus eventos)

### Endpoints REST:
- GET /api/notifications — mis notificaciones (paginado)
- PATCH /api/notifications/:id/read — marcar como leída
- PATCH /api/notifications/read-all — marcar todas como leídas
- GET /api/notifications/unread-count — contador de no leídas

### Qué eventos generan notificaciones:
| Evento | Canal | Destinatario |
|--------|-------|-------------|
| Conductor RIESGO | WhatsApp + Web | Empresa + Fiscal |
| Conductor BLOQUEADO | WhatsApp + Email + Web | Empresa + Conductor + Fiscal |
| Nueva sanción | WhatsApp + Email | Conductor + Empresa |
| Reporte ciudadano nuevo | Web | Fiscal |
| Conductor diferente detectado | WhatsApp + Web | Fiscal (prioridad ALTA) |
| Viaje cerrado automáticamente | WhatsApp + Web | Empresa |
| Pausa recomendada (4h) | WhatsApp | Empresa |
| Apelación recibida | Web + Email | Fiscal |

Swagger + tests para cada canal.
```

---

### PROMPT 14 — Frontend: Dashboard municipal

```
Crea el dashboard completo del panel municipal para SFIT:

/frontend/src/pages/dashboard/

## DashboardPage (/dashboard)

### Layout:
- Header con: "Panel de Fiscalización — [Nombre Municipalidad]"
- 4 KPI cards en fila superior:
  1. Viajes activos ahora (número grande + badge verde)
  2. Conductores en riesgo (número + badge amarillo)
  3. Conductores bloqueados (número + badge rojo)
  4. Reportes pendientes de revisión (número + badge azul)
- Los KPIs se actualizan en tiempo real via WebSocket

### Sección 1: Mapa de actividad (o tabla de viajes activos)
- Tabla de viajes EN_CURSO con:
  - Vehículo (placa), Ruta, Conductor(es), Hora inicio, Tiempo transcurrido
  - Estado de fatiga de cada conductor (color)
  - Botón "Ver detalle"
- Ordenar por: conductores en RIESGO primero

### Sección 2: Alertas en tiempo real
- Feed vertical de alertas (últimas 20)
- Tipos con iconos y colores:
  - 🔴 Conductor bloqueado
  - 🟡 Conductor en riesgo
  - 🔵 Nuevo reporte ciudadano
  - 🟠 Viaje cerrado automáticamente
  - ⚪ Conductor diferente detectado (PRIORIDAD)
- Nuevas alertas aparecen arriba con animación
- Click → abre detalle

### Sección 3: Reportes ciudadanos pendientes
- Tabla de reportes EN_REVISION
- Columnas: ciudadano, viaje, tipo, descripción, foto (thumbnail), fecha
- Acciones: Validar ✅ | Rechazar ❌ | Ver detalle
- Dialog de validación con campos de razón

### Sección 4: Estadísticas rápidas (gráficos con recharts)
- Gráfico de líneas: viajes por día (últimos 30 días)
- Gráfico de barras: sanciones por nivel (últimos 30 días)
- Gráfico circular: estados de conductores (APTO/RIESGO/NO_APTO)

### Páginas adicionales del panel municipal:
- /dashboard/sanctions — gestión de sanciones (lista + detalle + resolver apelaciones)
- /dashboard/drivers — todos los conductores de la municipalidad con filtros
- /dashboard/reports — todos los reportes con filtros avanzados
- /dashboard/routes — gestión de rutas (CRUD + reglas especiales)
- /dashboard/companies — empresas registradas
- /dashboard/analytics — reportes semanales/mensuales (tablas exportables)

### Hook useSocket:
- Conectar al WebSocket al montar el dashboard
- Escuchar eventos y actualizar estado en tiempo real
- Reconectar automáticamente si se pierde conexión

Todo con shadcn/ui, Lucide icons, recharts. Colores institucionales. Responsive.
```

---

### PROMPT 15 — Frontend: PWA ciudadano (escaneo QR y reportes)

```
Crea la Progressive Web App para ciudadanos en SFIT:

/frontend/src/pages/citizen/

## Páginas:

### 1. CitizenHome (/citizen)
- Bienvenida: "Hola, [nombre]"
- Card grande: "ESCANEAR QR" con ícono de cámara (acción principal)
- Mis estadísticas:
  - Puntos acumulados
  - Reportes realizados hoy (X de 3)
  - Nivel de reputación (barra de progreso)
  - Posición en ranking
- Último reporte realizado

### 2. QrScanPage (/citizen/scan)
- Usar react-qr-reader para activar cámara y leer QR
- Al escanear:
  1. Extraer el código del QR (la URL contiene /scan/{qr_code})
  2. Llamar GET /api/qr/scan/{qr_code}
  3. Si QR inválido → mostrar error "QR no válido"
  4. Si válido → navegar a TripViewPage con los datos

### 3. TripViewPage (/citizen/trip/:tripId)
- Mostrar datos del viaje activo:
  - Vehículo: placa
  - Ruta: origen → destino
  - Conductor(es): nombre + últimos 4 dígitos DNI + foto (si disponible)
  - Estado de fatiga: badge de color
  - Hora de salida
- Pregunta: "¿Es el mismo conductor que muestra el sistema?"
  - Botón SÍ ✅ / NO ❌
  - Si NO → alerta automática + formulario de reporte
- Si el conductor es correcto:
  - Botón "REPORTAR PROBLEMA" (si quedan reportes hoy)
  - Botón "TODO BIEN" (suma puntos de validación)

### 4. ReportFormPage (/citizen/report/:tripId)
- Formulario:
  - Tipo de reporte (select): Conductor diferente, Condición del vehículo, Conducción peligrosa, Exceso de velocidad, Otro
  - Descripción (textarea, mín 20 caracteres)
  - Foto (opcional): capturar con cámara del celular
  - Botón "ENVIAR REPORTE"
- Mostrar: "Reportes hoy: X de 3"
- Si X >= 3 → deshabilitar formulario con mensaje "Límite diario alcanzado"
- Al enviar: mostrar confirmación con puntos ganados

### 5. CitizenProfile (/citizen/profile)
- Datos personales (nombre, DNI parcial, email, teléfono)
- Estadísticas:
  - Puntos totales acumulados
  - Reportes totales (válidos, inválidos, en revisión)
  - Reputación (score + barra visual)
- Historial de reportes
- Historial de puntos

### 6. CitizenRanking (/citizen/ranking)
- Top 20 ciudadanos participantes de su municipalidad
- Tabla: posición, nombre, puntos, reportes válidos
- Destacar la posición del usuario actual

### Diseño PWA:
- Diseño mobile-first (optimizado para celulares)
- Navegación inferior (bottom tabs): Inicio, Escanear, Mis Reportes, Perfil
- Colores: azul institucional + blanco + acentos verdes
- Botón de escaneo QR prominente y grande
- Loading states y skeleton screens
- Mensajes de error amigables

### Service Worker:
- Cache de assets estáticos
- Página offline básica: "Sin conexión. Conéctate a internet para usar SFIT."
- manifest.json: name "SFIT Ciudadano", theme_color #1B4F72, background_color #FFFFFF

Usar shadcn/ui, Lucide icons. UX simple e intuitiva (el usuario promedio no es técnico).
```

---

## FASE 3: REPUTACIÓN Y FINALIZACIÓN (Prompts 16-19)

---

### PROMPT 16 — Módulo de reputación e incentivos (backend)

```
Crea los módulos de reputación e incentivos para SFIT:

/backend/src/modules/reputation/
/backend/src/modules/incentives/

## ReputationModule

### ReputationService

**calculateDriverReputation(driverId):**
Puntaje base: 100. Factores ponderados:
- Cumplimiento de descanso (40%): ratio de evaluaciones APTO / total en últimos 30 días
- Reportes ciudadanos (30%): (reportes positivos - negativos) / total
- Ausencia de incidentes (30%): 100 - (sanciones * penalización según nivel)

Penalización por sanción: Nivel 1=-5, Nivel 2=-15, Nivel 3=-30, Nivel 4=-50
Apelación aceptada: restaurar puntos perdidos.

Retorna score 0-100. Guardar en driver.reputation_score.

**calculateVehicleReputation(vehicleId):**
- Promedio de reputación de conductores que lo operan
- Historial de incidentes del vehículo (viajes cerrados auto)

**calculateCompanyReputation(companyId):**
- Promedio de reputación de todos sus conductores
- Ratio de conductores APTO vs NO_APTO
- Historial de sanciones de la empresa

**Cron diario (03:00 AM):** Recalcular TODAS las reputaciones.

### Endpoints:
- GET /api/reputation/driver/:id — score + desglose
- GET /api/reputation/vehicle/:id
- GET /api/reputation/company/:id
- GET /api/reputation/ranking/drivers — top 20 conductores de la municipalidad
- GET /api/reputation/ranking/companies — top empresas

## IncentivesModule

### IncentivesService

**grantPoints(citizenId, action, reportId?):**
- REPORTE_VALIDO: +10 puntos
- REPORTE_CON_SANCION: +50 puntos (bonus)
- VALIDACION_CORRECTA: +2 puntos (cuando confirma conductor correcto)

**Cron diario (00:00):** Resetear reports_today de todos los ciudadanos a 0.

### Endpoints:
- GET /api/incentives/my-points — puntos del ciudadano
- GET /api/incentives/history — historial de puntos ganados
- GET /api/incentives/ranking — top 20 ciudadanos de la municipalidad

Swagger + tests.
```

---

### PROMPT 17 — Módulo de reportes automáticos municipales

```
Crea el módulo de reportes automáticos semanales y mensuales para SFIT:

/backend/src/modules/municipal-reports/

## MunicipalReportsModule

### Reporte semanal (cron: lunes 06:00 AM):
Generar para cada municipalidad:
- Período: lunes a domingo anterior
- Contenido:
  - Total de viajes registrados
  - Viajes cerrados automáticamente
  - Conductores evaluados (APTO/RIESGO/NO_APTO)
  - Reportes ciudadanos recibidos (por tipo y estado)
  - Sanciones emitidas (por nivel)
  - Top 5 conductores mejor reputación
  - Top 5 conductores peor reputación
  - Rutas con más incidencias
- Formato: HTML para email
- Enviar por email a todos los usuarios FISCAL y ADMIN_MUNICIPAL de esa municipalidad

### Reporte mensual (cron: día 1 de cada mes, 06:00 AM):
Igual que semanal pero con datos del mes anterior + tendencias:
- Comparativa con mes anterior (flechas arriba/abajo)
- Gráfico textual de evolución

### Endpoints bajo demanda:
- GET /api/municipal-reports/generate?type=SEMANAL|MENSUAL&from=&to=
  - Solo FISCAL y ADMIN_MUNICIPAL
  - Retorna datos en JSON
- GET /api/municipal-reports/export?type=SEMANAL|MENSUAL&from=&to=&format=csv
  - Exportar en CSV

### Templates de email:
- Diseño profesional con colores institucionales
- Logo SFIT en header
- Tablas con datos resumidos
- Footer: "Sistema de Fiscalización Inteligente de Transporte — [Municipalidad]"

Swagger + tests.
```

---

### PROMPT 18 — Frontend: Panel admin municipal

```
Crea el panel de administración municipal para SFIT:

/frontend/src/pages/admin/

## Páginas:

### 1. AdminDashboard (/admin)
- KPIs generales de su municipalidad
- Acceso rápido a configuraciones
- Últimas acciones del audit log

### 2. ConfigPage (/admin/config)
- **Umbrales de sanciones:** formulario para editar los umbrales de cada nivel
  - Nivel 1: incidencias menores en 30 días [input number]
  - Nivel 2: incidencias o graves [input number]
  - Nivel 3: incidencias o graves [input number]
  - Nivel 4: condiciones [textarea]
  - Guardar → actualiza municipality.config_json

- **Pesos de reputación:**
  - Fatiga: [slider 0-100%]
  - Reportes: [slider 0-100%]
  - Incidentes: [slider 0-100%]
  - Total debe sumar 100% (validación en tiempo real)

- **Reglas de fatiga:**
  - Horas máximas conducción normal [input]
  - Horas máximas ruta larga [input]
  - Descanso mínimo [input]
  - Horas para alerta de pausa [input]

### 3. UsersManagement (/admin/users)
- CRUD de usuarios de su municipalidad
- Crear usuarios: FISCAL, OPERADOR_EMPRESA, INSPECTOR
- Asignar empresa al OPERADOR_EMPRESA
- Activar / bloquear usuarios
- No puede crear otros ADMIN_MUNICIPAL

### 4. RoutesManagement (/admin/routes)
- CRUD completo de rutas
- Formulario con campos especiales:
  - Conductores mínimos (1 o 2)
  - Permite ida y vuelta (toggle)
  - Horas de descanso entre tramos (si aplica)
- Tabla con todas las rutas y sus reglas

### 5. AuditLogPage (/admin/audit)
- Tabla paginada con todas las acciones
- Filtros: usuario, acción, entidad, fecha
- Columnas: fecha, usuario, acción, entidad, detalle
- Exportar a CSV

### 6. CompaniesManagement (/admin/companies)
- Gestión de empresas registradas
- Ver conductores y vehículos por empresa
- Reputación de la empresa

Todo con shadcn/ui. Diseño profesional y serio (es para gobierno).
```

---

### PROMPT 19 — Testing integral y ajustes finales

```
Realiza el testing integral del sistema SFIT y los ajustes finales:

## 1. Tests E2E del flujo principal:
Crea tests end-to-end (puedes usar el test runner que prefieras: jest, vitest, o supertest):

**Flujo completo de registro de viaje:**
1. Login como OPERADOR_EMPRESA
2. Crear conductor (con foto DNI)
3. Crear vehículo (verificar QR generado)
4. Registrar viaje en ruta normal (1 conductor) → debe ser APROBADO
5. Intentar registrar otro viaje con mismo conductor sin descanso → debe ser BLOQUEADO
6. Registrar viaje en ruta Arequipa-Challhuahuacho con solo 1 conductor → debe ser BLOQUEADO
7. Registrar viaje en ruta Arequipa-Challhuahuacho con 2 conductores APTOS → debe ser APROBADO
8. Registrar viaje de retorno Cusco-Tambobamba sin cumplir 4h descanso → debe ser BLOQUEADO

**Flujo de reporte ciudadano:**
1. Login como CIUDADANO
2. Escanear QR (simular)
3. Crear reporte → verificar puntos otorgados
4. Crear 3 reportes → verificar que el 4to sea rechazado
5. Fiscal valida reporte → verificar actualización de reputación

**Flujo de sanciones:**
1. Generar múltiples incidencias para un conductor
2. Verificar que el sistema genera sanción automática del nivel correcto
3. Conductor apela → verificar flujo de apelación
4. Fiscal resuelve apelación → verificar efecto en reputación

## 2. Seed de datos de prueba:
Crear seed completo con:
- 4 municipalidades
- 3 empresas por municipalidad
- 5 conductores por empresa (mix de APTO, RIESGO, NO_APTO)
- 3 vehículos por empresa
- Rutas predefinidas incluyendo las 2 especiales
- 20 viajes de ejemplo (varios estados)
- 10 reportes ciudadanos (varios estados)
- 5 sanciones de ejemplo

## 3. Verificaciones finales:
- Swagger documentación completa (/api/docs)
- Todas las variables de .env documentadas
- docker-compose funcional (levantar con un solo comando)
- README.md con instrucciones de instalación y ejecución
- Verificar que el filtro de municipalidad funciona (un usuario NO puede ver datos de otra municipalidad)
- Verificar CORS configurado correctamente
- Verificar rate limiting en endpoints públicos
```

---

## NOTAS IMPORTANTES

- **Cada prompt construye sobre el anterior.** No saltes ninguno.
- **Espera a que Claude termine** completamente antes de pasar al siguiente.
- **Si hay errores**, pide a Claude que los corrija antes de avanzar.
- **Guarda tu progreso** con git commits después de cada prompt completado.
- **Levanta los servicios** con `docker-compose up -d` antes de empezar el Prompt 2.
- **Variables de entorno:** copia `.env.example` a `.env` y configura los valores reales.

### Comando sugerido para git después de cada prompt:
```bash
git add -A && git commit -m "SFIT: Prompt X completado - [descripción]"
```

### Para levantar el proyecto:
```bash
docker-compose up -d          # PostgreSQL + Redis
cd backend && npm run start:dev   # Backend en :3000
cd frontend && npm run dev        # Frontend en :5173
```
