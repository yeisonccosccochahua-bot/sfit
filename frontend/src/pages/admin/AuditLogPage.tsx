import { useEffect, useState, useCallback } from 'react';
import { ClipboardList, Search, Download, Filter } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Spinner } from '../../components/ui/spinner';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { useAuthStore } from '../../stores/authStore';

interface AuditLog {
  id:         string;
  user_id:    string;
  user_name:  string;
  user_role:  string;
  action:     string;
  entity:     string;
  entity_id?: string;
  ip?:        string;
  metadata?:  Record<string, any>;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100  text-blue-800',
  DELETE: 'bg-red-100   text-red-800',
  LOGIN:  'bg-gray-100  text-gray-700',
  BLOCK:  'bg-amber-100 text-amber-800',
};

const ENTITY_OPTIONS = [
  'Trip', 'Driver', 'Vehicle', 'Route', 'User', 'Sanction', 'Report', 'Municipality',
];

export function AuditLogPage() {
  const { token } = useAuthStore();
  const [logs,     setLogs]    = useState<AuditLog[]>([]);
  const [loading,  setLoading] = useState(true);
  const [page,     setPage]    = useState(1);
  const [total,    setTotal]   = useState(0);

  // Filters
  const [search,     setSearch]    = useState('');
  const [actionF,    setActionF]   = useState('');
  const [entityF,    setEntityF]   = useState('');
  const [dateFrom,   setDateFrom]  = useState('');
  const [dateTo,     setDateTo]    = useState('');

  const PAGE = 20;

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(PAGE) });
    if (search)   p.set('search', search);
    if (actionF)  p.set('action', actionF);
    if (entityF)  p.set('entity', entityF);
    if (dateFrom) p.set('from', dateFrom);
    if (dateTo)   p.set('to', dateTo);

    fetch(`/api/audit?${p}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setLogs(d.data ?? []); setTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page, search, actionF, entityF, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    const p = new URLSearchParams({ limit: '10000', format: 'csv' });
    if (search)   p.set('search', search);
    if (actionF)  p.set('action', actionF);
    if (entityF)  p.set('entity', entityF);
    if (dateFrom) p.set('from', dateFrom);
    if (dateTo)   p.set('to', dateTo);

    fetch(`/api/audit/export?${p}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `sfit_audit_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const pages = Math.ceil(total / PAGE);

  const resetFilters = () => {
    setSearch(''); setActionF(''); setEntityF(''); setDateFrom(''); setDateTo(''); setPage(1);
  };

  const actionLabel = (action: string) => action.replace(/_/g, ' ');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-[#1B4F72]" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Registro de Auditoría</h2>
            <p className="text-sm text-gray-500">{total} entradas</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por usuario o ID…"
                className="pl-9"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={actionF} onChange={e => { setActionF(e.target.value); setPage(1); }} className="min-w-[140px]">
              <option value="">Todas las acciones</option>
              {['CREATE','UPDATE','DELETE','LOGIN','BLOCK'].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
            <Select value={entityF} onChange={e => { setEntityF(e.target.value); setPage(1); }} className="min-w-[140px]">
              <option value="">Todas las entidades</option>
              {ENTITY_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="min-w-[140px]"
              title="Desde"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="min-w-[140px]"
              title="Hasta"
            />
            {(search || actionF || entityF || dateFrom || dateTo) && (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                <Filter className="h-4 w-4 mr-1" /> Limpiar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Fecha y hora</Th>
                    <Th>Usuario</Th>
                    <Th>Rol</Th>
                    <Th>Acción</Th>
                    <Th>Entidad</Th>
                    <Th>ID Entidad</Th>
                    <Th>IP</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {logs.length === 0 ? (
                    <Tr><Td colSpan={7} className="py-12 text-center text-gray-400">Sin registros.</Td></Tr>
                  ) : logs.map(log => (
                    <Tr key={log.id}>
                      <Td className="text-gray-500 text-xs whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('es-PE', {
                          dateStyle: 'short', timeStyle: 'medium',
                        })}
                      </Td>
                      <Td>
                        <p className="font-medium text-gray-900 text-sm">{log.user_name}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[160px]">{log.user_id}</p>
                      </Td>
                      <Td>
                        <Badge className="bg-blue-50 text-blue-700 text-xs">{log.user_role}</Badge>
                      </Td>
                      <Td>
                        <Badge className={`text-xs ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700'}`}>
                          {actionLabel(log.action)}
                        </Badge>
                      </Td>
                      <Td className="text-gray-700 font-medium text-sm">{log.entity}</Td>
                      <Td className="text-gray-400 text-xs font-mono">{log.entity_id ? log.entity_id.slice(0, 8) + '…' : '—'}</Td>
                      <Td className="text-gray-400 text-xs">{log.ip ?? '—'}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>

              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                  <p className="text-sm text-gray-500">
                    {total} registros · página {page} de {pages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1}     onClick={() => setPage(p => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
