import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Pencil, Trash2, Search, X, RefreshCw, QrCode,
  Download, ChevronLeft, ChevronRight, Upload, Car,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { UserRole } from '../../types';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface Company { id: string; name: string; ruc: string }

type VehicleStatus = 'ACTIVO' | 'INACTIVO' | 'MANTENIMIENTO';

interface Vehicle {
  id: string;
  plate: string;
  brand?: string;
  model?: string;
  year?: number;
  color?: string;
  capacity?: number;
  photo_url?: string;
  soat_expires_at?: string;
  inspection_expires_at?: string;
  status: VehicleStatus;
  qr_code?: string;
  company: { id: string; name: string };
  created_at: string;
}

interface VehiclePage {
  data: Vehicle[];
  total: number;
  page: number;
  limit: number;
}

/* ── Zod schema ─────────────────────────────────────────────────────────── */
const vehicleSchema = z.object({
  plate:               z.string().regex(/^[A-Z0-9]{3}-[0-9]{3}$/, 'Formato: ABC-123'),
  brand:               z.string().max(100).optional().or(z.literal('')),
  model:               z.string().max(100).optional().or(z.literal('')),
  year:                z.union([z.number().int().min(1990).max(new Date().getFullYear() + 1), z.nan()])
                         .optional(),
  color:               z.string().max(50).optional().or(z.literal('')),
  capacity:            z.union([z.number().int().min(1).max(100), z.nan()]).optional(),
  photo_url:           z.string().optional().or(z.literal('')),
  soat_expires_at:     z.string().optional().or(z.literal('')),
  inspection_expires_at: z.string().optional().or(z.literal('')),
  company_id:          z.string().uuid('Seleccione una empresa'),
  status:              z.enum(['ACTIVO', 'INACTIVO', 'MANTENIMIENTO']).optional(),
});
type VehicleFormData = z.infer<typeof vehicleSchema>;

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const STATUS_COLORS: Record<VehicleStatus, string> = {
  ACTIVO:       'bg-green-100 text-green-800',
  INACTIVO:     'bg-gray-100 text-gray-600',
  MANTENIMIENTO:'bg-yellow-100 text-yellow-800',
};

