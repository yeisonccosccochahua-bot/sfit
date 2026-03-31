import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Activity } from 'lucide-react';
import api from '../../services/api';
import {
  Driver, DriverStatus, FatigueResult, PaginatedResponse, FatigueEvaluation,
} from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Spinner } from '../../components/ui/spinner';
import { Alert } from '../../components/ui/alert';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table';
import { Modal, ModalBody } from '../../components/ui/modal';

const STATUS_CONFIG: Record<
  DriverStatus,
  { label: string; Icon: React.FC<{ className?: string }>; variant: 'success' | 'warning' | 'destructive' }
> = {
  [DriverStatus.APTO]:    { label: 'Apto',    Icon: CheckCircle2,  variant: 'success' },
  [DriverStatus.RIESGO]:  { label: 'Riesgo',  Icon: AlertTriangle, variant: 'warning' },
  [DriverStatus.NO_APTO]: { label: 'No apto', Icon: XCircle,       variant: 'destructive' },
};

export function DriversListPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Fatigue history modal
  const [historyDriver, setHistoryDriver]   = useState<Driver | null>(null);
  const [history, setHistory]               = useState<FatigueEvaluation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const limit = 15;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filterStatus) params.set('status', filterStatus);
      const r = await api.get<PaginatedResponse<Driver>>(`/api/drivers?${params}`);
      setDrivers(r.data);
      setTotal(r.total);
    } catch {
      setError('No se pudieron cargar los conductores.');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const openHistory = async (driver: Driver) => {
    setHistoryDriver(driver);
    setHistory([]);
    setLoadingHistory(true);
    try {
      const r = await api.get<any>(`/api/fatigue/history/${driver.id}`);
      setHistory(Array.isArray(r) ? r : (r.data ?? []));
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const fatigueResultVariant = (result: FatigueResult): 'success' | 'warning' | 'destructive' =>
    result === FatigueResult.APTO   ? 'success'
    : result === FatigueResult.RIESGO ? 'warning'
    : 'destructive';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Conductores</h2>
        <p className="text-sm text-gray-500">{total} conductor(es) en total</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-4 pb-4">
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-[#2E86C1] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button
            onClick={() => { setFilterStatus(''); setPage(1); }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Limpiar
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lista de conductores</CardTitle></CardHeader>
        <CardContent className="p-0 pb-1">
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : drivers.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">No hay conductores con los filtros seleccionados.</p>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Nombre</Th>
                  <Th>DNI</Th>
                  <Th>Estado fatiga</Th>
                  <Th>Horas (24h)</Th>
                  <Th>Reputación</Th>
                  <Th>Acciones</Th>
                </Tr>
              </Thead>
              <Tbody>
                {drivers.map((d) => {
                  const cfg = STATUS_CONFIG[d.status];
                  return (
                    <Tr key={d.id}>
                      <Td className="font-medium">{d.name}</Td>
                      <Td className="text-gray-500">{d.dni}</Td>
                      <Td>
                        <Badge variant={cfg.variant} className="flex w-fit items-center gap-1">
                          <cfg.Icon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </Td>
                      <Td>
                        <span className={[
                          'font-mono text-sm font-semibold',
                          Number(d.total_hours_driven_24h ?? 0) >= 8 ? 'text-red-600'
                          : Number(d.total_hours_driven_24h ?? 0) >= 6 ? 'text-amber-600'
                          : 'text-green-600',
                        ].join(' ')}>
                          {Number(d.total_hours_driven_24h ?? 0).toFixed(1)}h
                        </span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-16 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#2E86C1]"
                              style={{ width: `${Math.min(100, Number(d.reputation_score))}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{Number(d.reputation_score)}</span>
                        </div>
                      </Td>
                      <Td>
                        <button
                          onClick={() => openHistory(d)}
                          className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          <Activity className="h-3 w-3" /> Historial
                        </button>
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
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Fatigue history modal */}
      <Modal
        open={!!historyDriver}
        onClose={() => setHistoryDriver(null)}
        title={`Historial de fatiga — ${historyDriver?.name ?? ''}`}
        size="lg"
      >
        <ModalBody>
          {loadingHistory ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sin registros de fatiga.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
                  <div>
                    <p className="text-sm text-gray-700">
                      {Number(h.hours_driven_24h).toFixed(1)}h conducidas · {Number(h.last_rest_hours).toFixed(1)}h descanso
                    </p>
                  </div>
                  <Badge variant={fatigueResultVariant(h.result)}>{h.result}</Badge>
                </div>
              ))}
            </div>
          )}
        </ModalBody>
      </Modal>
    </div>
  );
}
