// ─── Enums (mirror del backend) ──────────────────────────────────────────────

export enum UserRole {
  ADMIN_MUNICIPAL = 'ADMIN_MUNICIPAL',
  FISCAL = 'FISCAL',
  OPERADOR_EMPRESA = 'OPERADOR_EMPRESA',
  CIUDADANO = 'CIUDADANO',
  INSPECTOR = 'INSPECTOR',
}

export enum UserStatus {
  ACTIVO = 'ACTIVO',
  BLOQUEADO = 'BLOQUEADO',
  SUSPENDIDO = 'SUSPENDIDO',
}

export enum TripStatus {
  REGISTRADO = 'REGISTRADO',
  EN_CURSO = 'EN_CURSO',
  FINALIZADO = 'FINALIZADO',
  CANCELADO = 'CANCELADO',
  CERRADO_AUTO = 'CERRADO_AUTO',
}

export enum FatigueResult {
  APTO = 'APTO',
  RIESGO = 'RIESGO',
  NO_APTO = 'NO_APTO',
}

export enum DriverStatus {
  APTO = 'APTO',
  RIESGO = 'RIESGO',
  NO_APTO = 'NO_APTO',
}

// ─── Entidades ───────────────────────────────────────────────────────────────

export interface Municipality {
  id: string;
  name: string;
  province: string;
  district: string;
  region: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  dni?: string;
  phone?: string;
  role: UserRole;
  municipality_id?: string;
  municipality?: Municipality;
  status: UserStatus;
  reputation_score: number;
  total_points: number;
  reports_today?: number;
}

export interface Driver {
  id: string;
  dni: string;
  name: string;
  license_number?: string;
  license_photo_url?: string;
  status: DriverStatus;
  reputation_score: number;
  total_hours_driven_24h: number;
  company_id: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  qr_code: string;
  status: string;
  reputation_score: number;
  company_id: string;
}

export interface Route {
  id: string;
  origin: string;
  destination: string;
  estimated_duration_minutes: number;
  type: string;
  min_drivers: number;
  rest_between_legs_hours?: number;
  allows_roundtrip: boolean;
  status: string;
}

export interface Trip {
  id: string;
  vehicle_id: string;
  vehicle?: Vehicle;
  route_id: string;
  route?: Route;
  start_time: string;
  end_time?: string;
  status: TripStatus;
  fatigue_result?: FatigueResult;
  auto_closed: boolean;
  is_return_leg: boolean;
  municipality_id: string;
  created_at: string;
  drivers?: TripDriver[];
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  municipalityId: string;
  exp: number;
}

// ─── API Response ──────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  lastPage: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
  blocked?: boolean;
  reasons?: Array<{ type: string; message: string; driver_name?: string }>;
}

export enum TripDriverRole {
  PRINCIPAL = 'PRINCIPAL',
  SUPLENTE  = 'SUPLENTE',
  COPILOTO  = 'COPILOTO',
}

export interface TripDriver {
  id: string;
  driver_id: string;
  driver?: Driver;
  role: TripDriverRole;
  fatigue_check_result?: FatigueResult;
}

export interface FatigueEvaluation {
  id: string;
  result: FatigueResult;
  hours_driven_24h: number;
  last_rest_hours: number;
  driver?: Driver;
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export enum ReportType {
  CONDUCTOR_DIFERENTE  = 'CONDUCTOR_DIFERENTE',
  CONDICION_VEHICULO   = 'CONDICION_VEHICULO',
  CONDUCCION_PELIGROSA = 'CONDUCCION_PELIGROSA',
  EXCESO_VELOCIDAD     = 'EXCESO_VELOCIDAD',
  OTRO                 = 'OTRO',
}

export enum ReportStatus {
  EN_REVISION = 'EN_REVISION',
  VALIDO      = 'VALIDO',
  INVALIDO    = 'INVALIDO',
}

export interface Report {
  id:               string;
  citizen_id:       string;
  trip_id:          string;
  trip?:            Trip;
  type:             ReportType;
  description?:     string;
  photo_url?:       string;
  status:           ReportStatus;
  validation_score: number;
  is_same_driver:   boolean;
  created_at:       string;
}

export interface IncentivePoint {
  id:          string;
  user_id:     string;
  points:      number;
  description: string;
  created_at:  string;
}

// ─── QR ───────────────────────────────────────────────────────────────────────

export interface QrScanResult {
  vehicle: { plate: string; company_name: string; qr_valid: boolean };
  active_trip: {
    id: string;
    route: { origin: string; destination: string };
    drivers: Array<{ name: string; dni_last_4: string; role: string; fatigue_status: string; photo_url?: string }>;
    start_time: string;
    estimated_arrival: string;
    status: string;
  } | null;
  can_report: boolean;
}
