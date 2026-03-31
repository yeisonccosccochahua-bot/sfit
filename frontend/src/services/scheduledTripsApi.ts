import api from './api';

export interface AssignedDriver {
  driver_id: string;
  role: 'PRINCIPAL' | 'SUPLENTE' | 'COPILOTO';
}

export interface ScheduledTrip {
  id: string;
  vehicle_id: string;
  vehicle?: { id: string; plate: string; model?: string };
  route_id: string;
  route?: { id: string; origin: string; destination: string; estimated_duration_minutes: number; min_drivers: number };
  company_id: string;
  municipality_id: string;
  assigned_drivers: AssignedDriver[];
  fecha_programada: string; // 'YYYY-MM-DD'
  hora_salida: string;      // 'HH:MM'
  hora_llegada_estimada: string | null;
  recurrencia: 'UNICO' | 'DIARIO_LUN_VIE' | 'DIARIO_LUN_SAB' | 'PERSONALIZADO';
  serie_id: string | null;
  dias_semana: number[] | null;
  recurrencia_hasta: string | null;
  estado: 'PROGRAMADO' | 'CONFIRMADO' | 'EN_CURSO' | 'COMPLETADO' | 'CANCELADO' | 'NO_REALIZADO';
  trip_id: string | null;
  trip?: { id: string; status: string };
  motivo_cancelacion: string | null;
  notas: string | null;
  created_by: string;
  creator?: { id: string; name: string };
  created_at: string;
  updated_at: string;
}

export interface CreateScheduledTripDto {
  vehicle_id: string;
  route_id: string;
  assigned_drivers: AssignedDriver[];
  fecha_programada: string;
  hora_salida: string;
  recurrencia: 'UNICO' | 'DIARIO_LUN_VIE' | 'DIARIO_LUN_SAB' | 'PERSONALIZADO';
  dias_semana?: number[];
  recurrencia_hasta?: string;
  notas?: string;
}

export interface ConflictResult {
  has_conflicts: boolean;
  conflicts: { type: string; message: string }[];
}

const BASE = '/api/scheduled-trips';

export const scheduledTripsApi = {
  getWeek: (startDate: string, endDate: string) =>
    api.get<Record<string, ScheduledTrip[]>>(`${BASE}/week`, { params: { start_date: startDate, end_date: endDate } }),

  getDay: (date: string) =>
    api.get<ScheduledTrip[]>(`${BASE}/day`, { params: { date } }),

  getOne: (id: string) =>
    api.get<ScheduledTrip>(`${BASE}/${id}`),

  create: (dto: CreateScheduledTripDto) =>
    api.post<ScheduledTrip | ScheduledTrip[]>(BASE, dto),

  confirm: (id: string) =>
    api.patch<ScheduledTrip>(`${BASE}/${id}/confirm`),

  start: (id: string) =>
    api.post<{ scheduledTrip: ScheduledTrip; trip: { id: string; status: string } }>(`${BASE}/${id}/start`),

  cancel: (id: string, motivo: string, cancelarSerie?: boolean) =>
    api.patch(`${BASE}/${id}/cancel`, { motivo_cancelacion: motivo, cancelar_serie: cancelarSerie }),

  reschedule: (id: string, dto: { nueva_fecha?: string; nueva_hora?: string; nuevo_vehicle_id?: string }) =>
    api.patch<ScheduledTrip>(`${BASE}/${id}/reschedule`, dto),

  checkConflicts: (dto: {
    vehicle_id: string;
    driver_ids: string[];
    fecha: string;
    hora_salida: string;
    duracion_minutos: number;
    exclude_id?: string;
  }) => api.post<ConflictResult>(`${BASE}/check-conflicts`, dto),
};
