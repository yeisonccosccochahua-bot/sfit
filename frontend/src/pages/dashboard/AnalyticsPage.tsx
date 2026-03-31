import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import api from '../../services/api';

interface DailyStat {
  date: string;
  trips: number;
  reports: number;
  sanctions: number;
}

interface SanctionByLevel {
  level: string;
  count: number;
}

export function AnalyticsPage() {
  const [daily, setDaily]             = useState<DailyStat[]>([]);
  const [byLevel, setByLevel]         = useState<SanctionByLevel[]>([]);
  const [loading, setLoading]         = useState(true);
  const [range, setRange]             = useState<'7' | '30' | '90'>('30');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/reports/stats', { params: { range } }).catch(() => ({ data: {} })),
      api.get('/api/sanctions/stats').catch(() => ({ data: {} })),
    ]).then(([statsRes, sanctRes]: [any, any]) => {
      // Build daily data from stats if available, else mock shape
      const s = statsRes.data ?? {};
      if (Array.isArray(s.daily)) {
        setDaily(s.daily);
      }
      // Sanction by level
      const sc = sanctRes.data ?? {};
      if (sc.by_level) {
        setByLevel(
          Object.entries(sc.by_level as Record<string, number>).map(([level, count]) => ({
            level: `Nivel ${level}`,
            count,
          })),
        );
      }
    }).finally(() => setLoading(false));
  }, [range]);

  const exportCsv = async () => {
    try {
      const res: any = await api.get('/api/reports/export', { responseType: 'blob' });
      const url  = URL.createObjectURL(res.data);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `sfit-reportes-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('No se pudo exportar el reporte.');
    }
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Analíticas y Reportes</h1>
        <div className="flex gap-2">
          {(['7', '30', '90'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded text-sm border ${range === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
            >
              {r} días
            </button>
          ))}
          <button
            onClick={exportCsv}
            className="px-3 py-1.5 rounded text-sm bg-green-600 text-white hover:bg-green-700"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">Cargando datos...</div>
      ) : (
        <>
          {/* Line chart: trips / reports / sanctions over time */}
          {daily.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-sm font-semibold text-gray-600 uppercase mb-4">Actividad diaria</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="trips"     stroke="#2E86C1" name="Viajes" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="reports"   stroke="#E67E22" name="Reportes" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sanctions" stroke="#C0392B" name="Sanciones" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Bar chart: sanctions by level */}
          {byLevel.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-sm font-semibold text-gray-600 uppercase mb-4">Sanciones por nivel</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byLevel}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1B4F72" radius={[4, 4, 0, 0]} name="Total" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {daily.length === 0 && byLevel.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              No hay datos analíticos disponibles para el período seleccionado.
            </div>
          )}
        </>
      )}
    </div>
  );
}
