import { Clock, Bus, ChevronRight } from 'lucide-react';
import type { ScheduledTrip } from '../../services/scheduledTripsApi';

export const STATUS_STYLES: Record<string, { label: string; bg: string; border: string; text: string }> = {
  PROGRAMADO:   { label: 'Programado',    bg: 'bg-blue-50',   border: 'border-blue-300',   text: 'text-blue-800' },
  CONFIRMADO:   { label: 'Confirmado',    bg: 'bg-green-50',  border: 'border-green-400',  text: 'text-green-800' },
  EN_CURSO:     { label: 'En Curso',      bg: 'bg-amber-50',  border: 'border-amber-400',  text: 'text-amber-800' },
  COMPLETADO:   { label: 'Completado',    bg: 'bg-gray-50',   border: 'border-gray-300',   text: 'text-gray-600' },
  CANCELADO:    { label: 'Cancelado',     bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700' },
  NO_REALIZADO: { label: 'No Realizado',  bg: 'bg-gray-100',  border: 'border-gray-400',   text: 'text-gray-700' },
};

interface Props {
  trip: ScheduledTrip;
  onClick: () => void;
  compact?: boolean;
}

export function ScheduledTripCard({ trip, onClick, compact = false }: Props) {
  const style = STATUS_STYLES[trip.estado] ?? STATUS_STYLES.PROGRAMADO;

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left rounded-lg border-l-4 px-2 py-1.5 text-xs ${style.bg} ${style.border} hover:opacity-80 transition-opacity`}
      >
        <div className={`font-bold ${style.text}`}>{trip.hora_salida}</div>
        <div className="text-gray-700 truncate">
          {trip.vehicle?.plate ?? '—'} · {trip.route?.origin} → {trip.route?.destination}
        </div>
        <div className={`text-xs font-medium ${style.text}`}>{style.label}</div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-3 transition-all hover:shadow-md ${style.bg} ${style.border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-gray-500 shrink-0" />
            <span className="font-bold text-gray-900 text-sm">{trip.hora_salida}</span>
            {trip.hora_llegada_estimada && (
              <span className="text-xs text-gray-500">→ {trip.hora_llegada_estimada}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Bus className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="font-mono font-bold text-gray-800 text-xs">{trip.vehicle?.plate ?? '—'}</span>
          </div>
          {trip.route && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
              <span>{trip.route.origin}</span>
              <ChevronRight className="h-3 w-3" />
              <span>{trip.route.destination}</span>
            </div>
          )}
          <div className="mt-1 text-xs text-gray-500">
            {trip.assigned_drivers.length} conductor{trip.assigned_drivers.length !== 1 ? 'es' : ''}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text} border ${style.border}`}>
          {style.label}
        </span>
      </div>
      {trip.estado === 'EN_CURSO' && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs text-amber-700 font-medium">Viaje en progreso</span>
        </div>
      )}
    </button>
  );
}
