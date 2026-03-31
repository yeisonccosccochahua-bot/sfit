import { useEffect, useState, useCallback, useRef } from 'react';
import { Users, Plus, Pencil, Trash2, Search, Upload, X, Camera } from 'lucide-react';
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

interface Company { id: string; name: string; }
interface Driver {
  id: string; name: string; dni: string; license_number?: string; license_category?: string;
  license_expires_at?: string; phone?: string; email?: string; photo_url?: string;
  status: DriverStatus; reputation_score: number; company_id: string; company?: Company;
}

const schema = z.object({
  dni:              z.string().min(8).max(15).regex(/^\d+$/, 'Solo números'),
  name:             z.string().min(3).max(200),
  license_number:   z.string().max(50).optional(),
  license_category: z.string().max(20).optional(),
  license_expires_at: z.string().optional(),
  phone:            z.string().max(20).optional(),
  email:            z.string().email('Email inválido').optional().or(z.literal('')),
  company_id:       z.string().uuid('Selecciona una empresa'),
  status:           z.enum(['APTO','RIESGO','NO_APTO']).optional(),
  photo_url:        z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const STATUS_BADGE: Record<DriverStatus, string> = {
  [DriverStatus.APTO]:    'bg-green-100 text-green-800',
  [DriverStatus.RIESGO]:  'bg-amber-100 text-amber-800',
  [DriverStatus.NO_APTO]: 'bg-red-100 text-red-800',
};

function PhotoUpload({ value, onChange, token }: { value?: string; onChange: (url: string) => void; token: string }) {
  const [preview, setPreview] = useState<string>(value ?? '');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/uploads/drivers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Error al subir');
      const { url } = await res.json();
      setPreview(url);
      onChange(url);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 rounded-full overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0">
        {preview
          ? <img src={preview} alt="Foto" className="h-full w-full object-cover" />
          : <Camera className="h-7 w-7 text-gray-400" />
        }
        {uploading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Spinner className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="space-y-1">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5 mr-1.5" /> {preview ? 'Cambiar foto' : 'Subir foto'}
        </Button>
        {preview && (
          <button type="button" onClick={() => { setPreview(''); onChange(''); }}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
            <X className="h-3 w-3" /> Quitar foto
          </button>
        )}
        <p className="text-xs text-gray-400">JPG, PNG o WebP — máx. 5 MB</p>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />
      </div>
    </div>
  );
}

export function DriversManagement() {
  const { token } = useAuthStore();
  const [drivers,    setDrivers]    = useState<Driver[]>([]);
  const [companies,  setCompanies]  = useState<Company[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const [modal,      setModal]      = useState<{ mode: 'create' | 'edit'; driver?: Driver } | null>(null);
  const [delDriver,  setDelDriver]  = useState<Driver | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState<{ ok: boolean; msg: string } | null>(null);
  const PAGE = 15;

  const showToast = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 3500); };
  const hdrs = useCallback(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  // Load companies once
  useEffect(() => {
    fetch('/api/companies?limit=100', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setCompanies(d.data ?? [])).catch(() => {});
  }, [token]);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: String(PAGE) });
    if (search)        p.set('search', search);
    if (statusFilter)  p.set('status', statusFilter);
    if (companyFilter) p.set('company_id', companyFilter);
    fetch(`/api/drivers?${p}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setDrivers(d.data ?? []); setTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page, search, statusFilter, companyFilter]);

  useEffect(() => { load(); }, [load]);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });
  const photoUrl = form.watch('photo_url');

  const openCreate = () => {
    form.reset({ dni: '', name: '', license_number: '', license_category: '', phone: '', email: '',
      company_id: companies[0]?.id ?? '', photo_url: '' });
    setModal({ mode: 'create' });
  };
  const openEdit = (d: Driver) => {
    form.reset({ dni: d.dni, name: d.name, license_number: d.license_number ?? '',
      license_category: d.license_category ?? '',
      license_expires_at: d.license_expires_at ? d.license_expires_at.slice(0, 10) : '',
      phone: d.phone ?? '', email: d.email ?? '', company_id: d.company_id,
      status: d.status, photo_url: d.photo_url ?? '' });
    setModal({ mode: 'edit', driver: d });
  };

  const onSubmit = form.handleSubmit(async (data) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      Object.entries(data).forEach(([k, v]) => { if (v !== '' && v !== undefined) body[k] = v; });
      if (modal?.mode === 'create') delete body.status;
      const url    = modal?.mode === 'edit' ? `/api/drivers/${modal.driver!.id}` : '/api/drivers';
      const method = modal?.mode === 'edit' ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: hdrs(), body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(Array.isArray(e.message) ? e.message[0] : (e.message ?? 'Error')); }
      showToast(true, modal?.mode === 'edit' ? 'Conductor actualizado.' : 'Conductor creado.');
      setModal(null); load();
    } catch (e: any) { showToast(false, e.message); }
    finally { setSaving(false); }
  });

  const confirmDelete = async () => {
    if (!delDriver) return;
    try {
      const res = await fetch(`/api/drivers/${delDriver.id}`, { method: 'DELETE', headers: hdrs() });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Error');
      showToast(true, 'Conductor eliminado.'); setDelDriver(null); load();
    } catch (e: any) { showToast(false, e.message); setDelDriver(null); }
  };

  const pages = Math.ceil(total / PAGE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-[#1B4F72]" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Conductores</h2>
            <p className="text-sm text-gray-500">Gestión de conductores habilitados</p>
          </div>
        </div>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-1.5" /> Nuevo conductor</Button>
      </div>

      {toast && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${toast.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {toast.msg}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Buscar por nombre o DNI…" className="pl-9" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="min-w-[160px]">
            <option value="">Todos los estados</option>
            <option value="APTO">APTO</option>
            <option value="RIESGO">RIESGO</option>
            <option value="NO_APTO">NO_APTO</option>
          </Select>
          <Select value={companyFilter} onChange={e => { setCompanyFilter(e.target.value); setPage(1); }} className="min-w-[180px]">
            <option value="">Todas las empresas</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
            <>
              <Table>
                <Thead><Tr>
                  <Th>Conductor</Th><Th>DNI</Th><Th>Licencia</Th><Th>Empresa</Th>
                  <Th>Teléfono</Th><Th>Estado</Th><Th>Reputación</Th><Th></Th>
                </Tr></Thead>
                <Tbody>
                  {drivers.length === 0
                    ? <Tr><Td colSpan={8} className="py-12 text-center text-gray-400">Sin conductores registrados.</Td></Tr>
                    : drivers.map(d => (
                      <Tr key={d.id}>
                        <Td>
                          <div className="flex items-center gap-3">
                            {d.photo_url
                              ? <img src={d.photo_url} alt="" className="h-9 w-9 rounded-full object-cover flex-shrink-0 border border-gray-200" />
                              : <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">{d.name[0]}</div>
                            }
                            <div>
                              <p className="font-medium text-gray-900">{d.name}</p>
                              {d.email && <p className="text-xs text-gray-400">{d.email}</p>}
                            </div>
                          </div>
                        </Td>
                        <Td className="font-mono text-sm text-gray-600">{d.dni}</Td>
                        <Td className="text-sm text-gray-500">
                          <span>{d.license_number ?? '—'}</span>
                          {d.license_category && <span className="ml-1 text-xs text-gray-400">({d.license_category})</span>}
                        </Td>
                        <Td className="text-sm text-gray-500">{d.company?.name ?? '—'}</Td>
                        <Td className="text-sm text-gray-500">{d.phone ?? '—'}</Td>
                        <Td><Badge className={`${STATUS_BADGE[d.status]} text-xs`}>{d.status}</Badge></Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
                              <div className={`h-full rounded-full ${Number(d.reputation_score) >= 80 ? 'bg-green-500' : Number(d.reputation_score) >= 50 ? 'bg-amber-400' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(100, Number(d.reputation_score))}%` }} />
                            </div>
                            <span className="text-sm font-semibold text-gray-700">{Number(d.reputation_score)}</span>
                          </div>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(d)} className="rounded p-1 hover:bg-gray-100"><Pencil className="h-4 w-4 text-gray-400" /></button>
                            <button onClick={() => setDelDriver(d)} className="rounded p-1 hover:bg-red-50"><Trash2 className="h-4 w-4 text-red-400" /></button>
                          </div>
                        </Td>
                      </Tr>
                    ))
                  }
                </Tbody>
              </Table>
              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                  <p className="text-sm text-gray-500">{total} conductor{total !== 1 ? 'es' : ''} · pág. {page}/{pages}</p>
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
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.mode === 'edit' ? 'Editar conductor' : 'Nuevo conductor'} size="lg">
        <form onSubmit={onSubmit}>
          <ModalBody className="space-y-4">
            {/* Photo */}
            <PhotoUpload
              value={photoUrl}
              token={token ?? ''}
              onChange={url => form.setValue('photo_url', url)}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nombre completo *</Label>
                <Input {...form.register('name')} placeholder="Juan Pérez García" />
                {form.formState.errors.name && <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>DNI *</Label>
                <Input {...form.register('dni')} placeholder="12345678" maxLength={15} />
                {form.formState.errors.dni && <p className="text-xs text-red-600">{form.formState.errors.dni.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input {...form.register('phone')} placeholder="+51 999 999 999" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" {...form.register('email')} placeholder="conductor@email.com" />
                {form.formState.errors.email && <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>N° Licencia</Label>
                <Input {...form.register('license_number')} placeholder="B-IIa-123456" />
              </div>
              <div className="space-y-1.5">
                <Label>Categoría de licencia</Label>
                <Select {...form.register('license_category')}>
                  <option value="">Seleccionar…</option>
                  <option value="A-I">A-I</option>
                  <option value="A-IIa">A-IIa</option>
                  <option value="A-IIb">A-IIb</option>
                  <option value="A-IIIa">A-IIIa</option>
                  <option value="A-IIIb">A-IIIb</option>
                  <option value="A-IIIc">A-IIIc</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Vencimiento de licencia</Label>
                <Input type="date" {...form.register('license_expires_at')} />
              </div>
              <div className="space-y-1.5">
                <Label>Empresa *</Label>
                <Select {...form.register('company_id')}>
                  <option value="">Seleccionar empresa…</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                {form.formState.errors.company_id && <p className="text-xs text-red-600">Selecciona una empresa</p>}
              </div>
              {modal?.mode === 'edit' && (
                <div className="space-y-1.5">
                  <Label>Estado</Label>
                  <Select {...form.register('status')}>
                    <option value="APTO">APTO</option>
                    <option value="RIESGO">RIESGO</option>
                    <option value="NO_APTO">NO_APTO</option>
                  </Select>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setModal(null)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : (modal?.mode === 'edit' ? 'Guardar cambios' : 'Crear conductor')}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!delDriver} onClose={() => setDelDriver(null)} title="Eliminar conductor" size="sm">
        <ModalBody>
          <p className="text-sm text-gray-700">¿Confirmas eliminar a <strong>{delDriver?.name}</strong> (DNI {delDriver?.dni})?</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => setDelDriver(null)}>Cancelar</Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={confirmDelete}>Eliminar</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
