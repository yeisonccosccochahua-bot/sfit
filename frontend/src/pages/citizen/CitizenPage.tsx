import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Star, FileText, TrendingUp, Award, Clock } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import type { Report, PaginatedResponse } from '../../types';
import { ReportStatus, ReportType } from '../../types';

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? ''}`} />;
}

// ─── Fatigue badge colors ──────────────────────────────────────────────────────
const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  [ReportStatus.EN_REVISION]: 'En revisión',
  [ReportStatus.VALIDO]:      'Válido',
  [ReportStatus.INVALIDO]:    'Inválido',
};
const REPORT_STATUS_COLOR: Record<ReportStatus, string> = {
  [ReportStatus.EN_REVISION]: 'bg-amber-100 text-amber-700',
  [ReportStatus.VALIDO]:      'bg-green-100 text-green-700',
  [ReportStatus.INVALIDO]:    'bg-red-100 text-red-700',
};
const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  [ReportType.CONDUCTOR_DIFERENTE]:  'Conductor diferente',
  [ReportType.CONDICION_VEHICULO]:   'Condición del vehículo',
  [ReportType.CONDUCCION_PELIGROSA]: 'Conducción peligrosa',
  [ReportType.EXCESO_VELOCIDAD]:     'Exceso de velocidad',
  [ReportType.OTRO]:                 'Otro',
};

export function CitizenPage() {
  const { user } = useAuthStore();
  const navigate  = useNavigate();
  const [lastReport, setLastReport] = useState<Report | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    api.get<PaginatedResponse<Report>>('/api/reports?page=1&limit=1')
      .then((res) => setLastReport(res.data[0] ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const reputationPct = Math.min(100, Math.max(0, user?.reputation_score ?? 0));
  const repLabel = reputationPct >= 80 ? 'Excelente' : reputationPct >= 50 ? 'Buena' : 'Baja';
  const repColor = reputationPct >= 80 ? 'bg-green-500' : reputationPct >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="px-4 py-5 space-y-5 max-w-lg mx-auto">
      {/* Greeting */}
      <div>
        <p className="text-gray-500 text-sm">Bienvenido de vuelta</p>
        <h1 className="text-2xl font-bold text-gray-900">
          Hola, {user?.name?.split(' ')[0] ?? 'ciudadano'} 👋
        </h1>
      </div>

      {/* Primary CTA — Scan QR */}
      <button
        onClick={() => navigate('/citizen/scan')}
        className="w-full bg-[#1B4F72] hover:bg-[#154060] active:scale-95 transition-all
                   text-white rounded-2xl py-6 flex flex-col items-center gap-3 shadow-lg"
      >
        <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
          <QrCode className="h-9 w-9" />
        </div>
        <div className="text-center">
          <p className="text-xl font-bold tracking-wide">ESCANEAR QR</p>
          <p className="text-blue-200 text-sm mt-0.5">Verificar vehículo y reportar</p>
        </div>
      </button>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Points */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-5 w-5 text-amber-500" />
            <span className="text-xs text-gray-500 font-medium">Mis puntos</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{user?.total_points ?? 0}</p>
          <p className="text-xs text-gray-400 mt-0.5">puntos acumulados</p>
        </div>

        {/* Reports today */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-5 w-5 text-[#2E86C1]" />
            <span className="text-xs text-gray-500 font-medium">Hoy</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {user?.reports_today ?? 0}
            <span className="text-base font-normal text-gray-400">/3</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">reportes realizados</p>
        </div>
      </div>

      {/* Reputation bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#1B4F72]" />
            <span className="text-sm font-medium text-gray-700">Nivel de reputación</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-gray-900">{reputationPct}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              reputationPct >= 80 ? 'bg-green-100 text-green-700' :
              reputationPct >= 50 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>{repLabel}</span>
          </div>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${repColor}`}
            style={{ width: `${reputationPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {reputationPct < 30
            ? '⚠️ Reputación baja — no podrás reportar si baja de 30'
            : 'Sigue reportando para mantener tu reputación alta'}
        </p>
      </div>

      {/* Ranking teaser */}
      <button
        onClick={() => navigate('/citizen/ranking')}
        className="w-full bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-100
                   rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow"
      >
        <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Award className="h-5 w-5 text-amber-600" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-gray-800">Ver ranking municipal</p>
          <p className="text-xs text-gray-500">Compara tus puntos con otros ciudadanos</p>
        </div>
        <span className="text-gray-400 text-lg">›</span>
      </button>

      {/* Last report */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          Último reporte
        </h2>

        {loading ? (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ) : lastReport ? (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {REPORT_TYPE_LABEL[lastReport.type]}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(lastReport.created_at).toLocaleDateString('es-PE', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${REPORT_STATUS_COLOR[lastReport.status]}`}>
                {REPORT_STATUS_LABEL[lastReport.status]}
              </span>
            </div>
            {lastReport.description && (
              <p className="text-xs text-gray-500 mt-2 line-clamp-2">{lastReport.description}</p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <p className="text-sm text-gray-400">Aún no has realizado ningún reporte.</p>
            <p className="text-xs text-gray-400 mt-1">¡Escanea un QR para comenzar!</p>
          </div>
        )}
      </div>
    </div>
  );
}
