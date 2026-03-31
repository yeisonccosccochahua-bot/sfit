import { useEffect, useState } from 'react';
import api from '../../services/api';

interface Driver {
  id: string;
  name: string;
  dni: string;
  license_number?: string;
  status: string;
  reputation_score: number;
  active_sanctions?: number;
}

export function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [statusF, setStatusF] = useState('');

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (statusF) params.status = statusF;
    if (search)  params.search = search;

    api.get('/api/drivers', { params })
      .then((r: any) => setDrivers(r.data?.data ?? r.data ?? []))
      .catch(() => setDrivers([]))
      .finally(() => setLoading(false));
  }, [statusF, search]);

  const repColor = (score: number) => {
    const n = Number(score);
    if (n >= 80) return 'text-green-600';
    if (n >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      APTO:    'bg-green-100 text-green-700',
      RIESGO:  'bg-yellow-100 text-yellow-700',
      NO_APTO: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${map[s] ?? 'bg-gray-100 text-gray-600'}`}>{s}</span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Conductores</h1>

      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Buscar por nombre o DNI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm w-64"
        />
        <select
          value={statusF}
          onChange={(e) => setStatusF(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="APTO">Apto</option>
          <option value="RIESGO">En riesgo</option>
          <option value="NO_APTO">No apto</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : drivers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No se encontraron conductores.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">DNI</th>
                <th className="px-4 py-3">Licencia</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Reputación</th>
                <th className="px-4 py-3">Sanciones activas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drivers.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{d.name}</td>
                  <td className="px-4 py-3 text-gray-600">{d.dni}</td>
                  <td className="px-4 py-3 text-gray-500">{d.license_number ?? '—'}</td>
                  <td className="px-4 py-3">{statusBadge(d.status)}</td>
                  <td className={`px-4 py-3 font-semibold ${repColor(d.reputation_score)}`}>
                    {Number(d.reputation_score)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{d.active_sanctions ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
