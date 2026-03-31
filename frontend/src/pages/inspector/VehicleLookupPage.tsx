import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Car, AlertTriangle, CheckCircle, RefreshCw, ClipboardPlus, User, XCircle } from 'lucide-react';
import { inspectorApi, type VehicleLookup } from '../../services/inspectorApi';

const STATUS_COLOR: Record<string, string> = {
  ACTIVO: 'bg-green-100 text-green-800',
  INACTIVO: 'bg-gray-100 text-gray-600',
  EN_MANTENIMIENTO: 'bg-yellow-100 text-yellow-800',
  SUSPENDIDO: 'bg-red-100 text-red-800',
  FUERA_DE_CIRCULACION: 'bg-red-200 text-red-900',
  DADO_DE_BAJA: 'bg-gray-200 text-gray-700',
};

const FATIGA_COLOR: Record<string, string> = {
  APTO:    'bg-green-100 text-green-800',
  RIESGO:  'bg-yellow-100 text-yellow-800',
  NO_APTO: 'bg-red-100 text-red-800',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function VehicleLookupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialResult = (location.state as any)?.vehicleResult ?? null;

  const [plate, setPlate]   = useState('');
  const [result, setResult] = useState<VehicleLookup | null>(initialResult);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  async function handleSearch() {
    const p = plate.trim().toUpperCase();
    if (!p) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const r = await inspectorApi.lookupVehicle(p);
      setResult(r);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? `Vehículo ${p} no encontrado`);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartInspection() {
    if (!result) return;
    try {
      const insp = await inspectorApi.createInspection({
        tipo: 'INSPECCION_VEHICULO',
        ubicacion_descripcion: 'Inspección iniciada desde búsqueda por placa',
        vehicle_id: result.id,
      });
      navigate(`/inspector/inspections/${insp.id}`);
    } catch {
      alert('Error al crear inspección');
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 p-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Car className="h-5 w-5 text-blue-600" /> Búsqueda de Vehículo
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Consulta rápida por placa</p>
      </div>

      <div className="flex gap-2">
        <input
          value={plate}
          onChange={e => setPlate(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Placa: ABC-123"
          maxLength={10}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-base font-mono uppercase focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button onClick={handleSearch} disabled={loading || !plate.trim()}
          className="px-5 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 rounded-xl border border-red-200">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Alerts */}
          {(['SUSPENDIDO','FUERA_DE_CIRCULACION','DADO_DE_BAJA'].includes(result.estado) ||
            !result.documentos.soat_vigente || !result.documentos.revision_tecnica_vigente) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" /> Alertas detectadas
              </h3>
              <ul className="space-y-1">
                {['SUSPENDIDO','FUERA_DE_CIRCULACION','DADO_DE_BAJA'].includes(result.estado) && (
                  <li className="text-sm text-red-700">• Vehículo en estado: {result.estado}</li>
                )}
                {!result.documentos.soat_vigente && (
                  <li className="text-sm text-red-700">• SOAT vencido ({fmtDate(result.documentos.soat_vencimiento)})</li>
                )}
                {!result.documentos.revision_tecnica_vigente && (
                  <li className="text-sm text-red-700">• Revisión técnica vencida ({fmtDate(result.documentos.revision_tecnica_vencimiento)})</li>
                )}
              </ul>
            </div>
          )}

          {/* Vehicle Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex gap-4">
              {result.foto_url
                ? <img src={result.foto_url} alt={result.placa} className="w-24 h-20 rounded-lg object-cover border shrink-0" />
                : <div className="w-24 h-20 rounded-lg bg-gray-100 flex items-center justify-center border shrink-0"><Car className="h-8 w-8 text-gray-400" /></div>}
              <div>
                <p className="text-2xl font-bold font-mono text-gray-900 tracking-wider">{result.placa}</p>
                <p className="text-gray-700">{[result.marca, result.modelo].filter(Boolean).join(' ')} {result.year && `(${result.year})`}</p>
                {result.color && <p className="text-sm text-gray-500">Color: {result.color}</p>}
                <p className="text-sm text-gray-500">Empresa: <span className="font-medium text-gray-700">{result.empresa.nombre}</span></p>
                <span className={`mt-1 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[result.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                  {result.estado}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { label: 'SOAT', vigente: result.documentos.soat_vigente, venc: result.documentos.soat_vencimiento },
                { label: 'Rev. Técnica', vigente: result.documentos.revision_tecnica_vigente, venc: result.documentos.revision_tecnica_vencimiento },
              ].map(doc => (
                <div key={doc.label} className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${doc.vigente ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  {doc.vigente ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                  <div>
                    <span className="font-medium">{doc.label}</span>
                    <p className="text-xs opacity-75">{fmtDate(doc.venc)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Trip */}
          {result.viaje_activo ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Viaje Activo</h3>
              <p className="text-sm font-medium text-gray-900">
                {result.viaje_activo.ruta?.origen} → {result.viaje_activo.ruta?.destino}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Inicio: {new Date(result.viaje_activo.hora_inicio).toLocaleTimeString('es-PE')}
              </p>
              {result.viaje_activo.conductores?.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-gray-500">Conductores:</p>
                  {result.viaje_activo.conductores.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-2 text-sm">
                      {c.foto_url
                        ? <img src={c.foto_url} alt={c.nombre} className="w-8 h-8 rounded-full object-cover border shrink-0" />
                        : <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0"><User className="h-4 w-4 text-gray-400" /></div>}
                      <span className="text-gray-800">{c.nombre}</span>
                      <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${FATIGA_COLOR[c.estado_fatiga] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.estado_fatiga}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
              <div className="flex items-center gap-2 text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Sin viaje activo registrado para este vehículo
              </div>
            </div>
          )}

          <button onClick={handleStartInspection}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 flex items-center justify-center gap-2">
            <ClipboardPlus className="h-5 w-5" /> Iniciar Inspección de este Vehículo
          </button>
        </div>
      )}
    </div>
  );
}
