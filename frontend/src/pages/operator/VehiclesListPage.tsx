import { useCallback, useEffect, useState } from 'react';
import { QrCode, Download, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { Vehicle, PaginatedResponse } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Spinner } from '../../components/ui/spinner';
import { Alert } from '../../components/ui/alert';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table';
import { Modal, ModalBody, ModalFooter } from '../../components/ui/modal';
import { Button } from '../../components/ui/button';

interface QrData { qr_svg: string; qr_data_url: string; qr_url: string; plate: string }

const statusVariant = (s: string): 'success' | 'destructive' | 'warning' | 'muted' =>
  s === 'ACTIVO' ? 'success' : s === 'SUSPENDIDO' ? 'destructive' : 'warning';

export function VehiclesListPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // QR modal
  const [qrVehicle, setQrVehicle]       = useState<Vehicle | null>(null);
  const [qrData, setQrData]             = useState<QrData | null>(null);
  const [loadingQr, setLoadingQr]       = useState(false);
  const [qrError, setQrError]           = useState('');

  const limit = 15;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filterStatus) params.set('status', filterStatus);
      const r = await api.get<PaginatedResponse<Vehicle>>(`/api/vehicles?${params}`);
      setVehicles(r.data);
      setTotal(r.total);
    } catch {
      setError('No se pudieron cargar los vehículos.');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const openQr = async (vehicle: Vehicle) => {
    setQrVehicle(vehicle);
    setQrData(null);
    setQrError('');
    setLoadingQr(true);
    try {
      const data = await api.get<QrData>(`/api/qr/generate/${vehicle.id}`);
      setQrData(data);
    } catch {
      setQrError('No se pudo generar el QR.');
    } finally {
      setLoadingQr(false);
    }
  };

  const downloadQr = () => {
    if (!qrData) return;
    const link = document.createElement('a');
    link.href = qrData.qr_data_url;
    link.download = `QR_${qrVehicle?.plate ?? 'vehiculo'}.png`;
    link.click();
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Vehículos</h2>
        <p className="text-sm text-gray-500">{total} vehículo(s) en total</p>
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
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
            <option value="SUSPENDIDO">Suspendido</option>
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
        <CardHeader><CardTitle>Lista de vehículos</CardTitle></CardHeader>
        <CardContent className="p-0 pb-1">
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : vehicles.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">No hay vehículos con los filtros seleccionados.</p>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Placa</Th>
                  <Th>Estado</Th>
                  <Th>Reputación</Th>
                  <Th>QR</Th>
                  <Th>Acciones</Th>
                </Tr>
              </Thead>
              <Tbody>
                {vehicles.map((v) => (
                  <Tr key={v.id}>
                    <Td className="font-bold tracking-wider text-gray-900">{v.plate}</Td>
                    <Td>
                      <Badge variant={statusVariant(v.status)}>{v.status}</Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-16 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#2E86C1]"
                            style={{ width: `${Math.min(100, Number(v.reputation_score ?? 0))}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{Number(v.reputation_score ?? 0)}</span>
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono text-xs text-gray-400 truncate max-w-[80px] block" title={v.qr_code ?? ''}>
                        {v.qr_code ? v.qr_code.slice(0, 8) + '…' : '—'}
                      </span>
                    </Td>
                    <Td>
                      <button
                        onClick={() => openQr(v)}
                        className="flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                      >
                        <QrCode className="h-3 w-3" /> Ver QR
                      </button>
                    </Td>
                  </Tr>
                ))}
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

      {/* QR Modal */}
      <Modal
        open={!!qrVehicle}
        onClose={() => { setQrVehicle(null); setQrData(null); }}
        title={`QR del vehículo — ${qrVehicle?.plate ?? ''}`}
        size="sm"
      >
        <ModalBody className="flex flex-col items-center gap-4">
          {loadingQr && <Spinner />}
          {qrError && <Alert variant="error">{qrError}</Alert>}
          {qrData && (
            <>
              <div
                className="rounded-lg border border-gray-200 p-3 bg-white shadow-inner"
                dangerouslySetInnerHTML={{ __html: qrData.qr_svg }}
              />
              <p className="text-xs text-gray-500 font-mono">{qrData.qr_url}</p>
            </>
          )}
        </ModalBody>
        {qrData && (
          <ModalFooter>
            <Button variant="outline" onClick={() => { setQrVehicle(null); setQrData(null); }}>
              Cerrar
            </Button>
            <Button onClick={downloadQr} className="flex items-center gap-2">
              <Download className="h-4 w-4" /> Descargar PNG
            </Button>
          </ModalFooter>
        )}
      </Modal>
    </div>
  );
}
