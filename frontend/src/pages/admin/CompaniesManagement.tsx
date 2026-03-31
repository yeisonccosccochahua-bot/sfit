import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Pencil, Trash2, Search, ChevronDown, ChevronRight, Users, Bus, ExternalLink } from 'lucide-react';
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
import { DriverStatus } from '../../types';

interface Company {
  id: string; name: string; ruc: string; address?: string; license?: string;
  phone?: string; email?: string; representative?: string; representative_dni?: string;
  status: string; reputation_score: number; driver_count?: number; vehicle_count?: number;
}
interface DriverRow  { id: string; name: string; dni: string; status: DriverStatus; reputation_score: number; photo_url?: string; }
interface VehicleRow { id: string; plate: string; brand?: string; model?: string; status: string; }

const schema = z.object({
  ruc:               z.string().length(11).regex(/^\d{11}$/),
  name:              z.string().min(3).max(200),
  address:           z.string().max(300).optional(),
  license:           z.string().max(100).optional(),
  phone:             z.string().max(20).optional(),
  email:             z.string().email('Email inválido').optional().or(z.literal('')),
  representative:    z.string().max(200).optional(),
  representative_dni:z.string().max(15).optional(),
  status:            z.enum(['ACTIVO','INACTIVO','SUSPENDIDO']).optional(),
});
type FormData = z.infer<typeof schema>;

const STATUS_BADGE: Record<string, string> = {
  ACTIVO: 'bg-green-100 text-green-800', INACTIVO: 'bg-gray-100 text-gray-600', SUSPENDIDO: 'bg-red-100 text-red-800',
};
const DRIVER_BADGE: Record<DriverStatus, string> = {
  [DriverStatus.APTO]: 'bg-green-100 text-green-800', [DriverStatus.RIESGO]: 'bg-amber-100 text-amber-800',
  [DriverStatus.NO_APTO]: 'bg-red-100 text-red-800',
};

