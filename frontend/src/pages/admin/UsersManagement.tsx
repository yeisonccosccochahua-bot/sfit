import { useEffect, useState, useCallback } from 'react';
import { UserCog, Plus, Search, MoreVertical, ShieldOff, ShieldCheck, Mail } from 'lucide-react';
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
import { UserRole, UserStatus } from '../../types';
import { ROLE_LABELS } from '../../lib/constants';

// ─── Allowed roles to create (cannot create ADMIN_MUNICIPAL or CIUDADANO) ─────
const CREATABLE_ROLES = [
  UserRole.FISCAL,
  UserRole.OPERADOR_EMPRESA,
  UserRole.INSPECTOR,
] as const;

interface UserRow {
  id:              string;
  name:            string;
  email:           string;
  dni?:            string;
  role:            UserRole;
  status:          UserStatus;
  company_id?:     string;
  company_name?:   string;
  created_at:      string;
}

const createSchema = z.object({
  name:     z.string().min(3, 'Mínimo 3 caracteres'),
  email:    z.string().email('Email inválido'),
  password: z.string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, 'Debe tener mayúsculas, minúsculas y un número'),
  dni:      z.string().optional(),
  phone:    z.string().optional(),
  role:     z.enum([UserRole.FISCAL, UserRole.OPERADOR_EMPRESA, UserRole.INSPECTOR]),
});
type CreateForm = z.infer<typeof createSchema>;

const STATUS_BADGE: Record<UserStatus, string> = {
  [UserStatus.ACTIVO]:    'bg-green-100 text-green-800',
  [UserStatus.BLOQUEADO]: 'bg-red-100 text-red-800',
  [UserStatus.SUSPENDIDO]:'bg-amber-100 text-amber-800',
};

