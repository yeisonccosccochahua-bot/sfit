import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Bus, AlertTriangle, Plus, CheckCircle2, Clock, CalendarDays, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { Trip, Driver, Vehicle, TripStatus, DriverStatus, PaginatedResponse } from '../../types';
import { scheduledTripsApi, type ScheduledTrip } from '../../services/scheduledTripsApi';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { Alert } from '../../components/ui/alert';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table';
import { formatDate } from '../../lib/utils';
import { STATUS_STYLES } from './ScheduledTripCard';

const TRIP_STATUS_STYLES: Record<TripStatus, { label: string; variant: 'success' | 'warning' | 'muted' | 'destructive' | 'default' }> = {
  [TripStatus.EN_CURSO]:    { label: 'En curso',     variant: 'success' },
  [TripStatus.REGISTRADO]:  { label: 'Registrado',   variant: 'default' },
  [TripStatus.FINALIZADO]:  { label: 'Finalizado',   variant: 'muted' },
  [TripStatus.CANCELADO]:   { label: 'Cancelado',    variant: 'destructive' },
  [TripStatus.CERRADO_AUTO]:{ label: 'Cierre auto.', variant: 'warning' },
};

export function OperatorDashboard() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [todayScheduled, setTodayScheduled] = useState<ScheduledTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    (async () => {
      try {
        const [t, d, v, sched] = await Promise.all([
          api.get<PaginatedResponse<Trip>>('/api/trips?limit=20&page=1'),
          api.get<PaginatedResponse<Driver>>('/api/drivers?limit=100'),
          api.get<PaginatedResponse<Vehicle>>('/api/vehicles?limit=100'),
          scheduledTripsApi.getDay(today).catch(() => [] as ScheduledTrip[]),
        ]);
        setTrips(Array.isArray(t) ? t : (t.data ?? []));
        setDrivers(Array.isArray(d) ? d : (d.data ?? []));
        setVehicles(Array.isArray(v) ? v : (v.data ?? []));
        setTodayScheduled(Array.isArray(sched) ? sched : []);
      } catch {
        setError('No se pudo cargar el panel. Verifique su conexión.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const safeSched    = Array.isArray(todayScheduled) ? todayScheduled : [];
  const safeTrips    = Array.isArray(trips)    ? trips    : [];
  const safeDrivers  = Array.isArray(drivers)  ? drivers  : [];
  const safeVehicles = Array.isArray(vehicles) ? vehicles : [];

  const activeTrips   = safeTrips.filter((t) => t.status === TripStatus.EN_CURSO);
  const todayPending  = safeSched.filter(t => ['PROGRAMADO', 'CONFIRMADO'].includes(t.estado));
  const aptaDrivers   = safeDrivers.filter((d) => d.status === DriverStatus.APTO).length;
  const riesgoDrivers = safeDrivers.filter((d) => d.status === DriverStatus.RIESGO);
  const noAptaDrivers = safeDrivers.filter((d) => d.status === DriverStatus.NO_APTO);
  const opVehicles    = safeVehicles.filter((v) => v.status === 'ACTIVO').length;
  const recentTrips   = safeTrips.slice(0, 10);

  const alerts = [
    ...riesgoDrivers.map((d) => ({ type: 'warning' as const, msg: `Conductor en riesgo: ${d.name}` })),
    ...noAptaDrivers.map((d) => ({ type: 'error' as const, msg: `Conductor NO APTO: ${d.name}` })),
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Panel Operador</h2>
          <p className="text-sm text-gray-500">Resumen de operaciones del día</p>
        </div>
        <div className="flex gap-2">
          <Link to="/operator/schedule">
            <Button variant="outline" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Calendario
            </Button>
          </Link>
          <Link to="/operator/trips/new">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Registrar viaje
            </Button>
          </Link>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <Alert key={i} variant={a.type}>
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {a.msg}
              </span>
            </Alert>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Viajes activos"
          value={activeTrips.length}
          Icon={MapPin}
          color="text-green-600"
          bg="bg-green-50"
        />
        <StatCard
          label="Conductores disponibles"
          value={aptaDrivers}
          Icon={CheckCircle2}
          color="text-blue-600"
          bg="bg-blue-50"
        />
        <StatCard
          label="En riesgo / bloqueados"
          value={riesgoDrivers.length + noAptaDrivers.length}
          Icon={AlertTriangle}
          color="text-amber-600"
          bg="bg-amber-50"
        />
        <StatCard
          label="Vehículos operativos"
          value={opVehicles}
          Icon={Bus}
          color="text-indigo-600"
          bg="bg-indigo-50"
        />
        <StatCard
          label="Viajes programados hoy"
          value={safeSched.length}
          Icon={CalendarDays}
          color="text-purple-600"
          bg="bg-purple-50"
        />
      </div>

      {/* Today's scheduled trips */}
      {todayPending.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-purple-600" />
              Programados para hoy ({todayPending.length})
            </CardTitle>
            <Link to="/operator/schedule">
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                Ver calendario <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todayPending.slice(0, 5).map(t => {
                const style = STATUS_STYLES[t.estado] ?? STATUS_STYLES.PROGRAMADO;
                return (
                  <Link key={t.id} to="/operator/schedule">
                    <div className={`flex items-center gap-3 p-3 rounded-lg border ${style.bg} ${style.border} hover:opacity-80 transition-opacity`}>
                      <div className="text-sm font-bold font-mono text-gray-900">{t.hora_salida}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {t.vehicle?.plate ?? '—'} · {t.route?.origin} → {t.route?.destination}
                        </p>
                        <p className="text-xs text-gray-500">{t.assigned_drivers.length} conductor(es)</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>
                        {style.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active trips quick view */}
      {activeTrips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              Viajes en curso ({activeTrips.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {activeTrips.map((t) => (
                <Link key={t.id} to={`/operator/trips`}>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800 border border-green-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    {t.vehicle?.plate ?? '—'} · {t.route?.origin} → {t.route?.destination}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent trips */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Últimos viajes (24h)</CardTitle>
          <Link to="/operator/trips">
            <Button variant="outline" size="sm">Ver todos</Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0 pb-1">
          {recentTrips.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Sin viajes registrados.</p>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Vehículo</Th>
                  <Th>Ruta</Th>
                  <Th>Inicio</Th>
                  <Th>Estado</Th>
                </Tr>
              </Thead>
              <Tbody>
                {recentTrips.map((t) => {
                  const s = TRIP_STATUS_STYLES[t.status];
                  return (
                    <Tr key={t.id}>
                      <Td className="font-medium">{t.vehicle?.plate ?? '—'}</Td>
                      <Td className="text-gray-600">
                        {t.route ? `${t.route.origin} → ${t.route.destination}` : '—'}
                      </Td>
                      <Td className="text-gray-500">{formatDate(t.start_time)}</Td>
                      <Td>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label, value, Icon, color, bg,
}: {
  label: string;
  value: number;
  Icon: React.FC<{ className?: string }>;
  color: string;
  bg: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-5 pb-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

