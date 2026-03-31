import { useState, useEffect } from 'react';
import { BarChart3, RefreshCw, TrendingUp, ClipboardCheck, AlertTriangle, Calendar } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { inspectorApi, type InspectorStats } from '../../services/inspectorApi';

const PIE_COLORS: Record<string, string> = {
  CONFORME:            '#22c55e',
  CON_OBSERVACIONES:   '#eab308',
  INFRACCION_DETECTADA:'#ef4444',
  EN_PROCESO:          '#3b82f6',
};

const TIPO_LABELS: Record<string, string> = {
  VERIFICACION_QR:        'Verif. QR',
  VERIFICACION_CONDUCTOR: 'Verif. Conductor',
  INSPECCION_VEHICULO:    'Insp. Vehículo',
  CONTROL_RUTA:           'Control Ruta',
  FISCALIZACION_GENERAL:  'Fiscalización',
};

export function InspectorStatsPage() {
  const [stats, setStats]     = useState<InspectorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setStats(await inspectorApi.getStats());
    } catch {
      setError('No se pudieron cargar las estadísticas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
    </div>
  );

  if (error) return (
    <div className="text-center py-16">
      <p className="text-red-600 mb-3">{error}</p>
      <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Reintentar</button>
    </div>
  );

  if (!stats) return null;

  const kpis = [
    { label: 'Total Inspecciones', value: stats.total_inspecciones, Icon: ClipboardCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Este Mes', value: stats.inspecciones_mes, Icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Esta Semana', value: stats.inspecciones_semana, Icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    {
      label: 'Tasa de Infracción',
      value: `${stats.tasa_infraccion}%`,
      Icon: AlertTriangle,
      color: stats.tasa_infraccion > 20 ? 'text-red-600' : 'text-orange-600',
      bg: stats.tasa_infraccion > 20 ? 'bg-red-50' : 'bg-orange-50',
    },
  ];

  const porDia = stats.inspecciones_por_dia.map(d => ({
    fecha: new Date(d.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
    cantidad: d.cantidad,
  }));

  const porTipoData = Object.entries(stats.por_tipo).map(([k, v]) => ({
    name: TIPO_LABELS[k] ?? k,
    value: v,
  }));

  const porResultadoData = Object.entries(stats.por_resultado).map(([k, v]) => ({
    name: k.replace(/_/g, ' '),
    value: v,
    fill: PIE_COLORS[k] ?? '#94a3b8',
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" /> Mis Estadísticas
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Rendimiento como inspector de campo</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 leading-tight">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Infracciones del mes */}
      {stats.infracciones_detectadas_mes > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
          <p className="text-sm text-orange-800">
            <span className="font-bold">{stats.infracciones_detectadas_mes}</span> infracciones detectadas este mes
            {stats.sanciones_derivadas_mes > 0 && ` · ${stats.sanciones_derivadas_mes} derivadas a sanciones`}
          </p>
        </div>
      )}

      {/* Line Chart: Por Día */}
      {porDia.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Inspecciones por Día (últimos 30 días)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={porDia} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Line type="monotone" dataKey="cantidad" name="Inspecciones" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bar Chart: Por Tipo */}
        {porTipoData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Por Tipo de Inspección</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={porTipoData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="value" name="Inspecciones" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pie Chart: Por Resultado */}
        {porResultadoData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Por Resultado</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={porResultadoData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {porResultadoData.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Empty state */}
      {stats.total_inspecciones === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400">
          <ClipboardCheck className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p>No hay inspecciones registradas aún</p>
          <p className="text-sm mt-1">Las estadísticas aparecerán una vez realices tu primera inspección</p>
        </div>
      )}
    </div>
  );
}
