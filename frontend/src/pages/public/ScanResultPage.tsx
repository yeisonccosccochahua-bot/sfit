import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bus, CheckCircle2, AlertCircle, Clock, MapPin, User } from 'lucide-react';

interface DriverInfo {
  name: string;
  dni_last_4: string;
  role: string;
  fatigue_status: string;
  photo_url: string | null;
}

interface ScanResult {
  vehicle: { plate: string; company_name: string; qr_valid: true };
  active_trip: {
    id: string;
    route: { origin: string; destination: string };
    drivers: DriverInfo[];
    start_time: string;
    estimated_arrival: string;
    status: string;
  } | null;
  can_report: boolean;
}

type PageState = 'loading' | 'ok' | 'error';

const FATIGUE_COLOR: Record<string, string> = {
  APTO:    'bg-green-100 text-green-800',
  RIESGO:  'bg-amber-100 text-amber-800',
  NO_APTO: 'bg-red-100 text-red-800',
};

export function ScanResultPage() {
  const { qrCode } = useParams<{ qrCode: string }>();
  const [state, setState]   = useState<PageState>('loading');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    if (!qrCode) { setState('error'); setErrMsg('Código QR inválido.'); return; }
    fetch(`/api/qr/scan/${encodeURIComponent(qrCode)}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.message ?? 'QR no válido o falsificado.');
        }
        return r.json();
      })
      .then((data: ScanResult) => { setResult(data); setState('ok'); })
      .catch((e) => { setErrMsg(e.message); setState('error'); });
  }, [qrCode]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#1B4F72] text-white px-5 py-4 flex items-center gap-3 shadow">
        <Bus className="h-6 w-6 text-[#AED6F1]" />
        <div>
          <p className="text-lg font-bold leading-none">SFIT</p>
          <p className="text-xs text-[#AED6F1]">Sistema de Fiscalización de Transporte</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 max-w-md mx-auto w-full">

        {state === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-20">
            <div className="h-14 w-14 rounded-full border-4 border-[#1B4F72] border-t-transparent animate-spin" />
            <p className="text-gray-600 font-medium">Verificando QR…</p>
          </div>
        )}

        {state === 'error' && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">QR no válido</p>
              <p className="text-sm text-gray-500 mt-1">{errMsg}</p>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Si crees que es un error, contacta al operador de la unidad.
            </p>
          </div>
        )}

        {state === 'ok' && result && (
          <div className="w-full space-y-4">
            {/* Vehicle card */}
            <div className="rounded-2xl bg-white shadow p-5 border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-black tracking-widest text-[#1B4F72]">{result.vehicle.plate}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{result.vehicle.company_name}</p>
                </div>
                <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                  <CheckCircle2 className="h-3.5 w-3.5" /> QR auténtico
                </span>
              </div>
            </div>

            {/* No active trip */}
            {!result.active_trip && (
              <div className="rounded-2xl bg-white shadow p-5 border border-gray-100 text-center">
                <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-600 font-medium">Sin viaje activo</p>
                <p className="text-xs text-gray-400 mt-1">
                  Este vehículo no tiene un viaje en curso en este momento.
                </p>
              </div>
            )}

            {/* Active trip */}
            {result.active_trip && (
              <>
                <div className="rounded-2xl bg-white shadow p-5 border border-gray-100 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Viaje en curso</p>
                  <div className="flex items-center gap-2 text-gray-800 font-medium">
                    <MapPin className="h-4 w-4 text-[#2E86C1] shrink-0" />
                    {result.active_trip.route.origin}
                    <span className="text-gray-400 mx-1">→</span>
                    {result.active_trip.route.destination}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>
                      Salida: {new Date(result.active_trip.start_time).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>
                      Llegada est.: {new Date(result.active_trip.estimated_arrival).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Drivers */}
                <div className="rounded-2xl bg-white shadow p-5 border border-gray-100 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Conductor{result.active_trip.drivers.length > 1 ? 'es' : ''}
                  </p>
                  {result.active_trip.drivers.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-[#AED6F1] flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-[#1B4F72]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{d.name}</p>
                          <p className="text-xs text-gray-400">DNI ···{d.dni_last_4} · {d.role}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${FATIGUE_COLOR[d.fatigue_status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {d.fatigue_status}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Report CTA */}
                {result.can_report && (
                  <div className="rounded-2xl bg-[#1B4F72] p-5 text-white text-center space-y-3">
                    <p className="font-semibold">¿El conductor no coincide?</p>
                    <p className="text-xs text-[#AED6F1]">
                      Si el conductor en el vehículo no es el registrado en el sistema, puedes reportarlo.
                    </p>
                    <Link
                      to={`/citizen/report/${result.active_trip.id}`}
                      className="inline-block rounded-xl bg-white text-[#1B4F72] font-semibold text-sm px-5 py-2.5 hover:bg-[#AED6F1] transition-colors"
                    >
                      Reportar incidencia
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <footer className="px-5 py-4 text-center text-xs text-gray-400 border-t border-gray-100">
        SFIT © 2026 · Sistema de Fiscalización Inteligente de Transporte
      </footer>
    </div>
  );
}
