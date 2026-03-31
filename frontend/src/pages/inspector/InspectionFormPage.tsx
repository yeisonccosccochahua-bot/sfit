import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, MapPin, ClipboardPlus, CheckCircle, RefreshCw,
} from 'lucide-react';
import { inspectorApi } from '../../services/inspectorApi';

const TIPO_OPTIONS = [
  { value: 'VERIFICACION_QR',        label: 'Verificación QR' },
  { value: 'VERIFICACION_CONDUCTOR', label: 'Verificación de Conductor' },
  { value: 'INSPECCION_VEHICULO',    label: 'Inspección de Vehículo' },
  { value: 'CONTROL_RUTA',           label: 'Control de Ruta' },
  { value: 'FISCALIZACION_GENERAL',  label: 'Fiscalización General' },
];

export function InspectionFormPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const [tipo, setTipo]           = useState('FISCALIZACION_GENERAL');
  const [ubicacion, setUbicacion] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [driverDni, setDriverDni]       = useState('');
  const [latitud, setLatitud]   = useState('');
  const [longitud, setLongitud] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);

  // Resolved IDs
  const [vehicleId, setVehicleId] = useState<string | undefined>();
  const [driverId, setDriverId]   = useState<string | undefined>();
  const [vehicleErr, setVehicleErr] = useState('');
  const [driverErr, setDriverErr]   = useState('');

  async function resolveVehicle() {
    if (!vehiclePlate.trim()) return;
    setVehicleErr('');
    try {
      const v = await inspectorApi.lookupVehicle(vehiclePlate.trim().toUpperCase());
      setVehicleId(v.id);
    } catch {
      setVehicleErr('Vehículo no encontrado en tu municipalidad');
      setVehicleId(undefined);
    }
  }

  async function resolveDriver() {
    if (!driverDni.trim()) return;
    setDriverErr('');
    try {
      const d = await inspectorApi.lookupDriver(driverDni.trim());
      setDriverId(d.id);
    } catch {
      setDriverErr('Conductor no encontrado en tu municipalidad');
      setDriverId(undefined);
    }
  }

  function useGeo() {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLatitud(String(pos.coords.latitude));
        setLongitud(String(pos.coords.longitude));
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ubicacion.trim()) { setError('La ubicación es requerida'); return; }
    setSaving(true);
    setError('');
    try {
      const insp = await inspectorApi.createInspection({
        tipo,
        ubicacion_descripcion: ubicacion,
        vehicle_id: vehicleId,
        driver_id: driverId,
        latitud: latitud ? parseFloat(latitud) : undefined,
        longitud: longitud ? parseFloat(longitud) : undefined,
      });
      navigate(`/inspector/inspections/${insp.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Error al crear inspección');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (hasErr = false) =>
    `w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 ${hasErr ? 'border-red-400 bg-red-50' : 'border-gray-300'}`;

  return (
    <div className="max-w-xl mx-auto space-y-5 p-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardPlus className="h-5 w-5 text-blue-600" /> Nueva Inspección
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Tipo */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Tipo de Inspección</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TIPO_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => setTipo(opt.value)}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors text-left ${
                  tipo === opt.value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ubicación */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Ubicación
          </h2>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Descripción de la ubicación *</label>
            <input
              value={ubicacion} onChange={e => setUbicacion(e.target.value)}
              placeholder="Ej: Terminal Terrestre Tambobamba, Km 45 ruta Arequipa"
              className={inputCls(!ubicacion && !!error)}
            />
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Latitud</label>
              <input value={latitud} onChange={e => setLatitud(e.target.value)} placeholder="-13.123456"
                className={inputCls()} />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 mb-1 block">Longitud</label>
              <input value={longitud} onChange={e => setLongitud(e.target.value)} placeholder="-72.654321"
                className={inputCls()} />
            </div>
            <button type="button" onClick={useGeo} disabled={geoLoading}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
              {geoLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              GPS
            </button>
          </div>
        </div>

        {/* Vehículo */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Vehículo (opcional)</h2>
          <div className="flex gap-2">
            <input value={vehiclePlate} onChange={e => { setVehiclePlate(e.target.value.toUpperCase()); setVehicleId(undefined); }}
              placeholder="Placa: ABC-123"
              className={`flex-1 ${inputCls(!!vehicleErr)}`} />
            <button type="button" onClick={resolveVehicle}
              className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200 border border-gray-300">
              Verificar
            </button>
          </div>
          {vehicleErr && <p className="text-xs text-red-600">{vehicleErr}</p>}
          {vehicleId && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Vehículo encontrado</p>}
        </div>

        {/* Conductor */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Conductor (opcional)</h2>
          <div className="flex gap-2">
            <input value={driverDni} onChange={e => { setDriverDni(e.target.value); setDriverId(undefined); }}
              placeholder="DNI del conductor"
              className={`flex-1 ${inputCls(!!driverErr)}`} />
            <button type="button" onClick={resolveDriver}
              className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700 hover:bg-gray-200 border border-gray-300">
              Verificar
            </button>
          </div>
          {driverErr && <p className="text-xs text-red-600">{driverErr}</p>}
          {driverId && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> Conductor encontrado</p>}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)}
            className="flex-1 py-3 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {saving ? 'Creando…' : 'Crear Inspección'}
          </button>
        </div>
      </form>
    </div>
  );
}
