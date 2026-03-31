import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Bus, MapPin, UserCheck, Shield, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { QrScanResult } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import { useState } from 'react';

// ─── Fatigue status display ───────────────────────────────────────────────────
const FATIGUE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  APTO:    { label: 'Apto',     bg: 'bg-green-100',  text: 'text-green-700'  },
  RIESGO:  { label: 'Riesgo',   bg: 'bg-amber-100',  text: 'text-amber-700'  },
  NO_APTO: { label: 'No apto',  bg: 'bg-red-100',    text: 'text-red-700'    },
};

const ROLE_LABELS: Record<string, string> = {
  PRINCIPAL: 'Principal',
  SUPLENTE:  'Suplente',
  COPILOTO:  'Copiloto',
};

export function TripViewPage() {
  const { tripId }  = useParams<{ tripId: string }>();
  const location    = useLocation();
  const navigate    = useNavigate();
  const { user }    = useAuthStore();
  const [posting, setPosting] = useState(false);

  const scanResult: QrScanResult | undefined = location.state?.scanResult;
  const trip = scanResult?.active_trip;

  if (!trip || !scanResult) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <p className="text-gray-700 font-semibold">No se encontraron datos del viaje.</p>
        <button
          onClick={() => navigate('/citizen/scan')}
          className="px-5 py-2.5 bg-[#1B4F72] text-white rounded-xl text-sm font-medium"
        >
          Escanear de nuevo
        </button>
      </div>
    );
  }

  const reportsLeft = Math.max(0, 3 - (user?.reports_today ?? 0));
  const canReport   = scanResult.can_report && reportsLeft > 0;

  // ── "Todo bien" — awards validation points ──────────────────────────────────
  async function handleAllGood() {
    if (!canReport || posting) return;
    setPosting(true);
    try {
      await api.post('/api/reports', {
        trip_id:        tripId,
        qr_code:        location.state?.qrCode ?? '',
        type:           'OTRO',
        description:    'Validación ciudadana — conductor correcto, sin incidencias.',
        is_same_driver: true,
      });
      navigate('/citizen', { replace: true });
    } catch {
      // best-effort
      navigate('/citizen', { replace: true });
    } finally {
      setPosting(false);
    }
  }

  // ── Conductor diferente ──────────────────────────────────────────────────────
  function handleDifferentDriver() {
    navigate(`/citizen/report/${tripId}`, {
      state: {
        qrCode:        location.state?.qrCode,
        isSameDriver:  false,
        preselectedType: 'CONDUCTOR_DIFERENTE',
      },
    });
  }

  // ── Reportar problema ────────────────────────────────────────────────────────
  function handleReportProblem() {
    navigate(`/citizen/report/${tripId}`, {
      state: { qrCode: location.state?.qrCode, isSameDriver: true },
    });
  }

  return (
    <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900">Información del viaje</h1>

      {/* Vehicle card */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl bg-[#1B4F72]/10 flex items-center justify-center">
            <Bus className="h-5 w-5 text-[#1B4F72]" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">{scanResult.vehicle.plate}</p>
            <p className="text-xs text-gray-500">{scanResult.vehicle.company_name}</p>
          </div>
          {scanResult.vehicle.qr_valid && (
            <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              QR verificado
            </span>
          )}
        </div>

        {/* Route */}
        <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-xl p-3">
          <MapPin className="h-4 w-4 text-[#2E86C1] flex-shrink-0" />
          <span className="font-medium">{trip.route.origin}</span>
          <span className="text-gray-400 mx-1">→</span>
          <span className="font-medium">{trip.route.destination}</span>
        </div>

        {/* Start time */}
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5" />
          <span>Salida: {new Date(trip.start_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
          {trip.estimated_arrival && (
            <span className="ml-auto">
              Llegada estimada: {new Date(trip.estimated_arrival).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Drivers */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-[#1B4F72]" />
          Conductor{trip.drivers.length > 1 ? 'es' : ''} asignado{trip.drivers.length > 1 ? 's' : ''}
        </h2>
        <div className="space-y-3">
          {trip.drivers.map((d, i) => {
            const fatigue = FATIGUE_CONFIG[d.fatigue_status] ?? FATIGUE_CONFIG.APTO;
            return (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                {d.photo_url ? (
                  <img src={d.photo_url} alt={d.name} className="h-12 w-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-[#AED6F1] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#1B4F72] font-bold text-lg">{d.name.charAt(0)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{d.name}</p>
                  <p className="text-xs text-gray-500">DNI: ****{d.dni_last_4}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fatigue.bg} ${fatigue.text}`}>
                    {fatigue.label}
                  </span>
                  <span className="text-xs text-gray-400">{ROLE_LABELS[d.role] ?? d.role}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver identity question */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <div className="flex items-start gap-2 mb-4">
          <Shield className="h-5 w-5 text-[#1B4F72] flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-gray-800">
            ¿El conductor coincide con el registrado en el sistema?
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDifferentDriver}
            className="flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-600
                       active:scale-95 text-white rounded-xl font-semibold transition-all"
          >
            <XCircle className="h-5 w-5" />
            NO
          </button>
          <button
            onClick={() => {/* reveal next section */}}
            className="flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-600
                       active:scale-95 text-white rounded-xl font-semibold transition-all"
          >
            <CheckCircle2 className="h-5 w-5" />
            SÍ
          </button>
        </div>
      </div>

      {/* Action buttons (always visible if SÍ was implied by scanning) */}
      <div className="space-y-3 pb-4">
        {canReport ? (
          <>
            <button
              onClick={handleReportProblem}
              className="w-full py-3.5 border-2 border-red-400 text-red-600 rounded-xl
                         font-semibold hover:bg-red-50 active:scale-95 transition-all"
            >
              ⚠️ Reportar problema
            </button>
            <button
              disabled={posting}
              onClick={handleAllGood}
              className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-xl
                         font-semibold active:scale-95 transition-all disabled:opacity-60"
            >
              {posting ? 'Registrando…' : '✅ Todo bien (+5 puntos)'}
            </button>
          </>
        ) : (
          <div className="text-center py-3 bg-gray-100 rounded-xl">
            <p className="text-sm text-gray-600 font-medium">
              {scanResult.can_report
                ? '⛔ Límite diario de reportes alcanzado (3/3)'
                : '⚠️ No puedes reportar en este momento'}
            </p>
          </div>
        )}
        {reportsLeft > 0 && canReport && (
          <p className="text-center text-xs text-gray-400">
            Reportes disponibles hoy: {reportsLeft} de 3
          </p>
        )}
      </div>
    </div>
  );
}
