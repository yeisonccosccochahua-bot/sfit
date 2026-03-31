import { useEffect, useState } from 'react';
import api from '../../services/api';

interface Company {
  id: string;
  name: string;
  nit?: string;
  contact_email?: string;
  contact_phone?: string;
  status: string;
  vehicle_count?: number;
  driver_count?: number;
}

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    api.get('/api/companies')
      .then((r: any) => setCompanies(r.data?.data ?? r.data ?? []))
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false));
  }, []);

  const statusBadge = (s: string) => {
    const color = s === 'ACTIVA' ? 'bg-green-100 text-green-700' : s === 'SUSPENDIDA' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500';
    return <span className={`px-2 py-0.5 rounded text-xs ${color}`}>{s}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Empresas de Transporte</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : companies.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay empresas registradas.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">NIT</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Vehículos</th>
                <th className="px-4 py-3">Conductores</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.nit ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.contact_email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.contact_phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.vehicle_count ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.driver_count ?? '—'}</td>
                  <td className="px-4 py-3">{statusBadge(c.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
