import { useEffect, useState } from 'react';
import api from '../../services/api';

interface Route {
  id: string;
  name: string;
  origin: string;
  destination: string;
  max_passengers: number;
  max_speed_kmh: number;
  status: string;
  companies?: string[];
}

export function FiscalRoutesManagementPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/routes')
      .then((r: any) => setRoutes(r.data?.data ?? r.data ?? []))
      .catch(() => setRoutes([]))
      .finally(() => setLoading(false));
  }, []);

  const statusBadge = (s: string) => {
    const color = s === 'ACTIVA' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500';
    return <span className={`px-2 py-0.5 rounded text-xs ${color}`}>{s}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Rutas Autorizadas</h1>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : routes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay rutas registradas.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Destino</th>
                <th className="px-4 py-3">Vel. máx.</th>
                <th className="px-4 py-3">Pasajeros máx.</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {routes.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.origin}</td>
                  <td className="px-4 py-3 text-gray-600">{r.destination}</td>
                  <td className="px-4 py-3 text-gray-600">{r.max_speed_kmh} km/h</td>
                  <td className="px-4 py-3 text-gray-600">{r.max_passengers}</td>
                  <td className="px-4 py-3">{statusBadge(r.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
