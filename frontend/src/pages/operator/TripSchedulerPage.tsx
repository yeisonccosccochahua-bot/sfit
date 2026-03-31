import { useState, useEffect, useCallback } from 'react';
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, CalendarDays, List, LayoutGrid, Plus, RefreshCw,
} from 'lucide-react';
import { scheduledTripsApi, type ScheduledTrip } from '../../services/scheduledTripsApi';
import { WeeklyCalendar, DailyView, ListView } from './WeeklyCalendar';
import { ScheduleTripModal } from './ScheduleTripModal';
import { ScheduledTripDetailModal } from './ScheduledTripDetailModal';
import { Button } from '../../components/ui/button';

type ViewMode = 'week' | 'day' | 'list';

function dateKey(d: Date) { return format(d, 'yyyy-MM-dd'); }

export function TripSchedulerPage() {
  const [viewMode,    setViewMode]    = useState<ViewMode>('week');
  const [weekStart,   setWeekStart]   = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [schedule,    setSchedule]    = useState<Record<string, ScheduledTrip[]>>({});
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInitDate,  setCreateInitDate]  = useState<string | undefined>();
  const [createInitHour,  setCreateInitHour]  = useState<number | undefined>();
  const [detailTrip,      setDetailTrip]      = useState<ScheduledTrip | null>(null);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await scheduledTripsApi.getWeek(dateKey(weekStart), dateKey(weekEnd));
      setSchedule(res as Record<string, ScheduledTrip[]>);
    } catch {
      setError('Error al cargar el calendario');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  function prevWeek() { setWeekStart(w => subWeeks(w, 1)); }
  function nextWeek() { setWeekStart(w => addWeeks(w, 1)); }
  function goToday()  { setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })); setSelectedDay(new Date()); }

  function handleSlotClick(date: Date, hour: number) {
    setCreateInitDate(dateKey(date));
    setCreateInitHour(hour);
    setCreateModalOpen(true);
  }

  function handleTripClick(trip: ScheduledTrip) {
    setDetailTrip(trip);
  }

  function handleTripUpdated(updated: ScheduledTrip) {
    setSchedule(prev => {
      const key = updated.fecha_programada;
      const day = (prev[key] ?? []).map(t => t.id === updated.id ? updated : t);
      return { ...prev, [key]: day };
    });
    setDetailTrip(updated);
  }

  const dayTrips = schedule[dateKey(selectedDay)] ?? [];

  const totalWeek = Object.values(schedule).reduce((s, arr) => s + arr.length, 0);
  const confirmed  = Object.values(schedule).flat().filter(t => t.estado === 'CONFIRMADO').length;
  const programmed = Object.values(schedule).flat().filter(t => t.estado === 'PROGRAMADO').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            Programación de Viajes
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(weekStart, "d 'de' MMM", { locale: es })} — {format(weekEnd, "d 'de' MMM yyyy", { locale: es })}
            {' '}· {totalWeek} programado{totalWeek !== 1 ? 's' : ''}
            {programmed > 0 && ` · ${programmed} sin confirmar`}
          </p>
        </div>
        <Button onClick={() => { setCreateInitDate(undefined); setCreateInitHour(undefined); setCreateModalOpen(true); }}
          className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Programar Viaje
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Week navigation */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          <button onClick={prevWeek} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={goToday}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md">
            Hoy
          </button>
          <button onClick={nextWeek} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* View mode */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {([
            { mode: 'week' as ViewMode, Icon: LayoutGrid, label: 'Semana' },
            { mode: 'day'  as ViewMode, Icon: CalendarDays, label: 'Día' },
            { mode: 'list' as ViewMode, Icon: List, label: 'Lista' },
          ]).map(({ mode, Icon, label }) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === mode ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button onClick={load} disabled={loading}
          className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {/* Stats */}
        {confirmed > 0 && (
          <span className="ml-auto text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-lg font-medium">
            {confirmed} confirmado{confirmed !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* Day selector for day view */}
      {viewMode === 'day' && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
            const key = dateKey(d);
            const count = (schedule[key] ?? []).length;
            const isSelected = dateKey(d) === dateKey(selectedDay);
            return (
              <button key={key} onClick={() => setSelectedDay(d)}
                className={`shrink-0 rounded-xl border-2 px-3 py-2 text-center transition-colors ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-200 bg-white'
                }`}
              >
                <p className={`text-xs font-medium capitalize ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                  {format(d, 'EEE', { locale: es })}
                </p>
                <p className={`text-lg font-bold ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                  {format(d, 'd')}
                </p>
                {count > 0 && (
                  <span className={`text-xs font-medium ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                    {count} viaje{count !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Calendar views */}
      {viewMode === 'week' && (
        <WeeklyCalendar
          weekStart={weekStart}
          schedule={schedule}
          onSlotClick={handleSlotClick}
          onTripClick={handleTripClick}
        />
      )}

      {viewMode === 'day' && (
        <DailyView
          date={selectedDay}
          trips={dayTrips}
          onSlotClick={handleSlotClick}
          onTripClick={handleTripClick}
        />
      )}

      {viewMode === 'list' && (
        <ListView
          schedule={schedule}
          weekStart={weekStart}
          onTripClick={handleTripClick}
        />
      )}

      {/* Empty state */}
      {!loading && totalWeek === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <CalendarDays className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="font-semibold text-gray-700">Sin viajes programados esta semana</p>
          <p className="text-sm text-gray-400 mt-1">Haz clic en cualquier celda del calendario o en "Programar Viaje"</p>
          <Button onClick={() => setCreateModalOpen(true)} className="mt-4">
            <Plus className="h-4 w-4 mr-2" /> Programar primer viaje
          </Button>
        </div>
      )}

      {/* Modals */}
      {createModalOpen && (
        <ScheduleTripModal
          initialDate={createInitDate}
          initialHour={createInitHour}
          onClose={() => setCreateModalOpen(false)}
          onCreated={() => { setCreateModalOpen(false); load(); }}
        />
      )}

      {detailTrip && (
        <ScheduledTripDetailModal
          trip={detailTrip}
          onClose={() => setDetailTrip(null)}
          onUpdated={handleTripUpdated}
        />
      )}
    </div>
  );
}
