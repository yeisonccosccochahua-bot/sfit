import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import api from '../../services/api';
import type { Report, PaginatedResponse } from '../../types';
import { ReportStatus, ReportType } from '../../types';

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ''}`} />;
}

const STATUS_LABEL: Record<ReportStatus, string> = {
  [ReportStatus.EN_REVISION]: 'En revisión',
  [ReportStatus.VALIDO]:      'Válido',
  [ReportStatus.INVALIDO]:    'Inválido',
};
const STATUS_COLOR: Record<ReportStatus, string> = {
  [ReportStatus.EN_REVISION]: 'bg-amber-100 text-amber-700',
  [ReportStatus.VALIDO]:      'bg-green-100 text-green-700',
  [ReportStatus.INVALIDO]:    'bg-red-100 text-red-700',
};
const TYPE_LABEL: Record<ReportType, string> = {
  [ReportType.CONDUCTOR_DIFERENTE]:  'Conductor diferente',
  [ReportType.CONDICION_VEHICULO]:   'Condición del vehículo',
  [ReportType.CONDUCCION_PELIGROSA]: 'Conducción peligrosa',
  [ReportType.EXCESO_VELOCIDAD]:     'Exceso de velocidad',
  [ReportType.OTRO]:                 'Otro',
};

export function MyReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [lastPage, setLastPage] = useState(1);

  function fetchReports(p: number) {
    setLoading(true);
    api.get<PaginatedResponse<Report>>(`/api/reports?page=${p}&limit=15`)
      .then((res) => {
        setReports(res.data);
        setLastPage(res.lastPage);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchReports(page); }, [page]);

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Mis reportes</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Sin reportes aún</p>
          <p className="text-xs mt-1">Escanea un QR para realizar tu primer reporte.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{TYPE_LABEL[r.type]}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(r.created_at).toLocaleDateString('es-PE', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLOR[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                {r.description && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2">{r.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Puntuación: {r.validation_score}/100
                </p>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {lastPage > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-xl
                           disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-500">{page} / {lastPage}</span>
              <button
                disabled={page >= lastPage}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-xl
                           disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
