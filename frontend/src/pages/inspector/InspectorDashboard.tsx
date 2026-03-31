import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck, AlertTriangle, Truck, Bell, QrCode,
  Search, ClipboardPlus, ClipboardList, RefreshCw, ShieldAlert,
  CheckCircle, Clock,
} from 'lucide-react';
import { inspectorApi, type InspectorDashboard as DashboardData, type InspectorAlerta } from '../../services/inspectorApi';
import { useInspectorSocket } from '../../hooks/useInspectorSocket';

const RESULT_COLOR: Record<string, string> = {
  EN_PROCESO:          'bg-blue-100 text-blue-800',
  CONFORME:            'bg-green-100 text-green-800',
  CON_OBSERVACIONES:   'bg-yellow-100 text-yellow-800',
  INFRACCION_DETECTADA:'bg-red-100 text-red-800',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

export function InspectorDashboard() {
  const [data, setData]         = useState<DashboardData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [alertas, setAlertas]   = useState<InspectorAlerta[]>([]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [dash] = await Promise.all([inspectorApi.getDashboard()]);
      setData(dash);
      setAlertas(dash.ultimas_alertas ?? []);
    } catch {
      setError('No se pudo cargar el dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // WebSocket: refresh on any relevant event
  useInspectorSocket({
    'dashboard:update':   () => load(),
    'fatigue:alert':      () => load(),
    'trip:status_changed': () => load(),
    'notification:new':   (notif) => setAlertas(prev => [notif, ...prev.slice(0, 9)]),
  });

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
    </div>
  );

  if (error) return (
    <div className="p-6 text-center">
      <p className="text-red-600 mb-3">{error}</p>
      <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Reintentar</button>
    </div>
  );

  const kpis = [
    {
      label: 'Mis Inspecciones Hoy',
      value: data?.inspecciones_hoy ?? 0,
      Icon: ClipboardCheck,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Infracciones Hoy',
      value: data?.infracciones_detectadas_hoy ?? 0,
      Icon: AlertTriangle,
      color: data?.infracciones_detectadas_hoy ? 'text-red-600' : 'text-gray-400',
      bg: data?.infracciones_detectadas_hoy ? 'bg-red-50' : 'bg-gray-50',
    },
    {
      label: 'Viajes Activos',
      value: data?.viajes_activos_municipalidad ?? 0,
      Icon: Truck,
      color: 'text-green-600',
      bg: 'bg-green-50',
      link: '/inspector/viajes-activos',
    },
    {
      label: 'Alertas Pendientes',
      value: data?.alertas_pendientes ?? 0,
      Icon: Bell,
      color: data?.alertas_pendientes ? 'text-orange-600' : 'text-gray-400',
      bg: data?.alertas_pendientes ? 'bg-orange-50' : 'bg-gray-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Panel de Inspección</h1>
          <p className="text-sm text-gray-500 mt-0.5">Actividad del día en tu municipalidad</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, Icon, color, bg, link }) => {
          const card = (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500 leading-tight">{label}</p>
              </div>
            </div>
          );
          return link
            ? <Link key={label} to={link}>{card}</Link>
            : <div key={label}>{card}</div>;
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Acciones Rápidas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link to="/inspector/scan"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            <QrCode className="h-6 w-6" />
            <span className="text-sm font-semibold">Escanear QR</span>
          </Link>
          <Link to="/inspector/lookup/driver"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600 transition-colors">
            <Search className="h-6 w-6" />
            <span className="text-sm font-medium">Buscar DNI</span>
          </Link>
          <Link to="/inspector/lookup/vehicle"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600 transition-colors">
            <Truck className="h-6 w-6" />
            <span className="text-sm font-medium">Buscar Placa</span>
          </Link>
          <Link to="/inspector/inspections/new"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-colors">
            <ClipboardPlus className="h-6 w-6" />
            <span className="text-sm font-semibold">Nueva Inspección</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conductor Risk Panel */}
        {(data?.conductores_en_riesgo ?? 0) + (data?.conductores_bloqueados ?? 0) > 0 && (
          <div className="bg-white rounded-xl border border-orange-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-orange-500" /> Estado de Conductores
            </h2>
            <div className="space-y-2">
              {(data?.conductores_bloqueados ?? 0) > 0 && (
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <span className="text-sm text-red-800 font-medium">Conductores NO_APTO (bloqueados)</span>
                  <span className="text-lg font-bold text-red-700">{data?.conductores_bloqueados}</span>
                </div>
              )}
              {(data?.conductores_en_riesgo ?? 0) > 0 && (
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <span className="text-sm text-yellow-800 font-medium">Conductores en RIESGO</span>
                  <span className="text-lg font-bold text-yellow-700">{data?.conductores_en_riesgo}</span>
                </div>
              )}
              <Link to="/inspector/viajes-activos" className="block text-center text-sm text-blue-600 hover:underline pt-1">
                Ver viajes activos →
              </Link>
            </div>
          </div>
        )}

        {/* Recent Alerts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-500" /> Alertas Recientes
            </h2>
          </div>
          {alertas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <CheckCircle className="h-8 w-8 mb-2 text-green-400" />
              <p className="text-sm">Sin alertas pendientes</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {alertas.slice(0, 6).map(a => (
                <li key={a.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50">
                  <Bell className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{a.title}</p>
                    <p className="text-xs text-gray-500 truncate">{a.content}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{timeAgo(a.sent_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Last Inspections */}
      <RecentInspections />
    </div>
  );
}

function RecentInspections() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inspectorApi.getInspections({ limit: '5', page: '1' })
      .then(r => setInspections(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Mis Últimas Inspecciones
        </h2>
        <Link to="/inspector/inspections" className="text-xs text-blue-600 hover:underline">Ver todas →</Link>
      </div>
      {loading ? (
        <div className="py-8 flex justify-center"><RefreshCw className="h-5 w-5 text-gray-400 animate-spin" /></div>
      ) : inspections.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No hay inspecciones registradas aún</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-2 font-medium text-gray-600">Fecha</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Tipo</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Ubicación</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Resultado</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {inspections.map(i => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    {new Date(i.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                  </div>
                </td>
                <td className="px-4 py-2 text-gray-700 text-xs">{i.tipo.replace(/_/g, ' ')}</td>
                <td className="px-4 py-2 text-gray-500 text-xs truncate max-w-[150px]">{i.ubicacion_descripcion ?? '—'}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_COLOR[i.resultado] ?? 'bg-gray-100 text-gray-600'}`}>
                    {i.resultado.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link to={`/inspector/inspections/${i.id}`} className="text-xs text-blue-600 hover:underline">Ver</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
