import { useEffect, useState } from 'react';
import { User, Star, FileText, TrendingUp, Award } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import type { Report, IncentivePoint, PaginatedResponse } from '../../types';
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

type Tab = 'reportes' | 'puntos';

export function CitizenProfile() {
  const { user, logout } = useAuthStore();
  const [tab, setTab]           = useState<Tab>('reportes');
  const [reports, setReports]   = useState<Report[]>([]);
  const [points, setPoints]     = useState<IncentivePoint[]>([]);
  const [loading, setLoading]   = useState(true);

  // Counts by status
  const [counts, setCounts] = useState({ valid: 0, invalid: 0, review: 0 });

  useEffect(() => {
    Promise.all([
      api.get<PaginatedResponse<Report>>('/api/reports?page=1&limit=20'),
      api.get<{ data: IncentivePoint[]; total: number; page: number; lastPage: number }>('/api/incentives/history?page=1&limit=20'),
    ])
      .then(([rRes, pRes]) => {
        const rs = rRes.data;
        setReports(rs);
        setPoints(pRes.data as unknown as IncentivePoint[]);
        setCounts({
          valid:   rs.filter((r) => r.status === ReportStatus.VALIDO).length,
          invalid: rs.filter((r) => r.status === ReportStatus.INVALIDO).length,
          review:  rs.filter((r) => r.status === ReportStatus.EN_REVISION).length,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const reputationPct = Math.min(100, Math.max(0, user?.reputation_score ?? 0));
  const repColor = reputationPct >= 80 ? 'bg-green-500' : reputationPct >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-[#1B4F72] flex items-center justify-center flex-shrink-0">
          <span className="text-white text-2xl font-bold">{user?.name?.charAt(0) ?? '?'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{user?.name}</h1>
          <p className="text-sm text-gray-500 truncate">{user?.email}</p>
        </div>
      </div>

      {/* Personal data */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {[
          { icon: User,      label: 'DNI',      value: user?.dni ? `****${user.dni.slice(-4)}` : '—' },
          { icon: FileText,  label: 'Email',    value: user?.email },
          { icon: Star,      label: 'Teléfono', value: user?.phone ?? '—' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3">
            <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 w-16">{label}</span>
            <span className="text-sm text-gray-900 font-medium truncate">{value}</span>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-2xl p-3 text-center border border-green-100">
          <p className="text-2xl font-bold text-green-700">{counts.valid}</p>
          <p className="text-xs text-green-600 mt-0.5">Válidos</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-3 text-center border border-amber-100">
          <p className="text-2xl font-bold text-amber-700">{counts.review}</p>
          <p className="text-xs text-amber-600 mt-0.5">En revisión</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-3 text-center border border-red-100">
          <p className="text-2xl font-bold text-red-700">{counts.invalid}</p>
          <p className="text-xs text-red-600 mt-0.5">Inválidos</p>
        </div>
      </div>

      {/* Reputation */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#1B4F72]" />
            <span className="text-sm font-medium text-gray-700">Reputación</span>
          </div>
          <span className="text-sm font-bold text-gray-900">{reputationPct} / 100</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${repColor}`} style={{ width: `${reputationPct}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">Límite mínimo: 30</span>
          <span className="text-xs text-gray-400 font-medium">
            {reputationPct >= 80 ? 'Excelente' : reputationPct >= 50 ? 'Buena' : 'Baja'}
          </span>
        </div>
      </div>

      {/* Points total */}
      <div className="bg-gradient-to-r from-[#1B4F72] to-[#2E86C1] rounded-2xl p-4 flex items-center gap-4">
        <Award className="h-10 w-10 text-white/80 flex-shrink-0" />
        <div>
          <p className="text-white/80 text-xs">Total de puntos acumulados</p>
          <p className="text-white text-3xl font-bold">{user?.total_points ?? 0}</p>
        </div>
      </div>

      {/* Tabs: reports / points history */}
      <div>
        <div className="flex border-b border-gray-200 mb-3">
          {(['reportes', 'puntos'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'border-b-2 border-[#1B4F72] text-[#1B4F72]'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'reportes' ? 'Mis reportes' : 'Historial de puntos'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100">
                <Skeleton className="h-4 w-1/3 mb-2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : tab === 'reportes' ? (
          reports.length > 0 ? (
            <div className="space-y-2">
              {reports.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{TYPE_LABEL[r.type]}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(r.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_COLOR[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  {r.description && (
                    <p className="text-xs text-gray-400 mt-2 line-clamp-2">{r.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Sin reportes aún</p>
            </div>
          )
        ) : (
          points.length > 0 ? (
            <div className="space-y-2">
              {points.map((p) => (
                <div key={p.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Star className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{p.description}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(p.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                  <span className="text-green-600 font-bold text-sm flex-shrink-0">+{p.points}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400">
              <Star className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Sin historial de puntos aún</p>
            </div>
          )
        )}
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full py-3 text-red-500 border border-red-200 rounded-xl text-sm font-medium
                   hover:bg-red-50 active:scale-95 transition-all"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
