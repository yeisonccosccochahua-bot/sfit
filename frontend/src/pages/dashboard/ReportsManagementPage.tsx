import { useEffect, useState } from 'react';
import api from '../../services/api';

interface Report {
  id: string;
  type: string;
  status: string;
  validation_score: number;
  description: string;
  created_at: string;
  citizen?: { name: string };
  trip?: { id: string };
}

export function ReportsManagementPage() {
  const [reports, setReports]   = useState<Report[]>([]);
  const [loading, setLoading]   = useState(true);
  const [statusF, setStatusF]   = useState('');
  const [typeF, setTypeF]       = useState('');
  const [page, setPage]         = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const load = () => {
    setLoading(true);
    const params: Record<string, string | number> = { page, limit: 20 };
    if (statusF) params.status = statusF;
    if (typeF)   params.type   = typeF;

    api.get('/api/reports', { params })
      .then((r: any) => {
        setReports(r.data?.data ?? r.data ?? []);
        setLastPage(r.data?.lastPage ?? 1);
      })
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusF, typeF, page]);

  const validate = async (id: string, status: 'VALIDO' | 'INVALIDO') => {
    await api.patch(`/api/reports/${id}/validate`, { status });
    load();
  };

  const scoreBadge = (score: number) => {
    const color = score >= 70 ? 'bg-green-100 text-green-700' : score >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
    return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{score}</span>;
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      EN_REVISION: 'bg-yellow-100 text-yellow-700',
      VALIDO:      'bg-green-100 text-green-700',
      INVALIDO:    'bg-red-100 text-red-700',
      ARCHIVADO:   'bg-gray-100 text-gray-500',
    };
    return <span className={`px-2 py-0.5 rounded text-xs ${map[s] ?? 'bg-gray-100 text-gray-600'}`}>{s}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Reportes Ciudadanos</h1>

      <div className="flex gap-3 flex-wrap">
        <select value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }} className="border rounded px-3 py-1.5 text-sm">
          <option value="">Todos los estados</option>
          <option value="EN_REVISION">En revisión</option>
          <option value="VALIDO">Válido</option>
          <option value="INVALIDO">Inválido</option>
        </select>
        <select value={typeF} onChange={(e) => { setTypeF(e.target.value); setPage(1); }} className="border rounded px-3 py-1.5 text-sm">
          <option value="">Todos los tipos</option>
          <option value="CONDUCCION_PELIGROSA">Conducción peligrosa</option>
          <option value="EXCESO_VELOCIDAD">Exceso de velocidad</option>
          <option value="TRATO_INDEBIDO">Trato indebido</option>
          <option value="COBRO_EXCESIVO">Cobro excesivo</option>
          <option value="OTRO">Otro</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Cargando...</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No hay reportes con los filtros seleccionados.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Ciudadano</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{r.citizen?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{r.type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3">{scoreBadge(r.validation_score)}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{r.description}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(r.created_at).toLocaleDateString('es-BO')}</td>
                  <td className="px-4 py-3">
                    {r.status === 'EN_REVISION' && (
                      <div className="flex gap-1">
                        <button onClick={() => validate(r.id, 'VALIDO')} className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">
                          Válido
                        </button>
                        <button onClick={() => validate(r.id, 'INVALIDO')} className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">
                          Inválido
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-40">
            ← Anterior
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">{page} / {lastPage}</span>
          <button disabled={page >= lastPage} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-40">
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
