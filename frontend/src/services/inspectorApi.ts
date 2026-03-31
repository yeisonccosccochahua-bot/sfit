import api from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InspectorDashboard {
  inspecciones_hoy: number;
  infracciones_detectadas_hoy: number;
  viajes_activos_municipalidad: number;
  conductores_en_riesgo: number;
  conductores_bloqueados: number;
  alertas_pendientes: number;
  ultimas_alertas: InspectorAlerta[];
}

export interface InspectorAlerta {
  id: string;
  title: string;
  content: string;
  type: string;
  status: string;
  sent_at: string;
}

export interface ActiveTripConductor {
  id: string;
  nombre: string;
  dni: string;
  foto_url: string | null;
  estado_fatiga: string;
  horas_conducidas: number;
  rol: string;
  fatigue_check_result: string;
}

export interface ActiveTrip {
  id: string;
  vehiculo: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
    foto_url: string | null;
    empresa: { nombre: string; ruc: string };
  };
  ruta: { origen: string; destino: string };
  conductores: ActiveTripConductor[];
  hora_inicio: string;
  minutos_transcurridos: number;
  status: string;
  tiene_conductor_riesgo: boolean;
  tiene_conductor_bloqueado: boolean;
}

export interface ScanQrResult {
  qr_valido: boolean;
  motivo?: string;
  inspection_id?: string;
  vehiculo?: {
    id: string;
    placa: string;
    marca: string;
    modelo: string;
    color: string;
    year: number;
    foto_url: string | null;
    estado: string;
    soat_vigente: boolean;
    soat_vencimiento: string | null;
    revision_tecnica_vigente: boolean;
    revision_tecnica_vencimiento: string | null;
    empresa: { nombre: string; ruc: string };
  };
  viaje_activo: {
    id: string;
    ruta: { origen: string; destino: string };
    hora_inicio: string;
    tiempo_transcurrido_minutos: number;
    estado: string;
  } | null;
  conductores: Array<{
    id: string;
    nombre: string;
    dni: string;
    foto_url: string | null;
    licencia: { numero: string; vigente: boolean | null; vencimiento: string | null; dias_para_vencer: number | null };
    fatiga: { estado: string; horas_conducidas_24h: number; ultima_pausa: string | null };
    reputation_score: number;
    sanciones_activas: number;
    rol: string;
  }>;
  alertas: string[];
  requiere_accion: boolean;
}

export interface Inspection {
  id: string;
  tipo: string;
  resultado: string;
  ubicacion_descripcion: string;
  latitud: number | null;
  longitud: number | null;
  observaciones: Array<{ descripcion: string; tipo: string; gravedad: string; foto_url?: string }>;
  fotos_evidencia: string[];
  verificacion_conductor: any;
  verificacion_vehiculo: any;
  notas_adicionales: string;
  sanction_id: string | null;
  created_at: string;
  updated_at: string;
  vehicle?: any;
  driver?: any;
  trip?: any;
}

export interface InspectorStats {
  total_inspecciones: number;
  inspecciones_mes: number;
  inspecciones_semana: number;
  infracciones_detectadas_mes: number;
  sanciones_derivadas_mes: number;
  tasa_infraccion: number;
  por_tipo: Record<string, number>;
  por_resultado: Record<string, number>;
  inspecciones_por_dia: Array<{ fecha: string; cantidad: number }>;
}

export interface DriverLookup {
  id: string;
  nombre: string;
  dni: string;
  foto_url: string | null;
  empresa: { id: string; nombre: string };
  licencia: { numero: string; vigente: boolean | null; vencimiento: string | null; dias_para_vencer: number | null };
  fatiga: { estado: string; horas_conducidas_24h: number; ultima_pausa: string | null };
  reputation_score: number;
  viaje_activo: any | null;
}

export interface VehicleLookup {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  year: number;
  color: string;
  foto_url: string | null;
  estado: string;
  empresa: { nombre: string; ruc: string };
  documentos: {
    soat_vigente: boolean;
    soat_vencimiento: string | null;
    revision_tecnica_vigente: boolean;
    revision_tecnica_vencimiento: string | null;
  };
  viaje_activo: any | null;
}

// ── API calls ────────────────────────────────────────────────────────────────

const BASE = '/api/inspector';

export const inspectorApi = {
  getDashboard: () =>
    api.get<InspectorDashboard>(`${BASE}/dashboard`),

  getActiveTrips: () =>
    api.get<ActiveTrip[]>(`${BASE}/dashboard/viajes-activos`),

  getAlertas: (page = 1, limit = 50) =>
    api.get<{ data: InspectorAlerta[]; total: number; page: number; lastPage: number }>(
      `${BASE}/dashboard/alertas?page=${page}&limit=${limit}`
    ),

  scanQr: (qr_content: string) =>
    api.post<ScanQrResult>(`${BASE}/scan-qr`, { qr_content }),

  createInspection: (dto: {
    tipo: string;
    ubicacion_descripcion: string;
    vehicle_id?: string;
    trip_id?: string;
    driver_id?: string;
    latitud?: number;
    longitud?: number;
  }) => api.post<Inspection>(`${BASE}/inspections`, dto),

  getInspections: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return api.get<{ data: Inspection[]; total: number; page: number; lastPage: number }>(
      `${BASE}/inspections?${qs}`
    );
  },

  getInspection: (id: string) =>
    api.get<Inspection>(`${BASE}/inspections/${id}`),

  addObservacion: (id: string, dto: { descripcion: string; tipo: string; gravedad: string; foto_url?: string }) =>
    api.post<Inspection>(`${BASE}/inspections/${id}/observaciones`, dto),

  addFoto: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('foto', file);
    return api.post<Inspection>(`${BASE}/inspections/${id}/fotos`, fd);
  },

  verifyDriver: (dto: {
    inspection_id: string;
    driver_id: string;
    conductor_coincide: boolean;
    licencia_vigente: boolean;
    licencia_categoria_correcta: boolean;
    estado_fatiga_visual: string;
    observaciones_conductor?: string;
  }) => api.post<Inspection>(`${BASE}/verify-driver`, dto),

  verifyVehicle: (dto: {
    inspection_id: string;
    vehicle_id: string;
    estado_general: string;
    luces_funcionan: boolean;
    llantas_estado: string;
    documentos_vigentes: boolean;
    soat_vigente: boolean;
    revision_tecnica_vigente: boolean;
    capacidad_excedida: boolean;
    observaciones_vehiculo?: string;
  }) => api.post<Inspection>(`${BASE}/verify-vehicle`, dto),

  finalizeInspection: (id: string, dto: { resultado: string; notas_adicionales?: string; derivar_sancion?: boolean }) =>
    api.patch<Inspection>(`${BASE}/inspections/${id}/finalizar`, dto),

  getStats: () =>
    api.get<InspectorStats>(`${BASE}/stats`),

  lookupDriver: (dni: string) =>
    api.get<DriverLookup>(`${BASE}/lookup/driver/${dni}`),

  lookupVehicle: (placa: string) =>
    api.get<VehicleLookup>(`${BASE}/lookup/vehicle/${encodeURIComponent(placa)}`),
};