function statusLabel(s: VehicleStatus) {
  return s === 'MANTENIMIENTO' ? 'Mantenim.' : s.charAt(0) + s.slice(1).toLowerCase();
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function expiryClass(d?: string) {
  if (!d) return '';
  const diff = (new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000;
  if (diff < 0)  return 'text-red-600 font-semibold';
  if (diff < 30) return 'text-yellow-600 font-semibold';
  return 'text-gray-600';
}

/* ── PhotoUpload component ───────────────────────────────────────────────── */
function PhotoUpload({ value, onChange }: { value?: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const { token } = useAuthStore();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/uploads/vehicles', { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { const j = await res.json(); throw new Error(j.message ?? 'Error al subir'); }
      const { url } = await res.json();
      onChange(url);
    } catch (err: any) {
      setError(err.message ?? 'Error al subir foto');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200 shrink-0">
        {value
          ? <img src={value} alt="Vehículo" className="w-full h-full object-cover" />
          : <Car className="h-7 w-7 text-gray-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <label className="cursor-pointer">
          <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border font-medium
            ${uploading ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
            {uploading
              ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Subiendo…</>
              : <><Upload className="h-3.5 w-3.5" /> {value ? 'Cambiar foto' : 'Subir foto'}</>}
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            disabled={uploading} onChange={handleFile} />
        </label>
        {value && !uploading && (
          <button type="button" onClick={() => onChange('')}
            className="ml-2 text-xs text-red-500 hover:text-red-700">Quitar</button>
        )}
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        <p className="text-xs text-gray-400 mt-0.5">JPG, PNG o WEBP · máx. 5 MB</p>
      </div>
    </div>
  );
}

/* ── QR Modal ────────────────────────────────────────────────────────────── */
function QrModal({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const [qrData, setQrData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const { token } = useAuthStore();

  const loadQr = useCallback(async () => {
    setLoading(true);
    setError('');
    // Revoke previous blob URL to avoid memory leaks
    setQrData(prev => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return null; });
    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}/qr`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('No se pudo cargar el QR');
      const blob = await res.blob();
      setQrData(URL.createObjectURL(blob));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [vehicle.id, token]);

  useEffect(() => { loadQr(); }, [loadQr]);

  async function handleRegenerate() {
    setRegenerating(true);
    setError('');
    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}/regenerate-qr`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Error al regenerar QR');
      await loadQr();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDownload() {
    if (!qrData) return;
    // Re-fetch for a clean download so we don't rely on the existing blob URL state
    const res = await fetch(`/api/vehicles/${vehicle.id}/qr`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${vehicle.plate}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Código QR</h2>
            <p className="text-sm text-gray-500">{vehicle.plate} — {vehicle.brand} {vehicle.model}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        <div className="p-5 flex flex-col items-center gap-4">
          {loading ? (
            <div className="h-56 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="h-56 flex flex-col items-center justify-center gap-2">
              <p className="text-sm text-red-600">{error}</p>
              <button onClick={loadQr} className="text-sm text-blue-600 hover:underline">Reintentar</button>
            </div>
          ) : qrData ? (
            <img src={qrData} alt="QR Code" className="w-56 h-56 rounded-lg border border-gray-200" />
          ) : (
            <div className="h-56 flex items-center justify-center">
              <p className="text-sm text-gray-500">QR no disponible</p>
            </div>
          )}

          <div className="flex gap-2 w-full">
            <button
              onClick={handleDownload}
              disabled={!qrData || loading}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Descargar
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenerating || loading}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {regenerating
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Regenerando…</>
                : <><RefreshCw className="h-4 w-4" /> Regenerar QR</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export function VehiclesManagement() {
  const { user, token } = useAuthStore();
  const canEdit = user?.role === UserRole.ADMIN_MUNICIPAL;

  const [vehicles, setVehicles]     = useState<Vehicle[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(false);
  const [companies, setCompanies]   = useState<Company[]>([]);

  // Filters
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCompany, setFilterCompany] = useState('');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [deleteVehicle, setDeleteVehicle] = useState<Vehicle | null>(null);
  const [qrVehicle, setQrVehicle]   = useState<Vehicle | null>(null);
  const [deleting, setDeleting]     = useState(false);

  const LIMIT = 15;

  /* Load companies once */
  useEffect(() => {
    fetch('/api/companies?limit=100', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(j => setCompanies(j.data ?? []))
      .catch(() => {});
  }, [token]);

  /* Load vehicles */
  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(LIMIT),
        ...(search        && { search }),
        ...(filterStatus  && { status: filterStatus }),
        ...(filterCompany && { company_id: filterCompany }),
      });
      const res = await fetch(`/api/vehicles?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const j: VehiclePage = await res.json();
      setVehicles(j.data ?? []);
      setTotal(j.total ?? 0);
    } catch {
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus, filterCompany, token]);

  useEffect(() => { load(); }, [load]);

  function applyFilters() { setPage(1); load(1); }
  function clearFilters() {
    setSearch(''); setFilterStatus(''); setFilterCompany('');
    setPage(1);
  }

  /* ── Delete ── */
  async function confirmDelete() {
    if (!deleteVehicle) return;
    setDeleting(true);
    try {
      await fetch(`/api/vehicles/${deleteVehicle.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setDeleteVehicle(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  /* ─────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestión de Vehículos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} vehículo{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm"
          >
            <Plus className="h-4 w-4" /> Nuevo Vehículo
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Buscar (placa, marca, modelo)</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Ej: ABC-123 o Toyota"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
            />
          </div>
        </div>
        <div className="w-40">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Estado</label>
          <select
            className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
            <option value="MANTENIMIENTO">Mantenimiento</option>
          </select>
        </div>
        <div className="w-48">
          <label className="text-xs font-medium text-gray-600 mb-1 block">Empresa</label>
          <select
            className="w-full py-2 px-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={filterCompany}
            onChange={e => setFilterCompany(e.target.value)}
          >
            <option value="">Todas</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button onClick={applyFilters}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          Filtrar
        </button>
        {(search || filterStatus || filterCompany) && (
          <button onClick={clearFilters}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vehículo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Placa</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Capacidad</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">SOAT</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rev. Técnica</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Empresa</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Cargando…</td></tr>
              ) : vehicles.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No hay vehículos registrados</td></tr>
              ) : vehicles.map(v => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  {/* Vehicle photo + info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-10 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200 shrink-0">
                        {v.photo_url
                          ? <img src={v.photo_url} alt={v.plate} className="w-full h-full object-cover" />
                          : <Car className="h-5 w-5 text-gray-400" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {[v.brand, v.model].filter(Boolean).join(' ') || '—'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {v.year ?? ''}{v.color ? ` · ${v.color}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-gray-800 tracking-wider">{v.plate}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {v.capacity ? `${v.capacity} pas.` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={expiryClass(v.soat_expires_at)}>{fmtDate(v.soat_expires_at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={expiryClass(v.inspection_expires_at)}>{fmtDate(v.inspection_expires_at)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{v.company?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.status]}`}>
                      {statusLabel(v.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setQrVehicle(v)}
                        title="Ver QR"
                        className="p-1.5 rounded hover:bg-blue-50 text-blue-600 hover:text-blue-800"
                      >
                        <QrCode className="h-4 w-4" />
                      </button>
                      {canEdit && (
                        <>
                          <button
                            onClick={() => setEditVehicle(v)}
                            title="Editar"
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteVehicle(v)}
                            title="Eliminar"
                            className="p-1.5 rounded hover:bg-red-50 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Página {page} de {totalPages} · {total} vehículos
            </p>
            <div className="flex gap-1">
              <button onClick={() => { setPage(p => p - 1); }}
                disabled={page === 1}
                className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => { setPage(p => p + 1); }}
                disabled={page === totalPages}
                className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QR Modal */}
      {qrVehicle && <QrModal vehicle={qrVehicle} onClose={() => setQrVehicle(null)} />}

      {/* Create Modal */}
      {showCreate && (
        <VehicleFormModal
          mode="create"
          companies={companies}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}

      {/* Edit Modal */}
      {editVehicle && (
        <VehicleFormModal
          mode="edit"
          vehicle={editVehicle}
          companies={companies}
          onClose={() => setEditVehicle(null)}
          onSaved={() => { setEditVehicle(null); load(); }}
        />
      )}

      {/* Delete Modal */}
      {deleteVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Eliminar Vehículo</h2>
            <p className="text-sm text-gray-600 mb-5">
              ¿Eliminar <strong>{deleteVehicle.plate}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteVehicle(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── VehicleFormModal ─────────────────────────────────────────────────────── */
function VehicleFormModal({
  mode, vehicle, companies, onClose, onSaved,
}: {
  mode: 'create' | 'edit';
  vehicle?: Vehicle;
  companies: Company[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { token } = useAuthStore();
  const {
    register, handleSubmit, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      plate:               vehicle?.plate ?? '',
      brand:               vehicle?.brand ?? '',
      model:               vehicle?.model ?? '',
      year:                vehicle?.year,
      color:               vehicle?.color ?? '',
      capacity:            vehicle?.capacity,
      photo_url:           vehicle?.photo_url ?? '',
      soat_expires_at:     vehicle?.soat_expires_at?.slice(0, 10) ?? '',
      inspection_expires_at: vehicle?.inspection_expires_at?.slice(0, 10) ?? '',
      company_id:          vehicle?.company?.id ?? '',
      status:              vehicle?.status ?? 'ACTIVO',
    },
  });

  const photoUrl = watch('photo_url');

  async function onSubmit(data: VehicleFormData) {
    const clean: Record<string, any> = {
      plate:      data.plate,
      company_id: data.company_id,
      ...(data.brand               && { brand: data.brand }),
      ...(data.model               && { model: data.model }),
      ...(data.year                && !isNaN(data.year) && { year: data.year }),
      ...(data.color               && { color: data.color }),
      ...(data.capacity            && !isNaN(data.capacity) && { capacity: data.capacity }),
      ...(data.photo_url           && { photo_url: data.photo_url }),
      ...(data.soat_expires_at     && { soat_expires_at: data.soat_expires_at }),
      ...(data.inspection_expires_at && { inspection_expires_at: data.inspection_expires_at }),
      ...(mode === 'edit' && data.status && { status: data.status }),
    };

    const url    = mode === 'create' ? '/api/vehicles' : `/api/vehicles/${vehicle!.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(clean),
    });
    if (res.ok) { onSaved(); } else {
      const j = await res.json();
      alert(j.message ?? 'Error al guardar');
    }
  }

  const inputCls = (hasErr: boolean) =>
    `w-full px-3 py-2 text-sm border rounded-lg outline-none transition focus:ring-2 focus:ring-blue-500 ${
      hasErr ? 'border-red-400 bg-red-50' : 'border-gray-300'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">
            {mode === 'create' ? 'Nuevo Vehículo' : `Editar ${vehicle?.plate}`}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="h-5 w-5 text-gray-500" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {/* Photo */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Fotografía del Vehículo</label>
            <PhotoUpload
              value={photoUrl || undefined}
              onChange={url => setValue('photo_url', url)}
            />
          </div>

          {/* Row: plate + company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Placa *</label>
              <input {...register('plate')} placeholder="ABC-123"
                className={`${inputCls(!!errors.plate)} uppercase`} />
              {errors.plate && <p className="text-xs text-red-500 mt-1">{errors.plate.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Empresa *</label>
              <select {...register('company_id')} className={inputCls(!!errors.company_id)}>
                <option value="">Seleccionar empresa…</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.company_id && <p className="text-xs text-red-500 mt-1">{errors.company_id.message}</p>}
            </div>
          </div>

          {/* Row: brand + model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Marca</label>
              <input {...register('brand')} placeholder="Toyota, Mercedes…" className={inputCls(!!errors.brand)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Modelo</label>
              <input {...register('model')} placeholder="Coaster, Sprinter…" className={inputCls(!!errors.model)} />
            </div>
          </div>

          {/* Row: year + color + capacity */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Año</label>
              <input {...register('year', { valueAsNumber: true })} type="number"
                min={1990} max={new Date().getFullYear() + 1} placeholder="2020"
                className={inputCls(!!errors.year)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Color</label>
              <input {...register('color')} placeholder="Blanco" className={inputCls(!!errors.color)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Capacidad</label>
              <input {...register('capacity', { valueAsNumber: true })} type="number"
                min={1} max={100} placeholder="20"
                className={inputCls(!!errors.capacity)} />
              {errors.capacity && <p className="text-xs text-red-500 mt-1">{errors.capacity.message}</p>}
            </div>
          </div>

          {/* Row: soat + inspection + status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Venc. SOAT</label>
              <input {...register('soat_expires_at')} type="date" className={inputCls(!!errors.soat_expires_at)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Venc. Rev. Técnica</label>
              <input {...register('inspection_expires_at')} type="date" className={inputCls(!!errors.inspection_expires_at)} />
            </div>
            {mode === 'edit' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
                <select {...register('status')} className={inputCls(!!errors.status)}>
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                  <option value="MANTENIMIENTO">Mantenimiento</option>
                </select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting}
              className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              {isSubmitting ? 'Guardando…' : mode === 'create' ? 'Crear Vehículo' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
