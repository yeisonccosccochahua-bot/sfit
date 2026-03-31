import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, AlertTriangle, CheckCircle, RefreshCw, ClipboardPlus } from 'lucide-react';
import { inspectorApi, type DriverLookup } from '../../services/inspectorApi';

const FATIGA_COLOR: Record<string, string> = {
  APTO:     'bg-green-100 text-green-800',
  RIESGO:   'bg-yellow-100 text-yellow-800',
  NO_APTO:  'bg-red-100 text-red-800',
  INACTIVO: 'bg-gray-100 text-gray-600',
};

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function DriverLookupPage() {
  const navigate = useNavigate();
  const [dni, setDni]       = useState('');
  const [result, setResult] = useState<DriverLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  async function handleSearch() {
    const d = dni.trim();
    if (!d) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const r = await inspectorApi.lookupDriver(d);
      setResult(r);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? `Conductor con DNI ${d} no encontrado`);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartInspection() {
    if (!result) return;
    try {
      const insp = await inspectorApi.createInspection({
        tipo: 'VERIFICACION_CONDUCTOR',
        ubicacion_descripcion: 'Inspección iniciada desde búsqueda por DNI',
        driver_id: result.id,
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
          <User className="h-5 w-5 text-blue-600" /> Búsqueda de Conductor
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Consulta rápida por DNI</p>
      </div>

      {/* Search Box */}
      <div className="flex gap-2">
        <input
          value={dni}
          onChange={e => setDni(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Ingrese DNI del conductor"
          maxLength={15}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button onClick={handleSearch} disabled={loading || !dni.trim()}
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
          {/* Main card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex gap-4">
              {result.foto_url
                ? <img src={result.foto_url} alt={result.nombre} className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 shrink-0" />
                : <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200 shrink-0"><User className="h-10 w-10 text-gray-400" /></div>}
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">{result.nombre}</h2>
                <p className="text-sm text-gray-500">DNI: {result.dni}</p>
                <p className="text-sm text-gray-600">Empresa: <span className="font-medium">{result.empresa.nombre}</span></p>
                <div className="mt-2">
                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${FATIGA_COLOR[result.fatiga.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                    Fatiga: {result.fatiga.estado}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Licencia */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Licencia de Conducir</h3>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">Número: <span className="font-mono font-medium">{result.licencia.numero ?? '—'}</span></p>
              {result.licencia.vigente !== null && (
                result.licencia.vigente
                  ? <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full"><CheckCircle className="h-3 w-3" /> Vigente</span>
                  : <span className="flex items-center gap-1 text-xs text-red-700 bg-red-100 px-2 py-0.5 rounded-full"><AlertTriangle className="h-3 w-3" /> Vencida</span>
              )}
            </div>
            <p className="text-sm text-gray-500">Vencimiento: {fmtDate(result.licencia.vencimiento)}</p>
            {result.licencia.dias_para_vencer !== null && result.licencia.dias_para_vencer > 0 && result.licencia.dias_para_vencer < 30 && (
              <p className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded">
                ⚠ Vence en {result.licencia.dias_para_vencer} días
              </p>
            )}
          </div>

          {/* Fatiga */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Estado de Fatiga</h3>
            <div className="flex items-center gap-3">
              <div className={`flex-1 p-3 rounded-lg text-center font-bold text-lg ${FATIGA_COLOR[result.fatiga.estado] ?? 'bg-gray-100 text-gray-600'}`}>
                {result.fatiga.estado}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div className="bg-gray-50 p-2 rounded-lg">
                <p className="text-xs text-gray-500">Horas conducidas (24h)</p>
                <p className="font-bold text-gray-900">{result.fatiga.horas_conducidas_24h.toFixed(1)}h</p>
              </div>
              <div className="bg-gray-50 p-2 rounded-lg">
                <p className="text-xs text-gray-500">Reputación</p>
                <p className="font-bold text-gray-900">{result.reputation_score}/100</p>
              </div>
            </div>
            {result.fatiga.ultima_pausa && (
              <p className="text-xs text-gray-500">Última pausa: {new Date(result.fatiga.ultima_pausa).toLocaleString('es-PE')}</p>
            )}
          </div>

          {/* Active Trip */}
          {result.viaje_activo && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">Viaje Activo Actual</h3>
              <p className="text-sm text-blue-700">
                {result.viaje_activo.ruta?.origen} → {result.viaje_activo.ruta?.destino}
              </p>
              <p className="text-xs text-blue-600">Vehículo: <span className="font-mono font-semibold">{result.viaje_activo.vehiculo?.placa}</span></p>
            </div>
          )}

          {/* Action */}
          <button onClick={handleStartInspection}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 flex items-center justify-center gap-2">
            <ClipboardPlus className="h-5 w-5" /> Iniciar Inspección de este Conductor
          </button>
        </div>
      )}
    </div>
  );
}
