import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Clock, Bus, ChevronRight, Users, Play, CheckCircle2,
  XCircle, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { scheduledTripsApi, type ScheduledTrip } from '../../services/scheduledTripsApi';
import { STATUS_STYLES } from './ScheduledTripCard';
import { Button } from '../../components/ui/button';

interface Props {
  trip: ScheduledTrip;
  onClose: () => void;
  onUpdated: (t: ScheduledTrip) => void;
}

export function ScheduledTripDetailModal({ trip, onClose, onUpdated }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [cancelarSerie, setCancelarSerie] = useState(false);
  const [error, setError] = useState('');

  const style = STATUS_STYLES[trip.estado] ?? STATUS_STYLES.PROGRAMADO;
  const canAct = ['PROGRAMADO', 'CONFIRMADO'].includes(trip.estado);

  async function handleConfirm() {
    setLoading(true); setError('');
    try {
      const updated = await scheduledTripsApi.confirm(trip.id);
      onUpdated(updated as ScheduledTrip);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al confirmar');
    } finally { setLoading(false); }
  }

  async function handleStart() {
    setLoading(true); setError('');
    try {
      const res = await scheduledTripsApi.start(trip.id);
      const { scheduledTrip } = res as any;
      onUpdated(scheduledTrip);
      navigate(`/operator/trips`);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al iniciar viaje');
    } finally { setLoading(false); }
  }

  async function handleCancel() {
    if (!motivo.trim()) { setError('Ingrese el motivo de cancelación'); return; }
    setLoading(true); setError('');
    try {
      await scheduledTripsApi.cancel(trip.id, motivo, cancelarSerie);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Error al cancelar');
    } finally { setLoading(false); }
  }

  const roleLabel = { PRINCIPAL: 'Principal', SUPLENTE: 'Suplente', COPILOTO: 'Copiloto' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`p-5 rounded-t-2xl ${style.bg} border-b ${style.border}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold uppercase tracking-wide ${style.text}`}>{style.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="text-lg font-bold text-gray-900">{trip.hora_salida}</span>
                {trip.hora_llegada_estimada && (
                  <span className="text-sm text-gray-500">→ ~{trip.hora_llegada_estimada}</span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-0.5">
                {new Date(trip.fecha_programada + 'T12:00:00').toLocaleDateString('es-PE', {
                  weekday: 'long', day: '2-digit', month: 'long',
                })}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/10">
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Route */}
          {trip.route && (
            <div className="flex items-center gap-2 text-sm text-gray-800">
              <ChevronRight className="h-4 w-4 text-gray-400" />
              <span className="font-semibold">{trip.route.origin}</span>
              <ChevronRight className="h-3 w-3 text-gray-400" />
              <span className="font-semibold">{trip.route.destination}</span>
              <span className="text-xs text-gray-500 ml-auto">
                ~{Math.round((trip.route.estimated_duration_minutes ?? 0) / 60)}h
              </span>
            </div>
          )}

          {/* Vehicle */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <Bus className="h-4 w-4 text-gray-500" />
            <span className="font-mono font-bold text-gray-900">{trip.vehicle?.plate ?? '—'}</span>
            {trip.vehicle?.model && <span className="text-sm text-gray-500">{trip.vehicle.model}</span>}
          </div>

          {/* Drivers */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Conductores asignados
            </p>
            <div className="space-y-1.5">
              {trip.assigned_drivers.map((d, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                  <span className="text-gray-700 font-mono text-xs">{d.driver_id.slice(0, 8)}...</span>
                  <span className="text-xs font-medium text-gray-500">{roleLabel[d.role] ?? d.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {trip.notas && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              <span className="font-medium">Notas: </span>{trip.notas}
            </div>
          )}

          {/* Trip link if EN_CURSO or COMPLETADO */}
          {trip.trip_id && (
            <button
              onClick={() => navigate('/operator/trips')}
              className="w-full flex items-center justify-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 hover:bg-blue-100"
            >
              <ExternalLink className="h-4 w-4" /> Ver viaje en curso
            </button>
          )}

          {/* Cancellation reason */}
          {trip.motivo_cancelacion && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <span className="font-medium">Motivo cancelación: </span>{trip.motivo_cancelacion}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* Cancel form */}
          {cancelOpen && (
            <div className="space-y-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm font-medium text-red-800">Motivo de cancelación:</p>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={2}
                placeholder="Describe el motivo..."
                className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {trip.serie_id && (
                <label className="flex items-center gap-2 text-sm text-red-700">
                  <input type="checkbox" checked={cancelarSerie} onChange={e => setCancelarSerie(e.target.checked)} />
                  Cancelar todos los viajes de esta serie
                </label>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCancelOpen(false)} className="flex-1">
                  Volver
                </Button>
                <Button onClick={handleCancel} loading={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                  Confirmar cancelación
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          {canAct && !cancelOpen && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              {trip.estado === 'PROGRAMADO' && (
                <Button onClick={handleConfirm} loading={loading} className="w-full bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar viaje
                </Button>
              )}
              {trip.estado === 'CONFIRMADO' && (
                <Button onClick={handleStart} loading={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base py-3">
                  <Play className="h-5 w-5 mr-2" /> INICIAR VIAJE
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setCancelOpen(true)}
                className="w-full border-red-200 text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-2" /> Cancelar viaje
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
