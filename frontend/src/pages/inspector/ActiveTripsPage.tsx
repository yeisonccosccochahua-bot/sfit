import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, RefreshCw, AlertTriangle, User, ClipboardPlus } from 'lucide-react';
import { inspectorApi, type ActiveTrip } from '../../services/inspectorApi';
import { useInspectorSocket } from '../../hooks/useInspectorSocket';

const FATIGA_COLOR: Record<string, string> = {
  APTO:    'bg-green-100 text-green-800',
  RIESGO:  'bg-yellow-100 text-yellow-800',
  NO_APTO: 'bg-red-100 text-red-800',
  INACTIVO:'bg-gray-100 text-gray-600',
};

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function ActiveTripsPage() {
  const navigate = useNavigate();
  const [trips, setTrips]     = useState<ActiveTrip[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await inspectorApi.getActiveTrips();
      setTrips(data);
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useInspectorSocket({
    'trip:status_changed': () => load(),
    'fatigue:alert':       () => load(),
    'dashboard:update':    () => load(),
  });

  async function startInspection(trip: ActiveTrip) {
    try {
      const insp = await inspectorApi.createInspection({
        tipo: 'CONTROL_RUTA',
        ubicacion_descripcion: `Inspección de viaje: ${trip.ruta.origen} → ${trip.ruta.destino}`,
        vehicle_id: trip.vehiculo.id,
        trip_id: trip.id,
      });
      navigate(`/inspector/inspections/${insp.id}`);
    } catch {
      alert('Error al crear inspección');
    }
  }

  const riesgoCount   = trips.filter(t => t.tiene_conductor_riesgo && !t.tiene_conductor_bloqueado).length;
  const bloqueadoCount = trips.filter(t => t.tiene_conductor_bloqueado).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" /> Viajes Activos
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{trips.length} viaje{trips.length !== 1 ? 's' : ''} EN CURSO en tu municipalidad</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50">
          <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary badges */}
      {(riesgoCount + bloqueadoCount) > 0 && (
        <div className="flex gap-3 flex-wrap">
          {bloqueadoCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-800 rounded-lg text-sm font-medium">
              <AlertTriangle className="h-4 w-4" /> {bloqueadoCount} con conductor NO_APTO
            </div>
          )}
          {riesgoCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-medium">
              <AlertTriangle className="h-4 w-4" /> {riesgoCount} con conductor en RIESGO
            </div>
          )}
        </div>
      )}

      {loading && trips.length === 0 ? (
        <div className="flex justify-center py-16">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
        </div>
      ) : trips.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400">
          <Truck className="h-10 w-10 mx-auto mb-3 text-gray-300" />
          <p>No hay viajes activos en este momento</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map(trip => {
            const rowBg = trip.tiene_conductor_bloqueado
              ? 'border-red-200 bg-red-50'
              : trip.tiene_conductor_riesgo
              ? 'border-yellow-200 bg-yellow-50'
              : 'border-gray-200 bg-white';

            return (
              <div key={trip.id} className={`rounded-xl border ${rowBg} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {trip.vehiculo.foto_url
                      ? <img src={trip.vehiculo.foto_url} alt={trip.vehiculo.placa} className="w-14 h-12 rounded-lg object-cover border shrink-0" />
                      : <div className="w-14 h-12 rounded-lg bg-gray-100 flex items-center justify-center border shrink-0"><Truck className="h-6 w-6 text-gray-400" /></div>}
                    <div>
                      <p className="font-mono font-bold text-gray-900 text-base tracking-wide">{trip.vehiculo.placa}</p>
                      <p className="text-xs text-gray-500">{trip.vehiculo.empresa.nombre}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => startInspection(trip)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                    <ClipboardPlus className="h-3.5 w-3.5" /> Inspeccionar
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Ruta</p>
                    <p className="font-medium text-gray-800 text-xs">{trip.ruta.origen} → {trip.ruta.destino}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tiempo transcurrido</p>
                    <p className="font-medium text-gray-800 text-xs">{formatDuration(trip.minutos_transcurridos)}</p>
                  </div>
                </div>

                {trip.conductores.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200/60">
                    <p className="text-xs text-gray-500 mb-2">Conductores</p>
                    <div className="flex flex-wrap gap-2">
                      {trip.conductores.map(c => (
                        <div key={c.id} className="flex items-center gap-2 bg-white rounded-lg px-2 py-1 border border-gray-200">
                          {c.foto_url
                            ? <img src={c.foto_url} alt={c.nombre} className="w-6 h-6 rounded-full object-cover border shrink-0" />
                            : <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0"><User className="h-3.5 w-3.5 text-gray-400" /></div>}
                          <span className="text-xs text-gray-800">{c.nombre}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${FATIGA_COLOR[c.estado_fatiga] ?? 'bg-gray-100 text-gray-600'}`}>
                            {c.estado_fatiga}
                          </span>
                          {c.horas_conducidas > 0 && (
                            <span className="text-xs text-gray-400">{c.horas_conducidas.toFixed(1)}h</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
