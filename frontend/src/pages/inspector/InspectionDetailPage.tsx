import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ClipboardCheck, Car, User, MapPin, Camera,
  Plus, CheckCircle, AlertTriangle, XCircle, RefreshCw, ShieldAlert,
} from 'lucide-react';
import { inspectorApi, type Inspection } from '../../services/inspectorApi';

const RESULT_COLOR: Record<string, string> = {
  EN_PROCESO:          'bg-blue-100 text-blue-800',
  CONFORME:            'bg-green-100 text-green-800',
  CON_OBSERVACIONES:   'bg-yellow-100 text-yellow-800',
  INFRACCION_DETECTADA:'bg-red-100 text-red-800',
};

const GRAVEDAD_COLOR: Record<string, string> = {
  LEVE:     'bg-yellow-100 text-yellow-800',
  MODERADA: 'bg-orange-100 text-orange-800',
  GRAVE:    'bg-red-100 text-red-800',
};

export function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action');

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  // Observation form
  const [showObsForm, setShowObsForm] = useState(action === 'observe');
  const [obsDesc, setObsDesc]   = useState('');
  const [obsTipo, setObsTipo]   = useState('OTRO');
  const [obsGrav, setObsGrav]   = useState<'LEVE'|'MODERADA'|'GRAVE'>('LEVE');
  const [savingObs, setSavingObs] = useState(false);

  // Finalize form
  const [showFinalizeForm, setShowFinalizeForm] = useState(action === 'finalize' || action === 'infraccion');
  const [finResultado, setFinResultado] = useState(action === 'infraccion' ? 'INFRACCION_DETECTADA' : 'CONFORME');
  const [finNotas, setFinNotas]   = useState('');
  const [finDerivar, setFinDerivar] = useState(action === 'infraccion');
  const [finalizing, setFinalizing] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const insp = await inspectorApi.getInspection(id);
      setInspection(insp);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudo cargar la inspección');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleAddObs() {
    if (!id || !obsDesc.trim()) return;
    setSavingObs(true);
    try {
      const updated = await inspectorApi.addObservacion(id, { descripcion: obsDesc, tipo: obsTipo, gravedad: obsGrav });
      setInspection(updated);
      setShowObsForm(false);
      setObsDesc('');
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al guardar observación');
    } finally {
      setSavingObs(false);
    }
  }

  async function handleFinalize() {
    if (!id) return;
    setFinalizing(true);
    try {
      const updated = await inspectorApi.finalizeInspection(id, {
        resultado: finResultado,
        notas_adicionales: finNotas || undefined,
        derivar_sancion: finDerivar,
      });
      setInspection(updated);
      setShowFinalizeForm(false);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Error al finalizar');
    } finally {
      setFinalizing(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
    </div>
  );

  if (error) return (
    <div className="text-center py-16">
      <p className="text-red-600 mb-3">{error}</p>
      <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Volver</button>
    </div>
  );

  if (!inspection) return null;

  const isOpen = inspection.resultado === 'EN_PROCESO';

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Inspección</h1>
          <p className="text-xs text-gray-500">{inspection.tipo.replace(/_/g, ' ')} · {new Date(inspection.created_at).toLocaleString('es-PE')}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${RESULT_COLOR[inspection.resultado] ?? 'bg-gray-100 text-gray-600'}`}>
          {inspection.resultado.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        {inspection.ubicacion_descripcion && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
            {inspection.ubicacion_descripcion}
          </div>
        )}
        {(inspection as any).vehicle && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <Car className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="font-mono font-semibold">{(inspection as any).vehicle.plate}</span>
            <span className="text-gray-500">{(inspection as any).vehicle.brand} {(inspection as any).vehicle.model}</span>
          </div>
        )}
        {(inspection as any).driver && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <User className="h-4 w-4 text-gray-400 shrink-0" />
            {(inspection as any).driver.name} · {(inspection as any).driver.dni}
          </div>
        )}
        {inspection.notas_adicionales && (
          <p className="text-sm text-gray-600 border-t pt-3">{inspection.notas_adicionales}</p>
        )}
      </div>

      {/* Verificacion Conductor */}
      {inspection.verificacion_conductor && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <User className="h-4 w-4" /> Verificación de Conductor
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['Conductor coincide', inspection.verificacion_conductor.conductor_coincide],
              ['Licencia vigente', inspection.verificacion_conductor.licencia_vigente],
              ['Categoría correcta', inspection.verificacion_conductor.licencia_categoria_correcta],
            ].map(([label, val]) => (
              <div key={String(label)} className={`flex items-center gap-2 p-2 rounded-lg ${val ? 'bg-green-50' : 'bg-red-50'}`}>
                {val ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                <span className={val ? 'text-green-800' : 'text-red-800'}>{String(label)}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
              <span className="text-gray-600">Fatiga visual:</span>
              <span className="font-medium">{inspection.verificacion_conductor.estado_fatiga_visual}</span>
            </div>
          </div>
          {inspection.verificacion_conductor.observaciones_conductor && (
            <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
              {inspection.verificacion_conductor.observaciones_conductor}
            </p>
          )}
        </div>
      )}

      {/* Verificacion Vehiculo */}
      {inspection.verificacion_vehiculo && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Car className="h-4 w-4" /> Verificación de Vehículo
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['Luces funcionan', inspection.verificacion_vehiculo.luces_funcionan],
              ['Documentos vigentes', inspection.verificacion_vehiculo.documentos_vigentes],
              ['SOAT vigente', inspection.verificacion_vehiculo.soat_vigente],
              ['Rev. técnica vigente', inspection.verificacion_vehiculo.revision_tecnica_vigente],
            ].map(([label, val]) => (
              <div key={String(label)} className={`flex items-center gap-2 p-2 rounded-lg ${val ? 'bg-green-50' : 'bg-red-50'}`}>
                {val ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> : <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                <span className={val ? 'text-green-800' : 'text-red-800'}>{String(label)}</span>
              </div>
            ))}
          </div>
          {inspection.verificacion_vehiculo.capacidad_excedida && (
            <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-red-50 text-red-800 text-sm">
              <AlertTriangle className="h-4 w-4" /> Capacidad excedida
            </div>
          )}
        </div>
      )}

      {/* Observations */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" /> Observaciones ({inspection.observaciones?.length ?? 0})
          </h2>
          {isOpen && (
            <button onClick={() => setShowObsForm(!showObsForm)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <Plus className="h-3.5 w-3.5" /> Agregar
            </button>
          )}
        </div>

        {showObsForm && (
          <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
            <textarea
              value={obsDesc} onChange={e => setObsDesc(e.target.value)}
              placeholder="Descripción de la observación…"
              rows={3}
              className="w-full text-sm border border-gray-300 rounded-lg p-2 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <div className="flex gap-2">
              <select value={obsTipo} onChange={e => setObsTipo(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5">
                {['DOCUMENTOS','ESTADO_VEHICULO','CONDUCTOR','RUTA','PASAJEROS','OTRO'].map(t =>
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={obsGrav} onChange={e => setObsGrav(e.target.value as any)}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5">
                <option value="LEVE">LEVE</option>
                <option value="MODERADA">MODERADA</option>
                <option value="GRAVE">GRAVE</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowObsForm(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleAddObs} disabled={savingObs || !obsDesc.trim()}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {savingObs ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {(!inspection.observaciones || inspection.observaciones.length === 0) && !showObsForm ? (
          <p className="text-sm text-gray-400 text-center py-4">Sin observaciones registradas</p>
        ) : (
          <ul className="space-y-2">
            {(inspection.observaciones ?? []).map((obs, i) => (
              <li key={i} className="flex items-start gap-2 p-3 rounded-lg bg-gray-50">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-800">{obs.descripcion}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs text-gray-500">{obs.tipo.replace(/_/g,' ')}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${GRAVEDAD_COLOR[obs.gravedad]}`}>{obs.gravedad}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Photos */}
      {(inspection.fotos_evidencia?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Camera className="h-4 w-4" /> Fotos de Evidencia ({inspection.fotos_evidencia.length})
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {inspection.fotos_evidencia.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`Evidencia ${i+1}`} className="w-full h-24 rounded-lg object-cover border hover:opacity-90" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Finalize Section */}
      {isOpen && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Finalizar Inspección
            </h2>
            {!showFinalizeForm && (
              <button onClick={() => setShowFinalizeForm(true)}
                className="text-xs text-blue-600 hover:underline">Abrir formulario</button>
            )}
          </div>

          {showFinalizeForm && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Resultado *</label>
                <select value={finResultado} onChange={e => { setFinResultado(e.target.value); setFinDerivar(e.target.value === 'INFRACCION_DETECTADA'); }}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
                  <option value="CONFORME">CONFORME</option>
                  <option value="CON_OBSERVACIONES">CON OBSERVACIONES</option>
                  <option value="INFRACCION_DETECTADA">INFRACCIÓN DETECTADA</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Notas adicionales</label>
                <textarea value={finNotas} onChange={e => setFinNotas(e.target.value)} rows={3}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Observaciones finales…" />
              </div>
              {finResultado === 'INFRACCION_DETECTADA' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={finDerivar} onChange={e => setFinDerivar(e.target.checked)}
                    className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700 flex items-center gap-1">
                    <ShieldAlert className="h-4 w-4 text-red-500" /> Derivar a proceso de sanción
                  </span>
                </label>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowFinalizeForm(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={handleFinalize} disabled={finalizing}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${
                    finResultado === 'INFRACCION_DETECTADA' ? 'bg-red-600 hover:bg-red-700' :
                    finResultado === 'CONFORME' ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-500 hover:bg-yellow-600'
                  }`}>
                  {finalizing ? 'Guardando…' : 'Finalizar Inspección'}
                </button>
              </div>
            </div>
          )}

          {!showFinalizeForm && (
            <div className="flex gap-2">
              <button onClick={() => { setFinResultado('CONFORME'); setShowFinalizeForm(true); }}
                className="flex-1 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
                ✓ Todo Conforme
              </button>
              <button onClick={() => { setFinResultado('INFRACCION_DETECTADA'); setFinDerivar(true); setShowFinalizeForm(true); }}
                className="flex-1 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
                Infracción Detectada
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
