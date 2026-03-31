import { useEffect, useState } from 'react';
import api from '../../services/api';

interface Sanction {
  id: string;
  driver_id: string;
  driver_name: string;
  level: number;
  reason: string;
  status: string;
  start_date: string;
  end_date?: string;
  appeal_status?: string;
}

export function SanctionsPage() {
  const [sanctions, setSanctions]   = useState<Sanction[]>([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatus]   = useState('');
  const [levelFilter, setLevel]     = useState('');

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (levelFilter)  params.level  = levelFilter;

    api.get('/api/sanctions', { params })
      .then((r: any) => setSanctions(r.data?.data ?? r.data ?? []))
      .catch(() => setSanctions([]))
      .finally(() => setLoading(false));
  }, [statusFilter, levelFilter]);

  const levelBadge = (lvl: number) => {
    const colors: Record<number, string> = {
      1: 'bg-yellow-100 text-yellow-800',
      2: 'bg-orange-100 text-orange-800',
      3: 'bg-red-100 text-red-800',
      4: 'bg-purple-100 text-purple-800',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[lvl] ?? 'bg-gray-100 text-gray-700'}`}>
        Nivel {lvl}
      </span>
    );
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      ACTIVA:   'bg-red-100 text-red-700',
      APELADA:  'bg-blue-100 text-blue-700',
      CUMPLIDA: 'bg-green-100 text-green-700',
      ANULADA:  'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${colors[s] ?? 'bg-gray-100 text-gray-600'}`}>
        {s}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Sanciones y Apelaciones</h1>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVA">Activa</option>
          <option value="APELADA">Apelada</option>
          <option value="CUMPLIDA">Cumplida</option>
          <option value="ANULADA">Anulada</option>
        </select>
        <select
          value={levelFilter}
          onChange={(e) => setLevel(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">Todos los niveles</option>
          <option value="1">Nivel 1</option>
          <option value="2">Nivel 2</option>
          <option value="3">Nivel 3</option>
          <option value="4">Nivel 4</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : sanctions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay sanciones con los filtros aplicados.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Conductor</th>
                <th className="px-4 py-3">Nivel</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Inicio</th>
                <th className="px-4 py-3">Fin</th>
                <th className="px-4 py-3">Apelación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sanctions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.driver_name ?? s.driver_id}</td>
                  <td className="px-4 py-3">{levelBadge(s.level)}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{s.reason}</td>
                  <td className="px-4 py-3">{statusBadge(s.status)}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(s.start_date).toLocaleDateString('es-BO')}</td>
                  <td className="px-4 py-3 text-gray-500">{s.end_date ? new Date(s.end_date).toLocaleDateString('es-BO') : '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.appeal_status ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
