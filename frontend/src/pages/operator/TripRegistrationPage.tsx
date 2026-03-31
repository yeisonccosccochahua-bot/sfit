import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bus, Route, Users, CheckCircle2, AlertTriangle, XCircle,
  ChevronRight, ChevronLeft, Search, Clock,
} from 'lucide-react';
import api from '../../services/api';
import {
  Vehicle, Route as RouteType, Driver, DriverStatus, FatigueResult,
  PaginatedResponse, FatigueEvaluation, Trip,
} from '../../types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Alert } from '../../components/ui/alert';
import { Card, CardContent } from '../../components/ui/card';
import { Spinner } from '../../components/ui/spinner';
import { minutesToHours } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

interface DriverAssignment {
  driver: Driver;
  role: 'PRINCIPAL' | 'COPILOTO';
  eval: FatigueEvaluation | null;
  evaluating: boolean;
}

interface BlockReason { type: string; message: string; driver_name?: string }

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = ['Vehículo', 'Ruta', 'Conductores', 'Confirmación'];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center">
      {STEPS.map((label, i) => {
        const idx = i + 1;
        const done    = idx < current;
        const active  = idx === current;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors',
                  done   ? 'border-[#1B4F72] bg-[#1B4F72] text-white'
                         : active ? 'border-[#2E86C1] bg-white text-[#2E86C1]'
                         : 'border-gray-200 bg-white text-gray-400',
                ].join(' ')}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : idx}
              </div>
              <span className={`mt-1 hidden text-xs sm:block ${active ? 'font-semibold text-[#1B4F72]' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 h-0.5 w-8 sm:w-16 ${done ? 'bg-[#1B4F72]' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Fatigue badge ────────────────────────────────────────────────────────────

function FatigueBadge({ status }: { status: DriverStatus | FatigueResult }) {
  if (status === DriverStatus.APTO)
    return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" />APTO</Badge>;
  if (status === DriverStatus.RIESGO)
    return <Badge variant="warning" className="gap-1"><AlertTriangle className="h-3 w-3" />RIESGO</Badge>;
  return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />NO APTO</Badge>;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TripRegistrationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  // Step 1 state
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehicleActiveTrip, setVehicleActiveTrip] = useState<Trip | null>(null);

  // Step 2 state
  const [routes, setRoutes] = useState<RouteType[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteType | null>(null);
  const [isReturnLeg, setIsReturnLeg] = useState(false);
  const [completedTrips, setCompletedTrips] = useState<Trip[]>([]);
  const [parentTripId, setParentTripId] = useState('');

  // Step 3 state
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [assignments, setAssignments] = useState<DriverAssignment[]>([]);

  // Step 4 state
  const [blockReasons, setBlockReasons] = useState<BlockReason[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Loading
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  // ── Fetch vehicles ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingVehicles(true);
    api.get<PaginatedResponse<Vehicle>>('/api/vehicles?limit=100')
      .then((r) => setVehicles(Array.isArray(r) ? r : (r.data ?? [])))
      .catch(() => {})
      .finally(() => setLoadingVehicles(false));
  }, []);

  // ── Check active trip when vehicle selected ────────────────────────────────
  useEffect(() => {
    if (!selectedVehicle) { setVehicleActiveTrip(null); return; }
    api.get<Trip | null>(`/api/trips/vehicle/${selectedVehicle.id}/active`)
      .then((t) => setVehicleActiveTrip(t))
      .catch(() => setVehicleActiveTrip(null));
  }, [selectedVehicle]);

  // ── Fetch routes on step 2 ─────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 2) return;
    setLoadingRoutes(true);
    api.get<PaginatedResponse<RouteType>>('/api/routes?limit=100&status=ACTIVA')
      .then((r) => setRoutes(Array.isArray(r) ? r : (r.data ?? [])))
      .catch(() => {})
      .finally(() => setLoadingRoutes(false));
  }, [step]);

  // ── Fetch completed trips for return leg ───────────────────────────────────
  useEffect(() => {
    if (!isReturnLeg) { setCompletedTrips([]); return; }
    api.get<PaginatedResponse<Trip>>('/api/trips?status=FINALIZADO&limit=20&is_return_leg=false')
      .then((r) => setCompletedTrips(Array.isArray(r) ? r : (r.data ?? [])))
      .catch(() => {});
  }, [isReturnLeg]);

  // ── Fetch drivers on step 3 ────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 3) return;
    setLoadingDrivers(true);
    api.get<PaginatedResponse<Driver>>('/api/drivers?limit=100')
      .then((r) => setDrivers(Array.isArray(r) ? r : (r.data ?? [])))
      .catch(() => {})
      .finally(() => setLoadingDrivers(false));
  }, [step]);

  // ── Evaluate fatigue for a driver ──────────────────────────────────────────
  const evaluateDriver = useCallback(async (driver: Driver): Promise<FatigueEvaluation | null> => {
    try {
      return await api.get<FatigueEvaluation>(`/api/fatigue/evaluate/${driver.id}`);
    } catch {
      return null;
    }
  }, []);

  // ── Toggle driver assignment ───────────────────────────────────────────────
  const toggleDriver = useCallback(async (driver: Driver) => {
    const already = assignments.find((a) => a.driver.id === driver.id);
    if (already) {
      setAssignments((prev) => prev.filter((a) => a.driver.id !== driver.id));
      return;
    }
    const maxDrivers = selectedRoute?.min_drivers ?? 1;
    if (assignments.length >= maxDrivers) return; // max reached

    const role: 'PRINCIPAL' | 'COPILOTO' = assignments.length === 0 ? 'PRINCIPAL' : 'COPILOTO';
    // Add placeholder while evaluating
    setAssignments((prev) => [...prev, { driver, role, eval: null, evaluating: true }]);

    const evalResult = await evaluateDriver(driver);
    setAssignments((prev) =>
      prev.map((a) =>
        a.driver.id === driver.id ? { ...a, eval: evalResult, evaluating: false } : a,
      ),
    );
  }, [assignments, selectedRoute, evaluateDriver]);

  // ── Submit trip ────────────────────────────────────────────────────────────
  const submitTrip = async () => {
    if (!selectedVehicle || !selectedRoute || assignments.length === 0) return;
    setSubmitting(true);
    setSubmitError('');
    setBlockReasons([]);

    try {
      await api.post('/api/trips', {
        vehicle_id: selectedVehicle.id,
        route_id:   selectedRoute.id,
        drivers: assignments.map((a) => ({ driver_id: a.driver.id, role: a.role })),
        is_return_leg: isReturnLeg,
        ...(isReturnLeg && parentTripId ? { parent_trip_id: parentTripId } : {}),
      });
      navigate('/operator/trips');
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.blocked && Array.isArray(data.reasons)) {
        setBlockReasons(data.reasons as BlockReason[]);
      } else {
        setSubmitError(data?.message ?? 'Error al registrar el viaje.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canGoNext = () => {
    if (step === 1) return !!selectedVehicle;
    if (step === 2) return !!selectedRoute && (!isReturnLeg || !!parentTripId);
    if (step === 3) return assignments.length >= (selectedRoute?.min_drivers ?? 1) && assignments.every((a) => !a.evaluating);
    return true;
  };

  const goNext = () => { if (step < 4) setStep((s) => (s + 1) as Step); };
  const goBack = () => { if (step > 1) setStep((s) => (s - 1) as Step); };

  const filteredVehicles = vehicles.filter((v) =>
    v.plate.toLowerCase().includes(vehicleSearch.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Registrar viaje</h2>
        <p className="text-sm text-gray-500">Complete los 4 pasos para registrar un nuevo viaje.</p>
      </div>

      {/* Step indicator */}
      <div className="flex justify-center">
        <StepIndicator current={step} />
      </div>

      {/* ── STEP 1: Vehicle ─────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Bus className="h-5 w-5 text-[#2E86C1]" /> Seleccionar vehículo
          </h3>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por placa…"
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loadingVehicles ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : filteredVehicles.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No se encontraron vehículos.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredVehicles.map((v) => {
                const isSelected = selectedVehicle?.id === v.id;
                const inactive   = v.status !== 'ACTIVO';
                return (
                  <button
                    key={v.id}
                    disabled={inactive}
                    onClick={() => setSelectedVehicle(isSelected ? null : v)}
                    className={[
                      'text-left rounded-lg border-2 p-4 transition-all',
                      isSelected ? 'border-[#2E86C1] bg-blue-50'
                                 : inactive ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                 : 'border-gray-200 hover:border-[#AED6F1] hover:bg-blue-50/30',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 text-base tracking-wider">{v.plate}</span>
                      <Badge variant={v.status === 'ACTIVO' ? 'success' : 'destructive'}>
                        {v.status}
                      </Badge>
                    </div>
                    {isSelected && vehicleActiveTrip && (
                      <Alert variant="warning" className="mt-3 text-xs py-2">
                        Este vehículo tiene un viaje EN CURSO activo.
                      </Alert>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Route ───────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Route className="h-5 w-5 text-[#2E86C1]" /> Seleccionar ruta
          </h3>

          {loadingRoutes ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : routes.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No hay rutas disponibles.</p>
          ) : (
            <div className="space-y-3">
              {routes.map((r) => {
                const isSelected = selectedRoute?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => { setSelectedRoute(isSelected ? null : r); setIsReturnLeg(false); setParentTripId(''); }}
                    className={[
                      'w-full text-left rounded-lg border-2 p-4 transition-all',
                      isSelected ? 'border-[#2E86C1] bg-blue-50'
                                 : 'border-gray-200 hover:border-[#AED6F1] hover:bg-blue-50/30',
                    ].join(' ')}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {r.origin} <ChevronRight className="inline h-4 w-4" /> {r.destination}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Duración estimada: {minutesToHours(r.estimated_duration_minutes)}
                          {r.rest_between_legs_hours ? ` · Descanso: ${r.rest_between_legs_hours}h entre tramos` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {r.min_drivers >= 2 && (
                          <Badge variant="warning">2 CONDUCTORES OBLIGATORIOS</Badge>
                        )}
                        {r.allows_roundtrip && (
                          <Badge variant="secondary">Ida y vuelta</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Return leg option */}
          {selectedRoute?.allows_roundtrip && (
            <div className="rounded-lg border border-dashed border-[#AED6F1] p-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isReturnLeg}
                  onChange={(e) => { setIsReturnLeg(e.target.checked); setParentTripId(''); }}
                  className="h-4 w-4 rounded border-gray-300 text-[#2E86C1] focus:ring-[#2E86C1]"
                />
                <span className="text-sm font-medium text-gray-800">¿Es viaje de retorno?</span>
              </label>

              {isReturnLeg && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Seleccione el viaje de ida (parent trip)</label>
                  <select
                    value={parentTripId}
                    onChange={(e) => setParentTripId(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-[#2E86C1] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                  >
                    <option value="">Seleccione un viaje de ida…</option>
                    {completedTrips.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.id.slice(0, 8)} · {t.vehicle?.plate} · {t.route?.origin} → {t.route?.destination}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Drivers ─────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-[#2E86C1]" /> Asignar conductor(es)
            </h3>
            <span className="text-sm text-gray-500">
              {assignments.length} / {selectedRoute?.min_drivers ?? 1} seleccionado(s)
            </span>
          </div>

          {selectedRoute && selectedRoute.min_drivers >= 2 && (
            <Alert variant="warning">Esta ruta requiere mínimo 2 conductores APTOS.</Alert>
          )}

          {loadingDrivers ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : drivers.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No hay conductores disponibles.</p>
          ) : (
            <div className="space-y-2">
              {drivers.map((d) => {
                const assignment  = assignments.find((a) => a.driver.id === d.id);
                const isSelected  = !!assignment;
                const maxReached  = assignments.length >= (selectedRoute?.min_drivers ?? 1) && !isSelected;
                const noApto      = d.status === DriverStatus.NO_APTO;
                return (
                  <button
                    key={d.id}
                    onClick={() => !maxReached && toggleDriver(d)}
                    disabled={maxReached}
                    className={[
                      'w-full text-left rounded-lg border-2 p-3 transition-all',
                      isSelected ? 'border-[#2E86C1] bg-blue-50'
                                 : noApto ? 'border-red-200 bg-red-50/30 opacity-70'
                                 : maxReached ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                                 : 'border-gray-200 hover:border-[#AED6F1] hover:bg-blue-50/30',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">{d.name}</p>
                        <p className="text-xs text-gray-500">DNI: {d.dni} · {Number(d.total_hours_driven_24h || 0).toFixed(1)}h conducidas (24h)</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {assignment?.evaluating && <Spinner size="sm" />}
                        {assignment?.eval && (
                          <FatigueBadge status={assignment.eval.result as unknown as DriverStatus} />
                        )}
                        {!assignment && <FatigueBadge status={d.status} />}
                        {isSelected && (
                          <span className="rounded-full bg-[#1B4F72] px-2 py-0.5 text-xs font-bold text-white">
                            {assignment?.role}
                          </span>
                        )}
                      </div>
                    </div>
                    {assignment?.eval && noApto && (
                      <p className="mt-2 text-xs text-red-600">
                        No apto: {Number(assignment.eval.hours_driven_24h || 0).toFixed(1)}h conducidas, {Number(assignment.eval.last_rest_hours || 0).toFixed(1)}h de descanso
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 4: Confirm ─────────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-5">
          <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#2E86C1]" /> Confirmación
          </h3>

          {/* Summary */}
          <Card>
            <CardContent className="space-y-4 pt-5">
              <SummaryRow label="Vehículo" value={selectedVehicle?.plate ?? '—'} />
              <SummaryRow
                label="Ruta"
                value={selectedRoute ? `${selectedRoute.origin} → ${selectedRoute.destination} (${minutesToHours(selectedRoute.estimated_duration_minutes)})` : '—'}
              />
              {isReturnLeg && <SummaryRow label="Tipo" value="Viaje de retorno" />}
              <SummaryRow
                label="Hora estimada de salida"
                value={new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                Icon={Clock}
              />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Conductores</p>
                <div className="space-y-2">
                  {assignments.map((a) => (
                    <div key={a.driver.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.driver.name}</p>
                        <p className="text-xs text-gray-500">DNI: {a.driver.dni}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.eval && <FatigueBadge status={a.eval.result as unknown as DriverStatus} />}
                        <span className="text-xs font-semibold text-gray-500">{a.role}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Block reasons */}
          {blockReasons.length > 0 && (
            <Alert variant="error" title="Viaje bloqueado">
              <ul className="mt-1 space-y-1">
                {blockReasons.map((r, i) => (
                  <li key={i} className="text-xs">
                    {r.driver_name && <strong>{r.driver_name}: </strong>}
                    {r.message}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {submitError && <Alert variant="error">{submitError}</Alert>}

          {/* Submit button */}
          <Button
            onClick={submitTrip}
            loading={submitting}
            disabled={blockReasons.length > 0}
            className={[
              'w-full text-base py-3',
              blockReasons.length > 0 ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          >
            {blockReasons.length > 0 ? 'Viaje bloqueado' : 'REGISTRAR VIAJE'}
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-4">
        <Button variant="outline" onClick={goBack} disabled={step === 1}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Atrás
        </Button>
        {step < 4 ? (
          <Button onClick={goNext} disabled={!canGoNext()}>
            Siguiente <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

function SummaryRow({
  label, value, Icon,
}: {
  label: string;
  value: string;
  Icon?: React.FC<{ className?: string }>;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 shrink-0">{label}</p>
      <p className="text-sm text-gray-900 text-right flex items-center gap-1">
        {Icon && <Icon className="h-3.5 w-3.5 text-gray-400" />}
        {value}
      </p>
    </div>
  );
}
