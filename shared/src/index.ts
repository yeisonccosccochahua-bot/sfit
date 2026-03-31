// Shared types entre backend y frontend

// ── Roles ─────────────────────────────────────────────────────────────────────
export enum UserRole {
  ADMIN_MUNICIPAL  = 'ADMIN_MUNICIPAL',
  FISCAL           = 'FISCAL',
  OPERADOR_EMPRESA = 'OPERADOR_EMPRESA',
  CIUDADANO        = 'CIUDADANO',
  INSPECTOR        = 'INSPECTOR',
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  municipalityId?: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

// ── Pagination ────────────────────────────────────────────────────────────────
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ── API Response ──────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ── WebSocket Events ──────────────────────────────────────────────────────────
export enum WsEvent {
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  INSPECTION_UPDATE = 'inspection_update',
  ALERT_NEW = 'alert_new',
  VEHICLE_LOCATION = 'vehicle_location',
}