export function UsersManagement() {
  const { token } = useAuthStore();
  const [users,   setUsers]  = useState<UserRow[]>([]);
  const [loading, setLoading]= useState(true);
  const [search,    setSearch]   = useState('');
  const [roleFilter,setRoleFilter]= useState('');
  const [page,      setPage]     = useState(1);
  const [total,     setTotal]    = useState(0);
  const [creating,  setCreating] = useState(false);
  const [saving,    setSaving]   = useState(false);
  const [menuUser,  setMenuUser] = useState<UserRow | null>(null);
  const [toast,     setToast]    = useState<{ ok: boolean; msg: string } | null>(null);
  const PAGE = 15;

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const headers = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token]);

  const loadUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE) });
    if (search)     params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);
    fetch(`/api/users?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setUsers(d.data ?? []); setTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page, search, roleFilter]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const form = useForm<CreateForm>({ resolver: zodResolver(createSchema) });

  const onSubmit = form.handleSubmit(async (data) => {
    setSaving(true);
    try {
      // Strip empty optional fields: @IsOptional in NestJS only skips null/undefined, not ""
      // Also forbidNonWhitelisted=true rejects any unknown field
      const body: Record<string, unknown> = {
        name:     data.name,
        email:    data.email,
        password: data.password,
        role:     data.role,
      };
      if (data.dni?.trim())   body.dni   = data.dni.trim();
      if (data.phone?.trim()) body.phone = data.phone.trim();

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        const msg = Array.isArray(err.message) ? err.message[0] : (err.message ?? 'Error al crear usuario');
        throw new Error(msg);
      }
      showToast(true, 'Usuario creado correctamente.');
      setCreating(false);
      form.reset();
      loadUsers();
    } catch (e: any) {
      showToast(false, e.message);
    } finally {
      setSaving(false);
    }
  });

  const toggleStatus = async (u: UserRow) => {
    const newStatus = u.status === UserStatus.ACTIVO ? UserStatus.BLOQUEADO : UserStatus.ACTIVO;
    try {
      const res = await fetch(`/api/users/${u.id}/status`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Error');
      showToast(true, `Usuario ${newStatus === UserStatus.ACTIVO ? 'activado' : 'bloqueado'}.`);
      loadUsers();
    } catch (e: any) {
      showToast(false, e.message);
    }
    setMenuUser(null);
  };

  const pages = Math.ceil(total / PAGE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog className="h-6 w-6 text-[#1B4F72]" />
          <h2 className="text-xl font-bold text-gray-900">Gestión de Usuarios</h2>
        </div>
        <Button onClick={() => setCreating(true)} size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Nuevo usuario
        </Button>
      </div>

      {toast && (
        <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${
          toast.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nombre, email o DNI…"
              className="pl-9"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
            className="min-w-[200px]"
          >
            <option value="">Todos los roles</option>
            {Object.values(UserRole).map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </Select>
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
                    <Th>Nombre</Th>
                    <Th>Email</Th>
                    <Th>Rol</Th>
                    <Th>Empresa</Th>
                    <Th>Estado</Th>
                    <Th>Registrado</Th>
                    <Th></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {users.length === 0 ? (
                    <Tr><Td colSpan={7} className="py-10 text-center text-gray-400">Sin resultados.</Td></Tr>
                  ) : users.map(u => (
                    <Tr key={u.id}>
                      <Td>
                        <div className="font-medium text-gray-900">{u.name}</div>
                        {u.dni && <div className="text-xs text-gray-400">DNI {u.dni}</div>}
                      </Td>
                      <Td className="text-gray-600">{u.email}</Td>
                      <Td>
                        <Badge className="bg-blue-100 text-blue-800 text-xs">{ROLE_LABELS[u.role]}</Badge>
                      </Td>
                      <Td className="text-gray-500">{u.company_name ?? '—'}</Td>
                      <Td>
                        <Badge className={`${STATUS_BADGE[u.status]} text-xs`}>{u.status}</Badge>
                      </Td>
                      <Td className="text-gray-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString('es-PE')}
                      </Td>
                      <Td>
                        <div className="relative">
                          <button
                            onClick={() => setMenuUser(menuUser?.id === u.id ? null : u)}
                            className="rounded p-1 hover:bg-gray-100"
                          >
                            <MoreVertical className="h-4 w-4 text-gray-400" />
                          </button>
                          {menuUser?.id === u.id && (
                            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white shadow-lg text-sm">
                              <button
                                onClick={() => toggleStatus(u)}
                                className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-gray-50"
                              >
                                {u.status === UserStatus.ACTIVO
                                  ? <><ShieldOff  className="h-4 w-4 text-red-500" /> Bloquear</>
                                  : <><ShieldCheck className="h-4 w-4 text-green-600" /> Activar</>
                                }
                              </button>
                            </div>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>

              {/* Pagination */}
              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                  <p className="text-sm text-gray-500">
                    {total} usuario{total !== 1 ? 's' : ''} · página {page} de {pages}
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

      {/* Create modal */}
      <Modal open={creating} onClose={() => { setCreating(false); form.reset(); }} title="Nuevo usuario" size="lg">
        <form onSubmit={onSubmit}>
          <ModalBody className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nombre completo *</Label>
                <Input {...form.register('name')} placeholder="Juan Pérez García" />
                {form.formState.errors.name && (
                  <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>DNI</Label>
                <Input {...form.register('dni')} placeholder="12345678" maxLength={8} />
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" {...form.register('email')} placeholder="usuario@municipio.gob.pe" />
                {form.formState.errors.email && (
                  <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Contraseña temporal *</Label>
                <Input type="password" {...form.register('password')} placeholder="Mínimo 8 caracteres" />
                {form.formState.errors.password && (
                  <p className="text-xs text-red-600">{form.formState.errors.password.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input {...form.register('phone')} placeholder="+51 999 999 999" />
              </div>
              <div className="space-y-1.5">
                <Label>Rol *</Label>
                <Select {...form.register('role')}>
                  <option value="">Seleccionar rol…</option>
                  {CREATABLE_ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </Select>
                {form.formState.errors.role && (
                  <p className="text-xs text-red-600">{form.formState.errors.role.message}</p>
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => { setCreating(false); form.reset(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : <Mail className="h-4 w-4 mr-1.5" />}
              Crear y notificar
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Close dropdown on outside click */}
      {menuUser && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuUser(null)} />
      )}
    </div>
  );
}
