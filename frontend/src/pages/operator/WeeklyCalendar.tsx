import { useMemo } from 'react';
import { addDays, format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ScheduledTrip } from '../../services/scheduledTripsApi';
import { ScheduledTripCard } from './ScheduledTripCard';

const HOURS = Array.from({ length: 19 }, (_, i) => i + 5); // 05:00 to 23:00

interface Props {
  weekStart: Date;
  schedule: Record<string, ScheduledTrip[]>; // keyed by 'YYYY-MM-DD'
  onSlotClick: (date: Date, hour: number) => void;
  onTripClick: (trip: ScheduledTrip) => void;
}

function dateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function WeeklyCalendar({ weekStart, schedule, onSlotClick, onTripClick }: Props) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      {/* Day headers */}
      <div className="grid grid-cols-[64px_repeat(7,minmax(110px,1fr))] border-b border-gray-200 sticky top-0 bg-white z-10">
        <div className="px-2 py-3 text-xs text-gray-400 text-center">Hora</div>
        {days.map((d) => {
          const today = isToday(d);
          return (
            <div
              key={dateKey(d)}
              className={`px-2 py-3 text-center border-l border-gray-100 ${today ? 'bg-blue-50' : ''}`}
            >
              <p className={`text-xs font-medium uppercase ${today ? 'text-blue-600' : 'text-gray-500'}`}>
                {format(d, 'EEE', { locale: es })}
              </p>
              <p className={`text-lg font-bold leading-none mt-0.5 ${today ? 'text-blue-700' : 'text-gray-900'}`}>
                {format(d, 'd')}
              </p>
              <p className="text-xs text-gray-400">{format(d, 'MMM', { locale: es })}</p>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="relative">
        {HOURS.map((hour) => (
          <div key={hour} className="grid grid-cols-[64px_repeat(7,minmax(110px,1fr))] border-b border-gray-100">
            {/* Hour label */}
            <div className="px-2 py-2 text-xs text-gray-400 text-right pt-1 font-mono">
              {String(hour).padStart(2, '0')}:00
            </div>

            {/* Day cells */}
            {days.map((d) => {
              const key = dateKey(d);
              const tripsThisHour = (schedule[key] ?? []).filter((t) => {
                const th = parseInt(t.hora_salida.split(':')[0]);
                return th === hour;
              });
              const today = isToday(d);

              return (
                <div
                  key={key}
                  className={`border-l border-gray-100 min-h-[56px] p-1 cursor-pointer transition-colors ${
                    today ? 'bg-blue-50/40' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => { if (tripsThisHour.length === 0) onSlotClick(d, hour); }}
                >
                  {tripsThisHour.map((t) => (
                    <div key={t.id} onClick={(e) => { e.stopPropagation(); onTripClick(t); }}>
                      <ScheduledTripCard trip={t} onClick={() => onTripClick(t)} compact />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Daily view ───────────────────────────────────────────────────────────────

interface DailyViewProps {
  date: Date;
  trips: ScheduledTrip[];
  onSlotClick: (date: Date, hour: number) => void;
  onTripClick: (trip: ScheduledTrip) => void;
}

export function DailyView({ date, trips, onSlotClick, onTripClick }: DailyViewProps) {
  const sortedTrips = [...trips].sort((a, b) => a.hora_salida.localeCompare(b.hora_salida));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={`p-4 border-b border-gray-200 ${isToday(date) ? 'bg-blue-50' : ''}`}>
        <p className="font-bold text-gray-900 capitalize">
          {format(date, "EEEE, d 'de' MMMM yyyy", { locale: es })}
        </p>
        <p className="text-sm text-gray-500">{trips.length} viaje(s) programado(s)</p>
      </div>

      {HOURS.map((hour) => {
        const hourTrips = sortedTrips.filter(t => parseInt(t.hora_salida.split(':')[0]) === hour);
        return (
          <div key={hour} className="flex border-b border-gray-100 min-h-[64px]">
            <div className="w-16 px-3 py-3 text-xs text-gray-400 font-mono shrink-0 border-r border-gray-100">
              {String(hour).padStart(2, '0')}:00
            </div>
            <div
              className="flex-1 p-2 space-y-2 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => { if (!hourTrips.length) onSlotClick(date, hour); }}
            >
              {hourTrips.map(t => (
                <div key={t.id} onClick={e => { e.stopPropagation(); onTripClick(t); }}>
                  <ScheduledTripCard trip={t} onClick={() => onTripClick(t)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

interface ListViewProps {
  schedule: Record<string, ScheduledTrip[]>;
  weekStart: Date;
  onTripClick: (trip: ScheduledTrip) => void;
}

export function ListView({ schedule, weekStart, onTripClick }: ListViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-4">
      {days.map(d => {
        const key = dateKey(d);
        const trips = [...(schedule[key] ?? [])].sort((a, b) => a.hora_salida.localeCompare(b.hora_salida));
        if (trips.length === 0) return null;
        return (
          <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className={`px-4 py-3 border-b border-gray-200 ${isToday(d) ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <p className="font-semibold text-gray-800 capitalize">
                {format(d, "EEEE d 'de' MMMM", { locale: es })}
              </p>
              <p className="text-xs text-gray-500">{trips.length} viaje(s)</p>
            </div>
            <div className="divide-y divide-gray-100">
              {trips.map(t => (
                <div key={t.id} className="px-4 py-2">
                  <ScheduledTripCard trip={t} onClick={() => onTripClick(t)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