function RepBar({ score }: { score: number }) {
  const n = Number(score);
  const color = n >= 80 ? 'bg-green-500' : n >= 50 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, n)}%` }} />
      </div>
      <span className="text-sm font-semibold text-gray-700">{n}</span>
    </div>
  );
}

function CompanyRow({ company, onEdit, onDelete }: { company: Company; onEdit: (c: Company) => void; onDelete: (c: Company) => void }) {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [drivers,  setDrivers]  = useState<DriverRow[] | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRow[] | null>(null);
  const [loading, setLoading]   = useState(false);

  const loadDetails = useCallback(() => {
    if (drivers !== null) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/drivers?company_id=${company.id}&limit=50`,  { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`/api/vehicles?company_id=${company.id}&limit=50`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([d, v]) => { setDrivers(d.data ?? []); setVehicles(v.data ?? []); })
      .catch(() => { setDrivers([]); setVehicles([]); })
      .finally(() => setLoading(false));
  }, [company.id, token, drivers]);

  const toggle = () => { if (!open) loadDetails(); setOpen(o => !o); };

  return (
    <>
      <Tr>
        <Td className="w-8 cursor-pointer" onClick={toggle}>
          {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </Td>
        <Td className="cursor-pointer" onClick={toggle}>
          <p className="font-semibold text-gray-900">{company.name}</p>
          <p className="text-xs text-gray-400">RUC {company.ruc}</p>
        </Td>
        <Td className="text-sm text-gray-500">{company.phone ?? '—'}</Td>
        <Td className="text-sm text-gray-500">{company.email ?? '—'}</Td>
        <Td>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{company.driver_count ?? 0}</span>
            <span className="flex items-center gap-1"><Bus className="h-3.5 w-3.5" />{company.vehicle_count ?? 0}</span>
          </div>
        </Td>
        <Td><Badge className={`${STATUS_BADGE[company.status] ?? ''} text-xs`}>{company.status}</Badge></Td>
        <Td><RepBar score={company.reputation_score} /></Td>
        <Td>
          <div className="flex items-center gap-1">
            <button onClick={e => { e.stopPropagation(); navigate(`/admin/companies/${company.id}`); }}
              title="Ver detalle" className="rounded p-1 hover:bg-blue-50 text-blue-500">
              <ExternalLink className="h-4 w-4" />
            </button>
            <button onClick={e => { e.stopPropagation(); onEdit(company); }} className="rounded p-1 hover:bg-gray-100">
              <Pencil className="h-4 w-4 text-gray-400" />
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(company); }} className="rounded p-1 hover:bg-red-50">
              <Trash2 className="h-4 w-4 text-red-400" />
            </button>
          </div>
        </Td>
      </Tr>

      {open && (
        <Tr>
          <Td colSpan={8} className="p-0 bg-gray-50">
            {loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                {/* Drivers */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Conductores ({drivers?.length ?? 0})
                  </p>
                  {!drivers?.length ? <p className="text-xs text-gray-400 py-2">Sin conductores.</p> : (
                    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                      <table className="min-w-full text-sm divide-y divide-gray-100">
                        <thead className="bg-gray-50"><tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nombre</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">DNI</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Estado</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Rep.</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-50">
                          {drivers.map(d => (
                            <tr key={d.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  {d.photo_url
                                    ? <img src={d.photo_url} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
                                    : <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">{d.name[0]}</div>
                                  }
                                  <span className="font-medium text-gray-800">{d.name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-gray-500 font-mono text-xs">{d.dni}</td>
                              <td className="px-3 py-2"><Badge className={`${DRIVER_BADGE[d.status]} text-xs`}>{d.status}</Badge></td>
                              <td className="px-3 py-2"><RepBar score={d.reputation_score} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                {/* Vehicles */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
                    <Bus className="h-3.5 w-3.5" /> Vehículos ({vehicles?.length ?? 0})
                  </p>
                  {!vehicles?.length ? <p className="text-xs text-gray-400 py-2">Sin vehículos.</p> : (
                    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                      <table className="min-w-full text-sm divide-y divide-gray-100">
                        <thead className="bg-gray-50"><tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Placa</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Vehículo</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Estado</th>
                        </tr></thead>
                        <tbody className="divide-y divide-gray-50">
                          {vehicles.map(v => (
                            <tr key={v.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-mono font-semibold text-gray-800">{v.plate}</td>
                              <td className="px-3 py-2 text-gray-500 text-xs">{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</td>
                              <td className="px-3 py-2">
                                <Badge className={v.status === 'ACTIVO' ? 'bg-green-100 text-green-800 text-xs' : 'bg-gray-100 text-gray-600 text-xs'}>{v.status}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Td>
        </Tr>
      )}
    </>
  );
}

export function CompaniesManagement() {
  const { token } = useAuthStore();
  const [companies,  setCompanies]  = useState<Company[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const [modal,      setModal]      = useState<{ mode: 'create' | 'edit'; company?: Company } | null>(null);
  const [delCompany, setDelCompany] = useState<Company | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState<{ ok: boolean; msg: string } | null>(null);
  const PAGE = 15;

  const showToast = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 3500); };
  const headers = useCallback(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(PAGE) });
    if (search) p.set('search', search);
    fetch(`/api/companies?${p}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setCompanies(d.data ?? []); setTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page, search]);

  useEffect(() => { load(); }, [load]);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  const openCreate = () => {
    form.reset({ ruc: '', name: '', address: '', license: '', phone: '', email: '', representative: '', representative_dni: '' });
    setModal({ mode: 'create' });
  };
  const openEdit = (c: Company) => {
    form.reset({ ruc: c.ruc, name: c.name, address: c.address ?? '', license: c.license ?? '',
      phone: c.phone ?? '', email: c.email ?? '', representative: c.representative ?? '',
      representative_dni: c.representative_dni ?? '', status: c.status as any });
    setModal({ mode: 'edit', company: c });
  };

  const onSubmit = form.handleSubmit(async (data) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      Object.entries(data).forEach(([k, v]) => { if (v !== '' && v !== undefined) body[k] = v; });
      if (modal?.mode === 'create') delete body.status;
      const url    = modal?.mode === 'edit' ? `/api/companies/${modal.company!.id}` : '/api/companies';
      const method = modal?.mode === 'edit' ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(Array.isArray(e.message) ? e.message[0] : (e.message ?? 'Error')); }
      showToast(true, modal?.mode === 'edit' ? 'Empresa actualizada.' : 'Empresa creada.');
      setModal(null); load();
    } catch (e: any) { showToast(false, e.message); }
    finally { setSaving(false); }
  });

  const confirmDelete = async () => {
    if (!delCompany) return;
    try {
      const res = await fetch(`/api/companies/${delCompany.id}`, { method: 'DELETE', headers: headers() });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Error');
      showToast(true, 'Empresa eliminada.'); setDelCompany(null); load();
    } catch (e: any) { showToast(false, e.message); setDelCompany(null); }
  };

  const pages = Math.ceil(total / PAGE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-[#1B4F72]" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Empresas de Transporte</h2>
            <p className="text-sm text-gray-500">Gestión completa de empresas habilitadas</p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1.5" /> Nueva empresa</Button>
      </div>

      {toast && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${toast.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {toast.msg}
        </div>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar por nombre o RUC…" className="pl-9" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
            <>
              <Table>
                <Thead><Tr>
                  <Th className="w-8"></Th><Th>Empresa</Th><Th>Teléfono</Th><Th>Email</Th>
                  <Th>Flota</Th><Th>Estado</Th><Th>Reputación</Th><Th></Th>
                </Tr></Thead>
                <Tbody>
                  {companies.length === 0
                    ? <Tr><Td colSpan={8} className="py-12 text-center text-gray-400">Sin empresas registradas.</Td></Tr>
                    : companies.map(c => <CompanyRow key={c.id} company={c} onEdit={openEdit} onDelete={setDelCompany} />)
                  }
                </Tbody>
              </Table>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                  <p className="text-sm text-gray-500">{total} empresa{total !== 1 ? 's' : ''} · pág. {page}/{pages}</p>
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
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Editar empresa' : 'Nueva empresa'} size="lg">
        <form onSubmit={onSubmit}>
          <ModalBody className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>RUC *</Label>
                <Input {...form.register('ruc')} placeholder="20123456789" maxLength={11} />
                {form.formState.errors.ruc && <p className="text-xs text-red-600">11 dígitos numéricos</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Razón social *</Label>
                <Input {...form.register('name')} placeholder="Transportes S.A.C." />
                {form.formState.errors.name && <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Dirección</Label>
                <Input {...form.register('address')} placeholder="Av. Principal 123, Tambobamba" />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input {...form.register('phone')} placeholder="+51 999 999 999" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" {...form.register('email')} placeholder="empresa@correo.com" />
                {form.formState.errors.email && <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>N° Habilitación / Licencia</Label>
                <Input {...form.register('license')} placeholder="HAB-0001" />
              </div>
              <div className="space-y-1.5">
                <Label>Representante legal</Label>
                <Input {...form.register('representative')} placeholder="Juan Pérez García" />
              </div>
              <div className="space-y-1.5">
                <Label>DNI del representante</Label>
                <Input {...form.register('representative_dni')} placeholder="12345678" maxLength={8} />
              </div>
              {modal?.mode === 'edit' && (
                <div className="space-y-1.5">
                  <Label>Estado</Label>
                  <Select {...form.register('status')}>
                    <option value="ACTIVO">Activo</option>
                    <option value="INACTIVO">Inactivo</option>
                    <option value="SUSPENDIDO">Suspendido</option>
                  </Select>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : (modal?.mode === 'edit' ? 'Guardar cambios' : 'Crear empresa')}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!delCompany} onClose={() => setDelCompany(null)} title="Eliminar empresa" size="sm">
        <ModalBody>
          <p className="text-sm text-gray-700">
            ¿Confirmas eliminar <strong>{delCompany?.name}</strong>? Solo es posible si no tiene conductores ni vehículos asociados.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDelCompany(null)}>Cancelar</Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={confirmDelete}>Eliminar</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
