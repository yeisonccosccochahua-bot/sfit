import { useLocation, useParams, useNavigate, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  CheckCircle, AlertTriangle, XCircle, Car, User, FileText,
  ClipboardPlus, ArrowLeft, RefreshCw, ShieldAlert,
} from 'lucide-react';
import { inspectorApi, type ScanQrResult } from '../../services/inspectorApi';

const STATUS_COLOR: Record<string, string> = {
  ACTIVO: 'bg-green-100 text-green-800',
  INACTIVO: 'bg-gray-100 text-gray-600',
  APTO: 'bg-green-100 text-green-800',
  RIESGO: 'bg-yellow-100 text-yellow-800',
  NO_APTO: 'bg-red-100 text-red-800',
};

function DocBadge({ vigente, label, vencimiento }: { vigente: boolean; label: string; vencimiento?: string | null }) {
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${vigente ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
      {vigente ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
      <div>
        <span className="font-medium">{label}</span>
        {vencimiento && <span className="text-xs ml-1 opacity-75">· {fmtDate(vencimiento)}</span>}
      </div>
    </div>
  );
}

export function InspectorScanResultPage() {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const { state: navState } = useLocation();
  const navigate = useNavigate();

  const [result, setResult] = useState<ScanQrResult | null>(navState?.scanResult ?? null);
  const [loading, setLoading] = useState(!navState?.scanResult);

  useEffect(() => {
    if (!result && inspectionId) {
      // Reload the inspection to recover state after page refresh
      inspectorApi.getInspection(inspectionId)
        .then(insp => {
          // Best-effort: build a minimal result from the inspection
          if (insp.vehicle) {
            setResult({
              qr_valido: true,
              inspection_id: insp.id,
              vehiculo: {
                id: insp.vehicle.id,
                placa: insp.vehicle.plate,
                marca: insp.vehicle.brand,
                modelo: insp.vehicle.model,
                color: insp.vehicle.color,
                year: insp.vehicle.year,
                foto_url: insp.vehicle.photo_url ?? null,
                estado: insp.vehicle.status,
                soat_vigente: insp.vehicle.soat_expires_at ? new Date(insp.vehicle.soat_expires_at) > new Date() : false,
                soat_vencimiento: insp.vehicle.soat_expires_at ?? null,
                revision_tecnica_vigente: insp.vehicle.inspection_expires_at ? new Date(insp.vehicle.inspection_expires_at) > new Date() : false,
                revision_tecnica_vencimiento: insp.vehicle.inspection_expires_at ?? null,
                empresa: { nombre: insp.vehicle.company?.name ?? '', ruc: insp.vehicle.company?.ruc ?? '' },
              },
              viaje_activo: null,
              conductores: [],
              alertas: [],
              requiere_accion: false,
            } as any);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
    </div>
  );

  if (!result || !result.vehiculo) return (
    <div className="text-center py-16 text-gray-500">
      <p>Resultado no disponible</p>
      <button onClick={() => navigate('/inspector/scan')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
        Volver a escanear
      </button>
    </div>
  );

  const { vehiculo, viaje_activo, conductores, alertas, inspection_id } = result;

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-4">
      {/* Nav */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Resultado de Escaneo</h1>
        {result.qr_valido
          ? <span className="ml-auto flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full"><CheckCircle className="h-3.5 w-3.5" /> QR Válido</span>
          : <span className="ml-auto flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded-full"><XCircle className="h-3.5 w-3.5" /> QR Inválido</span>}
      </div>

      {/* Alerts Banner */}
      {alertas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <p className="text-sm font-semibold text-red-800">Se detectaron {alertas.length} alerta{alertas.length > 1 ? 's' : ''}</p>
          </div>
          <ul className="space-y-1">
            {alertas.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <span className="shrink-0">•</span>{a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Vehicle Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Car className="h-4 w-4" /> Datos del Vehículo
        </h2>
        <div className="flex gap-4">
          {vehiculo.foto_url
            ? <img src={vehiculo.foto_url} alt={vehiculo.placa} className="w-24 h-20 rounded-lg object-cover border shrink-0" />
            : <div className="w-24 h-20 rounded-lg bg-gray-100 flex items-center justify-center border shrink-0"><Car className="h-8 w-8 text-gray-400" /></div>}
          <div className="flex-1 space-y-1">
            <p className="text-2xl font-bold font-mono text-gray-900 tracking-wider">{vehiculo.placa}</p>
            <p className="text-gray-700">{[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ')} {vehiculo.year && `(${vehiculo.year})`}</p>
            {vehiculo.color && <p className="text-sm text-gray-500">Color: {vehiculo.color}</p>}
            <p className="text-sm text-gray-500">Empresa: <span className="font-medium text-gray-700">{vehiculo.empresa.nombre}</span></p>
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[vehiculo.estado] ?? 'bg-gray-100 text-gray-600'}`}>
              {vehiculo.estado}
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <DocBadge vigente={vehiculo.soat_vigente} label="SOAT" vencimiento={vehiculo.soat_vencimiento} />
          <DocBadge vigente={vehiculo.revision_tecnica_vigente} label="Rev. Técnica" vencimiento={vehiculo.revision_tecnica_vencimiento} />
        </div>
      </div>

      {/* Active Trip */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Viaje Activo</h2>
        {viaje_activo ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">{viaje_activo.ruta.origen} → {viaje_activo.ruta.destino}</p>
            <p className="text-xs text-gray-500">
              Inicio: {new Date(viaje_activo.hora_inicio).toLocaleTimeString('es-PE')} ·
              Transcurrido: {Math.floor(viaje_activo.tiempo_transcurrido_minutos / 60)}h {viaje_activo.tiempo_transcurrido_minutos % 60}min
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-800">Sin viaje activo registrado — posible irregularidad</p>
          </div>
        )}
      </div>

      {/* Drivers */}
      {conductores.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <User className="h-4 w-4" /> Conductor{conductores.length > 1 ? 'es' : ''}
          </h2>
          <div className="space-y-4">
            {conductores.map(c => (
              <div key={c.id} className="flex gap-4 p-3 rounded-lg bg-gray-50">
                {c.foto_url
                  ? <img src={c.foto_url} alt={c.nombre} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm shrink-0" />
                  : <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center shrink-0"><User className="h-7 w-7 text-gray-400" /></div>}
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{c.nombre}</p>
                  <p className="text-xs text-gray-500">DNI: {c.dni} · {c.rol}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[c.fatiga.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                      Fatiga: {c.fatiga.estado}
                    </span>
                    {c.licencia.vigente === false && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Licencia vencida</span>
                    )}
                    {c.sanciones_activas > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">{c.sanciones_activas} sanciones</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {c.fatiga.horas_conducidas_24h.toFixed(1)}h conducidas · Reputación: {c.reputation_score}/100
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {inspection_id && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ClipboardPlus className="h-4 w-4" /> Acciones de Inspección
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to={`/inspector/inspections/${inspection_id}`}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-blue-600 text-blue-600 text-sm font-medium hover:bg-blue-50">
              <FileText className="h-4 w-4" /> Ver Inspección
            </Link>
            <Link to={`/inspector/inspections/${inspection_id}?action=finalize`}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">
              <CheckCircle className="h-4 w-4" /> Todo Conforme ✓
            </Link>
            <Link to={`/inspector/inspections/${inspection_id}?action=observe`}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50">
              <ClipboardPlus className="h-4 w-4" /> Agregar Observación
            </Link>
            <Link to={`/inspector/inspections/${inspection_id}?action=infraccion`}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">
              <ShieldAlert className="h-4 w-4" /> Registrar Infracción
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
