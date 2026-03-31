import { useState, useEffect } from 'react';
import {
  X, AlertTriangle, CheckCircle2, Clock, Bus, Users, RefreshCw, Calendar,
} from 'lucide-react';
import api from '../../services/api';
import { scheduledTripsApi, type CreateScheduledTripDto } from '../../services/scheduledTripsApi';
import type { Vehicle, Route as RouteType, Driver, PaginatedResponse } from '../../types';
import { Button } from '../../components/ui/button';

const RECURRENCIA_OPTIONS = [
  { value: 'UNICO',          label: 'Solo este día' },
  { value: 'DIARIO_LUN_VIE', label: 'Lunes a Viernes' },
  { value: 'DIARIO_LUN_SAB', label: 'Lunes a Sábado' },
  { value: 'PERSONALIZADO',  label: 'Días personalizados' },
];
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function minutesToHoursStr(m: number) {
  const h = Math.floor(m / 60); const min = m % 60;
  return min ? `${h}h ${min}min` : `${h}h`;
}

interface DriverRow { driver_id: string; role: 'PRINCIPAL' | 'SUPLENTE' | 'COPILOTO' }

interface Props {
  initialDate?: string;
  initialHour?: number;
  onClose: () => void;
  onCreated: () => void;
}

export function ScheduleTripModal({ initialDate, initialHour, onClose, onCreated }: Props) {
  const today = new Date().toISOString().split('T')[0];

  const [vehicles,  setVehicles]  = useState<Vehicle[]>([]);
  const [routes,    setRoutes]    = useState<RouteType[]>([]);
  const [drivers,   setDrivers]   = useState<Driver[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [error,     setError]     = useState('');
  const [conflicts, setConflicts] = useState<{ type: string; message: string }[]>([]);

  // Form state
  const [fecha,       setFecha]       = useState(initialDate ?? today);
  const [hora,        setHora]        = useState(
    initialHour !== undefined ? `${String(initialHour).padStart(2, '0')}:00` : '',
  );
  const [vehicleId,   setVehicleId]   = useState('');
  const [routeId,     setRouteId]     = useState('');
  const [driverRows,  setDriverRows]  = useState<DriverRow[]>([{ driver_id: '', role: 'PRINCIPAL' }]);
  const [recurrencia, setRecurrencia] = useState('UNICO');
  const [diasSemana,  setDiasSemana]  = useState<number[]>([]);
  const [hasta,       setHasta]       = useState('');
  const [notas,       setNotas]       = useState('');

  const selectedRoute = routes.find(r => r.id === routeId);
  const minDrivers    = selectedRoute?.min_drivers ?? 1;
  const durationMin   = selectedRoute?.estimated_duration_minutes ?? 0;
  const horaLlegada   = hora && durationMin
    ? (() => {
        const [h, m] = hora.split(':').map(Number);
        const total  = h * 60 + m + durationMin;
        return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      })()
    : null;

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [v, r, d] = await Promise.all([
          api.get<PaginatedResponse<Vehicle>>('/api/vehicles?limit=100&status=ACTIVO'),
          api.get<PaginatedResponse<RouteType>>('/api/routes?limit=100&status=ACTIVA'),
          api.get<PaginatedResponse<Driver>>('/api/drivers?limit=100'),
        ]);
        setVehicles(Array.isArray(v) ? v : (v.data ?? []));
        setRoutes(Array.isArray(r) ? r : (r.data ?? []));
        setDrivers(Array.isArray(d) ? d : (d.data ?? []));
      } catch { setError('Error cargando datos'); }
      finally { setLoading(false); }
    })();
  }, []);

  // Adjust driver rows when route changes
  useEffect(() => {
    setDriverRows(prev => {
      const rows = [...prev];
      while (rows.length < minDrivers) rows.push({ driver_id: '', role: rows.length === 0 ? 'PRINCIPAL' : 'COPILOTO' });
      return rows.slice(0, Math.max(minDrivers, 1));
    });
  }, [minDrivers]);

  async function checkConflicts() {
    if (!vehicleId || !fecha || !hora || !durationMin) return;
    const dIds = driverRows.map(r => r.driver_id).filter(Boolean);
    if (!dIds.length) return;
    setCheckingConflicts(true);
    try {
      const res = await scheduledTripsApi.checkConflicts({
        vehicle_id: vehicleId, driver_ids: dIds, fecha, hora_salida: hora, duracion_minutos: durationMin,
      });
      setConflicts(res.conflicts);
    } catch { setConflicts([]); }
    finally { setCheckingConflicts(false); }
  }

  useEffect(() => {
    const t = setTimeout(checkConflicts, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, fecha, hora, driverRows, durationMin]);

  async function handleSave() {
    setError('');
    if (!vehicleId) { setError('Selecciona un vehículo'); return; }
    if (!routeId)   { setError('Selecciona una ruta'); return; }
    if (!hora)      { setError('Ingresa la hora de salida'); return; }
    const validDrivers = driverRows.filter(d => d.driver_id);
    if (validDrivers.length < minDrivers) {
      setError(`Esta ruta requiere ${minDrivers} conductor(es)`);
      return;
    }
    if (conflicts.length > 0) { setError('Resuelve los conflictos antes de guardar'); return; }

    const dto: CreateScheduledTripDto = {
      vehicle_id: vehicleId, route_id: routeId,
      assigned_drivers: validDrivers,
      fecha_programada: fecha, hora_salida: hora,
      recurrencia: recurrencia as any,
      ...(recurrencia === 'PERSONALIZADO' ? { dias_semana: diasSemana } : {}),
      ...(recurrencia !== 'UNICO' && hasta ? { recurrencia_hasta: hasta } : {}),
      ...(notas.trim() ? { notas } : {}),
    };

    setSaving(true);
    try {
      await scheduledTripsApi.create(dto);
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al guardar');
    } finally { setSaving(false); }
  }

  const previewDates = (() => {
    if (recurrencia === 'UNICO' || !hasta) return [fecha];
    const days: Record<string, number[]> = {
      DIARIO_LUN_VIE: [1,2,3,4,5], DIARIO_LUN_SAB: [1,2,3,4,5,6], PERSONALIZADO: diasSemana,
    };
    const allowed = days[recurrencia] ?? [];
    const dates: string[] = [];
    const cur = new Date(fecha + 'T12:00:00');
    const end = new Date(hasta + 'T12:00:00');
    const max = new Date(cur); max.setDate(max.getDate() + 27);
    const eff = end < max ? end : max;
    while (cur <= eff && dates.length < 5) {
      const dow = cur.getDay() === 0 ? 7 : cur.getDay();
      if (allowed.includes(dow)) dates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  })();

  const isNocturno = hora && parseInt(hora.split(':')[0]) < 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold text-gray-900">Programar Viaje</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Section 1: Date & Time */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">1. Fecha y Hora</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Fecha</label>
                  <input type="date" value={fecha} min={today} onChange={e => setFecha(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Hora de salida</label>
                  <input type="time" value={hora} onChange={e => setHora(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {isNocturno && (
                <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-2 rounded-lg">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Horario nocturno (00:00-04:59). Verifique autorización.
                </div>
              )}
              {horaLlegada && (
                <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Llegada estimada: <span className="font-medium">{horaLlegada}</span>
                </p>
              )}
            </div>

            {/* Section 2: Route & Vehicle */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">2. Ruta y Vehículo</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Ruta</label>
                  <select value={routeId} onChange={e => setRouteId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Seleccionar ruta…</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.origin} → {r.destination} ({minutesToHoursStr(r.estimated_duration_minutes)})
                        {r.min_drivers >= 2 ? ' ★2 conductores' : ''}
                      </option>
                    ))}
                  </select>
                  {selectedRoute?.min_drivers && selectedRoute.min_drivers >= 2 && (
                    <p className="mt-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                      Esta ruta requiere mínimo {selectedRoute.min_drivers} conductores
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1 flex items-center gap-1">
                    <Bus className="h-3.5 w-3.5" /> Vehículo
                  </label>
                  <select value={vehicleId} onChange={e => setVehicleId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Seleccionar vehículo…</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.plate}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Drivers */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> 3. Conductor(es)
              </p>
              <div className="space-y-2">
                {driverRows.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <select
                      value={row.driver_id}
                      onChange={e => {
                        const rows = [...driverRows];
                        rows[i] = { ...rows[i], driver_id: e.target.value };
                        setDriverRows(rows);
                      }}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{i === 0 ? 'Conductor principal…' : `Conductor ${i+1}…`}</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}
                          disabled={driverRows.some((r, j) => j !== i && r.driver_id === d.id)}>
                          {d.name} ({d.status})
                        </option>
                      ))}
                    </select>
                    <select
                      value={row.role}
                      onChange={e => {
                        const rows = [...driverRows];
                        rows[i] = { ...rows[i], role: e.target.value as any };
                        setDriverRows(rows);
                      }}
                      className="w-28 rounded-lg border border-gray-300 px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PRINCIPAL">Principal</option>
                      <option value="COPILOTO">Copiloto</option>
                      <option value="SUPLENTE">Suplente</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: Recurrencia */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">4. Recurrencia</p>
              <div className="grid grid-cols-2 gap-2">
                {RECURRENCIA_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => setRecurrencia(o.value)}
                    className={`text-left rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
                      recurrencia === o.value
                        ? 'border-blue-500 bg-blue-50 text-blue-800 font-medium'
                        : 'border-gray-200 text-gray-600 hover:border-blue-200'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {recurrencia === 'PERSONALIZADO' && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-2">Seleccionar días:</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {DIAS.map((d, i) => {
                      const v = i + 1;
                      const active = diasSemana.includes(v);
                      return (
                        <button key={d} onClick={() => setDiasSemana(prev =>
                          active ? prev.filter(x => x !== v) : [...prev, v]
                        )}
                          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                            active ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-gray-600 hover:border-blue-300'
                          }`}
                        >{d}</button>
                      );
                    })}
                  </div>
                </div>
              )}

              {recurrencia !== 'UNICO' && (
                <div className="mt-3">
                  <label className="block text-xs text-gray-600 mb-1">Repetir hasta:</label>
                  <input type="date" value={hasta} min={fecha}
                    max={(() => { const d = new Date(fecha + 'T12:00:00'); d.setDate(d.getDate()+27); return d.toISOString().split('T')[0]; })()}
                    onChange={e => setHasta(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  {previewDates.length > 0 && (
                    <p className="mt-1.5 text-xs text-gray-500">
                      Se crearán {previewDates.length}+ viajes: {previewDates.slice(0,3).join(', ')}{previewDates.length > 3 ? '…' : ''}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Section 5: Conflicts */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                {checkingConflicts ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
                ) : conflicts.length === 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
                <p className="text-xs font-medium text-gray-600">
                  {checkingConflicts ? 'Verificando conflictos…'
                   : conflicts.length === 0 ? 'Sin conflictos detectados'
                   : `${conflicts.length} conflicto(s) detectado(s)`}
                </p>
              </div>
              {conflicts.length > 0 && (
                <ul className="space-y-1">
                  {conflicts.map((c, i) => (
                    <li key={i} className="text-xs text-red-700 bg-red-50 px-2.5 py-1.5 rounded-lg">• {c.message}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Section 6: Notes */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">Notas (opcional)</label>
              <textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)}
                placeholder="Observaciones del viaje…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
              <Button
                onClick={handleSave}
                loading={saving}
                disabled={conflicts.length > 0 || checkingConflicts}
                className="flex-1"
              >
                {recurrencia !== 'UNICO' ? `Programar viajes` : 'Programar viaje'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
