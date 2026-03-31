import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, MapPin, Activity, ShieldAlert, FileText,
  CheckCircle2, XCircle, AlertTriangle, Clock, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

import api from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { Report, ReportStatus, Trip, TripStatus, PaginatedResponse } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table';
import { formatDate } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardStats {
  activeTrips:   number;
  fatigueAlerts: number;
  sanctionsToday: number;
  reportsToday:  number;
}

interface AlertItem {
  id:      string;
  type:    string;
  message: string;
  ts:      number;
  fresh?:  boolean;
}

interface SanctionBar  { level: string; count: number }
interface DriverPie    { name: string; value: number; color: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const DRIVER_COLORS = ['#27AE60', '#E67E22', '#E74C3C'];

const STATUS_STYLES: Record<TripStatus, { label: string; variant: 'success'|'warning'|'muted'|'destructive'|'default' }> = {
  [TripStatus.EN_CURSO]:    { label: 'En curso',   variant: 'success' },
  [TripStatus.REGISTRADO]:  { label: 'Registrado', variant: 'default' },
  [TripStatus.FINALIZADO]:  { label: 'Finalizado', variant: 'muted' },
  [TripStatus.CANCELADO]:   { label: 'Cancelado',  variant: 'destructive' },
  [TripStatus.CERRADO_AUTO]:{ label: 'Auto-cierre',variant: 'warning' },
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  CONDUCTOR_DIFERENTE:  'Conductor diferente',
  CONDUCCION_PELIGROSA: 'Conducción peligrosa',
  EXCESO_VELOCIDAD:     'Exceso velocidad',
  CONDICION_VEHICULO:   'Condición vehículo',
  OTRO:                 'Otro',
};

// ─── Main component ───────────────────────────────────────────────────────────

export function FiscalDashboardPage() {
  const { on } = useSocket();

  const [stats, setStats]           = useState<DashboardStats>({ activeTrips: 0, fatigueAlerts: 0, sanctionsToday: 0, reportsToday: 0 });
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [pendingReports, setPendingReports] = useState<Report[]>([]);
  const [sanctionBars, setSanctionBars]     = useState<SanctionBar[]>([]);
  const [driverPie, setDriverPie]           = useState<DriverPie[]>([]);
  const [alerts, setAlerts]                 = useState<AlertItem[]>([]);
  const [loading, setLoading]               = useState(true);
  const [validating, setValidating]         = useState<string | null>(null);
  const alertsRef = useRef<AlertItem[]>([]);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [tripsRes, reportsRes, sanctionsRes, driversRes] = await Promise.all([
        api.get<PaginatedResponse<Trip>>('/api/trips?status=EN_CURSO&limit=20'),
        api.get<PaginatedResponse<Report>>('/api/reports?status=EN_REVISION&limit=20'),
        api.get<{ total: number; today: number; by_level: Record<string, number>; pending_appeals: number }>('/api/sanctions/stats'),
        api.get<PaginatedResponse<{ status: string }>>('/api/drivers?limit=200'),
      ]);

      setActiveTrips(tripsRes.data ?? []);
      setPendingReports(reportsRes.data ?? []);

      // KPIs
      const activeCount  = tripsRes.total ?? 0;
      const reviewCount  = reportsRes.total ?? 0;
      const sanctToday   = sanctionsRes.today ?? 0;
      const fatAlerts    = (driversRes.data ?? []).filter((d) => d.status === 'RIESGO').length;

      setStats({ activeTrips: activeCount, fatigueAlerts: fatAlerts, sanctionsToday: sanctToday, reportsToday: reviewCount });

      // Charts
      const bl = sanctionsRes.by_level ?? {};
      setSanctionBars([
        { level: 'Nivel 1', count: bl[1] ?? 0 },
        { level: 'Nivel 2', count: bl[2] ?? 0 },
        { level: 'Nivel 3', count: bl[3] ?? 0 },
        { level: 'Nivel 4', count: bl[4] ?? 0 },
      ]);

      const drivers = driversRes.data ?? [];
      const apto   = drivers.filter((d) => d.status === 'APTO').length;
      const riesgo = drivers.filter((d) => d.status === 'RIESGO').length;
      const noApto = drivers.filter((d) => d.status === 'NO_APTO').length;
      setDriverPie([
        { name: 'APTO',    value: apto,   color: DRIVER_COLORS[0] },
        { name: 'RIESGO',  value: riesgo, color: DRIVER_COLORS[1] },
        { name: 'NO_APTO', value: noApto, color: DRIVER_COLORS[2] },
      ]);
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── WebSocket real-time updates ─────────────────────────────────────────────
  useEffect(() => {
    const pushAlert = (type: string, message: string) => {
      const item: AlertItem = { id: crypto.randomUUID(), type, message, ts: Date.now(), fresh: true };
      const next = [item, ...alertsRef.current].slice(0, 20);
      alertsRef.current = next;
      setAlerts([...next]);
      // Remove fresh flag after animation
      setTimeout(() => {
        setAlerts((prev) => prev.map((a) => a.id === item.id ? { ...a, fresh: false } : a));
      }, 1_500);
    };

    const offDashboard = on<{ message?: string }>('dashboard:update', () => loadData());
    const offTrip      = on<{ tripId: string; status: string }>('trip:status_changed', (d) => {
      pushAlert('viaje', `Viaje ${d.tripId.slice(0, 8)} → ${d.status}`);
      loadData();
    });
    const offFatigue   = on<{ driverName: string; result: string }>('fatigue:alert', (d) => {
      pushAlert('fatiga', `${d.driverName}: ${d.result}`);
      setStats((s) => ({ ...s, fatigueAlerts: s.fatigueAlerts + 1 }));
    });
    const offNotif     = on<{ title: string; type: string }>('notification:new', (d) => {
      pushAlert(d.type, d.title);
    });

    return () => { offDashboard(); offTrip(); offFatigue(); offNotif(); };
  }, [on, loadData]);

  // ── Validate report ────────────────────────────────────────────────────────
  const validateReport = async (id: string, status: ReportStatus) => {
    setValidating(id);
    try {
      await api.patch(`/api/reports/${id}/validate`, { status });
      setPendingReports((prev) => prev.filter((r) => r.id !== id));
      setStats((s) => ({ ...s, reportsToday: Math.max(0, s.reportsToday - 1) }));
    } catch {
      // keep in list
    } finally {
      setValidating(null);
    }
  };

  // ── KPI cards ─────────────────────────────────────────────────────────────
  const kpis = [
    { label: 'Viajes activos',  value: stats.activeTrips,   Icon: MapPin,       color: 'text-blue-600',  bg: 'bg-blue-50' },
    { label: 'Alertas fatiga',  value: stats.fatigueAlerts, Icon: Activity,     color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Sanciones hoy',   value: stats.sanctionsToday,Icon: ShieldAlert,  color: 'text-red-600',   bg: 'bg-red-50' },
    { label: 'Reportes pendientes',value: stats.reportsToday, Icon: FileText,   color: 'text-purple-600',bg: 'bg-purple-50' },
  ];

  if (loading) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-[#1B4F72]" />
          <h2 className="text-xl font-bold text-gray-900">Panel Fiscal</h2>
        </div>
        <Button variant="outline" onClick={loadData} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(({ label, value, Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-5">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Active trips table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Viajes en curso</CardTitle>
              <Link to="/dashboard/trips" className="text-xs text-[#2E86C1] hover:underline">Ver todos →</Link>
            </CardHeader>
            <CardContent className="p-0">
              {activeTrips.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">Sin viajes activos ahora.</p>
              ) : (
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Placa</Th>
                      <Th>Ruta</Th>
                      <Th>Inicio</Th>
                      <Th>Estado</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {activeTrips.map((t) => (
                      <Tr key={t.id}>
                        <Td className="font-mono font-bold">{t.vehicle?.plate ?? '—'}</Td>
                        <Td className="text-xs">
                          {t.route ? `${t.route.origin} → ${t.route.destination}` : '—'}
                        </Td>
                        <Td className="text-xs text-gray-500">
                          {t.start_time ? formatDate(t.start_time) : '—'}
                        </Td>
                        <Td>
                          <Badge variant={STATUS_STYLES[t.status]?.variant ?? 'default'}>
                            {STATUS_STYLES[t.status]?.label ?? t.status}
                          </Badge>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Real-time alert feed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              Alertas en tiempo real
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 overflow-y-auto space-y-2">
            {alerts.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">Sin alertas recientes.</p>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className={[
                    'rounded-lg border px-3 py-2 text-xs transition-all duration-700',
                    a.fresh
                      ? 'border-amber-300 bg-amber-50 scale-[1.02]'
                      : 'border-gray-100 bg-gray-50',
                  ].join(' ')}
                >
                  <p className="font-medium text-gray-700 truncate">{a.message}</p>
                  <p className="text-gray-400 mt-0.5">{new Date(a.ts).toLocaleTimeString('es-PE')}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reports EN_REVISION */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Reportes pendientes de validación
          </CardTitle>
          <Link to="/dashboard/reports" className="text-xs text-[#2E86C1] hover:underline">Ver todos →</Link>
        </CardHeader>
        <CardContent className="p-0">
          {pendingReports.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No hay reportes pendientes.</p>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Tipo</Th>
                  <Th>Descripción</Th>
                  <Th>Score</Th>
                  <Th>Fecha</Th>
                  <Th>Acciones</Th>
                </Tr>
              </Thead>
              <Tbody>
                {pendingReports.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <Badge variant="warning">
                        {REPORT_TYPE_LABELS[r.type] ?? r.type}
                      </Badge>
                    </Td>
                    <Td className="max-w-xs truncate text-xs text-gray-600">
                      {r.description ?? '—'}
                    </Td>
                    <Td>
                      <span className={[
                        'font-bold text-sm',
                        (r.validation_score ?? 0) >= 70 ? 'text-green-600' : 'text-amber-600',
                      ].join(' ')}>
                        {r.validation_score ?? '—'}
                      </span>
                    </Td>
                    <Td className="text-xs text-gray-500">{formatDate(r.created_at)}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <button
                          disabled={validating === r.id}
                          onClick={() => validateReport(r.id, ReportStatus.VALIDO)}
                          className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          {validating === r.id ? <Spinner size="sm" /> : <CheckCircle2 className="h-3 w-3" />}
                          Válido
                        </button>
                        <button
                          disabled={validating === r.id}
                          onClick={() => validateReport(r.id, ReportStatus.INVALIDO)}
                          className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          <XCircle className="h-3 w-3" /> Inválido
                        </button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sanciones por nivel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sanciones por nivel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sanctionBars} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="level" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#2E86C1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Estado conductores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Estado conductores</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {driverPie.every((d) => d.value === 0) ? (
              <p className="py-10 text-sm text-gray-400">Sin conductores registrados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={driverPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {driverPie.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" iconSize={10} formatter={(value) => <span className="text-xs">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { to: '/dashboard/sanctions', label: 'Sanciones',  Icon: ShieldAlert },
          { to: '/dashboard/drivers',   label: 'Conductores',Icon: Activity    },
          { to: '/dashboard/reports',   label: 'Reportes',   Icon: FileText    },
          { to: '/dashboard/routes',    label: 'Rutas',      Icon: MapPin      },
          { to: '/dashboard/companies', label: 'Empresas',   Icon: LayoutDashboard },
          { to: '/dashboard/analytics', label: 'Analítica',  Icon: Clock       },
        ].map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 text-center hover:border-[#2E86C1] hover:bg-blue-50/30 transition-colors"
          >
            <Icon className="h-6 w-6 text-[#1B4F72]" />
            <span className="text-xs font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
