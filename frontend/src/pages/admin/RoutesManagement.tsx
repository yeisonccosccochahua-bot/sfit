import { useEffect, useState, useCallback } from 'react';
import { MapPin, Plus, Pencil, Trash2, Search, ArrowLeftRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Modal, ModalBody, ModalFooter } from '../../components/ui/modal';
import { Spinner } from '../../components/ui/spinner';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/table';
import { Select } from '../../components/ui/select';
import { useAuthStore } from '../../stores/authStore';
import type { Route } from '../../types';

const routeSchema = z.object({
  origin:                       z.string().min(3, 'Requerido'),
  destination:                  z.string().min(3, 'Requerido'),
  estimated_duration_minutes:   z.coerce.number().min(1),
  type:                         z.enum(['PREDEFINIDA', 'ESPECIAL']),
  min_drivers:                  z.coerce.number().min(1).max(2),
  allows_roundtrip:             z.boolean(),
  rest_between_legs_hours:      z.coerce.number().min(0).max(24).optional(),
  status:                       z.enum(['ACTIVA', 'INACTIVA']).optional(),
});
type RouteForm = z.infer<typeof routeSchema>;

export function RoutesManagement() {
  const { token } = useAuthStore();
  const [routes,   setRoutes]  = useState<Route[]>([]);
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState('');
  const [page,     setPage]    = useState(1);
  const [total,    setTotal]   = useState(0);
  const [modal,    setModal]   = useState<{ mode: 'create' | 'edit'; route?: Route } | null>(null);
  const [delRoute, setDelRoute]= useState<Route | null>(null);
  const [saving,   setSaving]  = useState(false);
  const [toast,    setToast]   = useState<{ ok: boolean; msg: string } | null>(null);
  const PAGE = 15;

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg }); setTimeout(() => setToast(null), 3500);
  };

  const headers = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(PAGE) });
    if (search) p.set('search', search);
    fetch(`/api/routes?${p}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setRoutes(d.data ?? d.items ?? []); setTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page, search]);

  useEffect(() => { load(); }, [load]);

  const form = useForm<RouteForm>({
    resolver: zodResolver(routeSchema),
    defaultValues: { min_drivers: 1, allows_roundtrip: false, type: 'PREDEFINIDA' as const, status: 'ACTIVA' as const },
  });

  const openCreate = () => {
    form.reset({ min_drivers: 1, allows_roundtrip: false, type: 'PREDEFINIDA', status: 'ACTIVA' });
    setModal({ mode: 'create' });
  };

  const openEdit = (r: Route) => {
    form.reset({
      origin:                     r.origin,
      destination:                r.destination,
      estimated_duration_minutes: r.estimated_duration_minutes,
      type:                       (r.type as 'PREDEFINIDA' | 'ESPECIAL'),
      min_drivers:                r.min_drivers,
      allows_roundtrip:           r.allows_roundtrip,
      rest_between_legs_hours:    r.rest_between_legs_hours,
      status:                     (r.status as 'ACTIVA' | 'INACTIVA'),
    });
    setModal({ mode: 'edit', route: r });
  };

  const onSubmit = form.handleSubmit(async (data) => {
    setSaving(true);
    try {
      const url    = modal?.mode === 'edit' ? `/api/routes/${modal.route!.id}` : '/api/routes';
      const method = modal?.mode === 'edit' ? 'PATCH' : 'POST';
      // CreateRouteDto has no `status` field; forbidNonWhitelisted=true → strip it on create
      const body = modal?.mode === 'create'
        ? (({ status: _s, ...rest }) => rest)(data)
        : data;
      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Error');
      showToast(true, modal?.mode === 'edit' ? 'Ruta actualizada.' : 'Ruta creada.');
      setModal(null);
      load();
    } catch (e: any) {
      showToast(false, e.message);
    } finally {
      setSaving(false);
    }
  });

  const confirmDelete = async () => {
    if (!delRoute) return;
    try {
      const res = await fetch(`/api/routes/${delRoute.id}`, { method: 'DELETE', headers: headers() });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Error');
      showToast(true, 'Ruta eliminada.');
      setDelRoute(null);
      load();
    } catch (e: any) {
      showToast(false, e.message);
      setDelRoute(null);
    }
  };

  const pages = Math.ceil(total / PAGE);
  const watchRoundtrip = form.watch('allows_roundtrip');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6 text-[#1B4F72]" />
          <h2 className="text-xl font-bold text-gray-900">Gestión de Rutas</h2>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Nueva ruta
        </Button>
      </div>

      {toast && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${
          toast.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
        }`}>{toast.msg}</div>
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-5">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por origen o destino…"
              className="pl-9"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
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
                    <Th>Origen</Th>
                    <Th>Destino</Th>
                    <Th>Duración</Th>
                    <Th>Conductores mín.</Th>
                    <Th>Ida y vuelta</Th>
                    <Th>Descanso entre tramos</Th>
                    <Th>Estado</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {routes.length === 0 ? (
                    <Tr><Td colSpan={8} className="py-10 text-center text-gray-400">Sin rutas registradas.</Td></Tr>
                  ) : routes.map(r => (
                    <Tr key={r.id}>
                      <Td className="font-medium">{r.origin}</Td>
                      <Td className="text-gray-600">{r.destination}</Td>
                      <Td className="text-gray-500">{r.estimated_duration_minutes} min</Td>
                      <Td className="text-center">{r.min_drivers}</Td>
                      <Td>
                        {r.allows_roundtrip
                          ? <Badge className="bg-indigo-100 text-indigo-800 text-xs flex items-center gap-1 w-fit"><ArrowLeftRight className="h-3 w-3" /> Sí</Badge>
                          : <span className="text-gray-400 text-xs">No</span>
                        }
                      </Td>
                      <Td className="text-gray-500">{r.rest_between_legs_hours ? `${r.rest_between_legs_hours}h` : '—'}</Td>
                      <Td>
                        <Badge className={r.status === 'ACTIVA' ? 'bg-green-100 text-green-800 text-xs' : 'bg-gray-100 text-gray-600 text-xs'}>
                          {r.status}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(r)} className="rounded p-1 hover:bg-gray-100" title="Editar">
                            <Pencil className="h-4 w-4 text-gray-400" />
                          </button>
                          <button onClick={() => setDelRoute(r)} className="rounded p-1 hover:bg-red-50" title="Eliminar">
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                  <p className="text-sm text-gray-500">Página {page} de {pages}</p>
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

      {/* Create / Edit modal */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Editar ruta' : 'Nueva ruta'}
        size="lg"
      >
        <form onSubmit={onSubmit}>
          <ModalBody className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Origen *</Label>
                <Input {...form.register('origin')} placeholder="Ej: Terminal San Martín" />
                {form.formState.errors.origin && <p className="text-xs text-red-600">{form.formState.errors.origin.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Destino *</Label>
                <Input {...form.register('destination')} placeholder="Ej: Mercado Central" />
                {form.formState.errors.destination && <p className="text-xs text-red-600">{form.formState.errors.destination.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Duración estimada (minutos) *</Label>
                <Input type="number" min={1} {...form.register('estimated_duration_minutes')} />
                {form.formState.errors.estimated_duration_minutes && (
                  <p className="text-xs text-red-600">{form.formState.errors.estimated_duration_minutes.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Conductores mínimos *</Label>
                <Select {...form.register('min_drivers')}>
                  <option value={1}>1 conductor</option>
                  <option value={2}>2 conductores</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de ruta *</Label>
                <Select {...form.register('type')}>
                  <option value="PREDEFINIDA">Predefinida</option>
                  <option value="ESPECIAL">Especial</option>
                </Select>
                {form.formState.errors.type && <p className="text-xs text-red-600">{form.formState.errors.type.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select {...form.register('status')}>
                  <option value="ACTIVA">Activa</option>
                  <option value="INACTIVA">Inactiva</option>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="roundtrip"
                  className="h-4 w-4 rounded border-gray-300 text-[#1B4F72]"
                  {...form.register('allows_roundtrip')}
                />
                <Label htmlFor="roundtrip" className="cursor-pointer">Permite ida y vuelta</Label>
              </div>
              {watchRoundtrip && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Descanso entre tramos (horas)</Label>
                  <Input type="number" min={0} max={24} step={0.5} {...form.register('rest_between_legs_hours')} className="max-w-[150px]" />
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : modal?.mode === 'edit' ? 'Guardar cambios' : 'Crear ruta'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!delRoute} onClose={() => setDelRoute(null)} title="Eliminar ruta" size="sm">
        <ModalBody>
          <p className="text-sm text-gray-700">
            ¿Confirmas eliminar la ruta <strong>{delRoute?.origin} → {delRoute?.destination}</strong>?
            Esta acción no se puede deshacer.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDelRoute(null)}>Cancelar</Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={confirmDelete}>Eliminar</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
