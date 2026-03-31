import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Play, Square, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { Trip, TripStatus, PaginatedResponse } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Spinner } from '../../components/ui/spinner';
import { Alert } from '../../components/ui/alert';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table';
import { Modal, ModalBody, ModalFooter } from '../../components/ui/modal';
import { formatDate } from '../../lib/utils';

const STATUS_STYLES: Record<TripStatus, { label: string; variant: 'success' | 'warning' | 'muted' | 'destructive' | 'default' }> = {
  [TripStatus.EN_CURSO]:    { label: 'En curso',     variant: 'success' },
  [TripStatus.REGISTRADO]:  { label: 'Registrado',   variant: 'default' },
  [TripStatus.FINALIZADO]:  { label: 'Finalizado',   variant: 'muted' },
  [TripStatus.CANCELADO]:   { label: 'Cancelado',    variant: 'destructive' },
  [TripStatus.CERRADO_AUTO]:{ label: 'Cierre auto.', variant: 'warning' },
};

export function TripsListPage() {
  const [trips, setTrips]       = useState<Trip[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo]     = useState('');

  // Action modal
  const [actionTrip, setActionTrip] = useState<Trip | null>(null);
  const [actionType, setActionType] = useState<'start' | 'end' | null>(null);
  const [actioning, setActioning]   = useState(false);
  const [actionError, setActionError] = useState('');

  const limit = 15;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filterStatus)   params.set('status',    filterStatus);
      if (filterDateFrom) params.set('date_from', filterDateFrom);
      if (filterDateTo)   params.set('date_to',   filterDateTo);
      const r = await api.get<PaginatedResponse<Trip>>(`/api/trips?${params}`);
      setTrips(r.data);
      setTotal(r.total);
    } catch {
      setError('No se pudieron cargar los viajes.');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterDateFrom, filterDateTo]);

  useEffect(() => { load(); }, [load]);

  const doAction = async () => {
    if (!actionTrip || !actionType) return;
    setActioning(true);
    setActionError('');
    try {
      await api.patch(`/api/trips/${actionTrip.id}/${actionType === 'start' ? 'start' : 'end'}`);
      setActionTrip(null);
      setActionType(null);
      load();
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Error al actualizar el viaje.');
    } finally {
      setActioning(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Viajes</h2>
          <p className="text-sm text-gray-500">{total} viaje(s) en total</p>
        </div>
        <Link to="/operator/trips/new">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Registrar viaje
          </Button>
        </Link>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3">
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-[#2E86C1] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_STYLES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-[#2E86C1] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
            />
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-[#2E86C1] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
            />
            <button
              onClick={() => { setFilterStatus(''); setFilterDateFrom(''); setFilterDateTo(''); setPage(1); }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Limpiar
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader><CardTitle>Lista de viajes</CardTitle></CardHeader>
        <CardContent className="p-0 pb-1">
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : trips.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">No hay viajes con los filtros seleccionados.</p>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Vehículo</Th>
                  <Th>Ruta</Th>
                  <Th>Inicio</Th>
                  <Th>Estado</Th>
                  <Th>Acciones</Th>
                </Tr>
              </Thead>
              <Tbody>
                {trips.map((t) => {
                  const s = STATUS_STYLES[t.status];
                  return (
                    <Tr key={t.id}>
                      <Td className="font-medium">{t.vehicle?.plate ?? '—'}</Td>
                      <Td className="text-gray-600 max-w-[200px] truncate">
                        {t.route ? `${t.route.origin} → ${t.route.destination}` : '—'}
                      </Td>
                      <Td className="text-gray-500 whitespace-nowrap">{formatDate(t.start_time)}</Td>
                      <Td><Badge variant={s.variant}>{s.label}</Badge></Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          {t.status === TripStatus.REGISTRADO && (
                            <button
                              onClick={() => { setActionTrip(t); setActionType('start'); setActionError(''); }}
                              className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                            >
                              <Play className="h-3 w-3" /> Iniciar
                            </button>
                          )}
                          {t.status === TripStatus.EN_CURSO && (
                            <button
                              onClick={() => { setActionTrip(t); setActionType('end'); setActionError(''); }}
                              className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                            >
                              <Square className="h-3 w-3" /> Finalizar
                            </button>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </Button>
        </div>
      )}

      {/* Action confirmation modal */}
      <Modal
        open={!!actionTrip}
        onClose={() => { setActionTrip(null); setActionType(null); setActionError(''); }}
        title={actionType === 'start' ? 'Iniciar viaje' : 'Finalizar viaje'}
        size="sm"
      >
        <ModalBody>
          <p className="text-sm text-gray-700">
            ¿Confirma que desea{' '}
            <strong>{actionType === 'start' ? 'iniciar' : 'finalizar'}</strong> el viaje del vehículo{' '}
            <strong>{actionTrip?.vehicle?.plate}</strong>?
          </p>
          {actionError && <Alert variant="error" className="mt-3">{actionError}</Alert>}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => { setActionTrip(null); setActionType(null); setActionError(''); }}>
            Cancelar
          </Button>
          <Button
            onClick={doAction}
            loading={actioning}
            variant={actionType === 'end' ? 'secondary' : 'default'}
          >
            {actionType === 'start' ? 'Iniciar' : 'Finalizar'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
