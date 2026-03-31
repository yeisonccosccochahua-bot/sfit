import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, Users, Bus, Phone, Mail, User, Hash,
  ChevronLeft, ChevronRight, Search, RefreshCw, QrCode, Download,
  Shield, Car,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { UserRole } from '../../types';

/* ── Types ── */
type CompanyStatus = 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO';
type DriverStatus  = 'APTO' | 'RIESGO' | 'NO_APTO';
type VehicleStatus = 'ACTIVO' | 'INACTIVO' | 'EN_MANTENIMIENTO' | 'SUSPENDIDO';

interface Company {
  id: string;
  ruc: string;
  name: string;
  address?: string;
  license?: string;
  phone?: string;
  email?: string;
  representative?: string;
  representative_dni?: string;
  status: CompanyStatus;
  reputation_score: number;
  driver_count: number;
  vehicle_count: number;
  created_at: string;
}

interface Driver {
  id: string;
  dni: string;
  name: string;
  license_number?: string;
  license_category?: string;
  license_expires_at?: string;
  phone?: string;
  email?: string;
  photo_url?: string;
  status: DriverStatus;
  reputation_score: number;
  company: { id: string; name: string };
}

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
  company: { id: string; name: string };
}

/* ── Helpers ── */
const COMPANY_STATUS_COLORS: Record<CompanyStatus, string> = {
  ACTIVO:    'bg-green-100 text-green-800',
  INACTIVO:  'bg-gray-100 text-gray-600',
  SUSPENDIDO:'bg-red-100 text-red-800',
};

const DRIVER_STATUS_COLORS: Record<DriverStatus, string> = {
  APTO:    'bg-green-100 text-green-800',
  RIESGO:  'bg-yellow-100 text-yellow-800',
  NO_APTO: 'bg-red-100 text-red-800',
};

const VEHICLE_STATUS_COLORS: Record<VehicleStatus, string> = {
  ACTIVO:          'bg-green-100 text-green-800',
  INACTIVO:        'bg-gray-100 text-gray-600',
  EN_MANTENIMIENTO:'bg-yellow-100 text-yellow-800',
  SUSPENDIDO:      'bg-red-100 text-red-800',
};

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

type Tab = 'info' | 'drivers' | 'vehicles';

/* ── QrMiniModal ── */
function QrMiniModal({ vehicleId, plate, onClose }: { vehicleId: string; plate: string; onClose: () => void }) {
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/vehicles/${vehicleId}/qr`)
      .then(r => r.blob())
      .then(b => setQrSrc(URL.createObjectURL(b)))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => { if (qrSrc?.startsWith('blob:')) URL.revokeObjectURL(qrSrc); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  async function download() {
    const res = await fetch(`/api/vehicles/${vehicleId}/qr`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `qr-${plate}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xs p-5 flex flex-col items-center gap-4">
        <p className="font-semibold text-gray-900">QR — {plate}</p>
        {loading
          ? <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
          : qrSrc
            ? <img src={qrSrc} alt="QR" className="w-48 h-48 rounded-lg border border-gray-200" />
            : <p className="text-sm text-red-500">Error al cargar QR</p>}
        <div className="flex gap-2 w-full">
          <button onClick={onClose}
            className="flex-1 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cerrar</button>
          <button onClick={download} disabled={!qrSrc}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> Descargar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main ── */
export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canEdit = user?.role === UserRole.ADMIN_MUNICIPAL;

  const [company, setCompany] = useState<Company | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [tab, setTab] = useState<Tab>('info');

  // Drivers tab state
  const [drivers, setDrivers]         = useState<Driver[]>([]);
  const [driverTotal, setDriverTotal] = useState(0);
  const [driverPage, setDriverPage]   = useState(1);
  const [driverSearch, setDriverSearch] = useState('');
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  // Vehicles tab state
  const [vehicles, setVehicles]         = useState<Vehicle[]>([]);
  const [vehicleTotal, setVehicleTotal] = useState(0);
  const [vehiclePage, setVehiclePage]   = useState(1);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  const [qrVehicle, setQrVehicle] = useState<{ id: string; plate: string } | null>(null);

  const LIMIT = 10;

  /* Load company */
  useEffect(() => {
    if (!id) return;
    setLoadingCompany(true);
    fetch(`/api/companies/${id}`)
      .then(r => r.json())
      .then(j => setCompany(j))
      .catch(() => {})
      .finally(() => setLoadingCompany(false));
  }, [id]);

  /* Load drivers */
  const loadDrivers = useCallback(async (p = driverPage) => {
    if (!id) return;
    setLoadingDrivers(true);
    try {
      const params = new URLSearchParams({
        company_id: id, page: String(p), limit: String(LIMIT),
        ...(driverSearch && { search: driverSearch }),
      });
      const res = await fetch(`/api/drivers?${params}`);
      const j = await res.json();
      setDrivers(j.data ?? []);
      setDriverTotal(j.total ?? 0);
    } finally {
      setLoadingDrivers(false);
    }
  }, [id, driverPage, driverSearch]);

  /* Load vehicles */
  const loadVehicles = useCallback(async (p = vehiclePage) => {
    if (!id) return;
    setLoadingVehicles(true);
    try {
      const params = new URLSearchParams({
        company_id: id, page: String(p), limit: String(LIMIT),
        ...(vehicleSearch && { search: vehicleSearch }),
      });
      const res = await fetch(`/api/vehicles?${params}`);
      const j = await res.json();
      setVehicles(j.data ?? []);
      setVehicleTotal(j.total ?? 0);
    } finally {
      setLoadingVehicles(false);
    }
  }, [id, vehiclePage, vehicleSearch]);

  useEffect(() => { if (tab === 'drivers')  loadDrivers(); },  [tab, loadDrivers]);
  useEffect(() => { if (tab === 'vehicles') loadVehicles(); }, [tab, loadVehicles]);

  if (loadingCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-7 w-7 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-500">Empresa no encontrada</p>
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline">Volver</button>
      </div>
    );
  }

  const driverTotalPages  = Math.ceil(driverTotal / LIMIT);
  const vehicleTotalPages = Math.ceil(vehicleTotal / LIMIT);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 shrink-0 mt-0.5">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${COMPANY_STATUS_COLORS[company.status]}`}>
              {company.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">RUC {company.ruc}</p>
        </div>
        {canEdit && (
          <button
            onClick={() => navigate(`/admin/companies`)}
            className="shrink-0 text-sm text-blue-600 hover:underline"
          >
            Editar empresa
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Building2 className="h-5 w-5 text-blue-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Reputación</p>
            <p className="text-lg font-bold text-gray-900">{company.reputation_score}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-green-50 rounded-lg"><Users className="h-5 w-5 text-green-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Conductores</p>
            <p className="text-lg font-bold text-gray-900">{company.driver_count}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg"><Bus className="h-5 w-5 text-purple-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Vehículos</p>
            <p className="text-lg font-bold text-gray-900">{company.vehicle_count}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {(['info', 'drivers', 'vehicles'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                tab === t
                  ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t === 'info' ? 'Información' : t === 'drivers' ? `Conductores (${company.driver_count})` : `Vehículos (${company.vehicle_count})`}
            </button>
          ))}
        </div>

        {/* Info Tab */}
        {tab === 'info' && (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <InfoRow icon={<Building2 className="h-4 w-4" />} label="Razón Social" value={company.name} />
            <InfoRow icon={<Hash className="h-4 w-4" />}      label="RUC"          value={company.ruc} />
            <InfoRow icon={<Building2 className="h-4 w-4" />} label="Dirección"    value={company.address} />
            <InfoRow icon={<Shield className="h-4 w-4" />}    label="Licencia"     value={company.license} />
            <InfoRow icon={<Phone className="h-4 w-4" />}     label="Teléfono"     value={company.phone} />
            <InfoRow icon={<Mail className="h-4 w-4" />}      label="Email"        value={company.email} />
            <InfoRow icon={<User className="h-4 w-4" />}      label="Representante Legal" value={company.representative} />
            <InfoRow icon={<Hash className="h-4 w-4" />}      label="DNI Representante"   value={company.representative_dni} />
            <InfoRow icon={<Building2 className="h-4 w-4" />} label="Fecha de Registro"
              value={new Date(company.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })} />
          </div>
        )}

        {/* Drivers Tab */}
        {tab === 'drivers' && (
          <div>
            <div className="p-4 border-b border-gray-100 flex gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Buscar por nombre o DNI…"
                  value={driverSearch}
                  onChange={e => setDriverSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { setDriverPage(1); loadDrivers(1); } }}
                />
              </div>
              <button onClick={() => { setDriverPage(1); loadDrivers(1); }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Buscar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Conductor</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">DNI</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Licencia</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Venc. Licencia</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Rep.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingDrivers ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">Cargando…</td></tr>
                  ) : drivers.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">No hay conductores</td></tr>
                  ) : drivers.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 overflow-hidden">
                            {d.photo_url
                              ? <img src={d.photo_url} alt={d.name} className="w-full h-full object-cover" />
                              : <span className="text-xs font-semibold text-blue-700">{d.name.charAt(0)}</span>}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{d.name}</p>
                            {d.email && <p className="text-xs text-gray-500">{d.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700">{d.dni}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {d.license_number ?? '—'}
                        {d.license_category && <span className="ml-1 text-xs text-gray-400">({d.license_category})</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={expiryClass(d.license_expires_at)}>{fmtDate(d.license_expires_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${DRIVER_STATUS_COLORS[d.status]}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-semibold">{d.reputation_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {driverTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-600">Página {driverPage} de {driverTotalPages}</p>
                <div className="flex gap-1">
                  <button onClick={() => setDriverPage(p => p - 1)} disabled={driverPage === 1}
                    className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setDriverPage(p => p + 1)} disabled={driverPage === driverTotalPages}
                    className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vehicles Tab */}
        {tab === 'vehicles' && (
          <div>
            <div className="p-4 border-b border-gray-100 flex gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Buscar por placa, marca o modelo…"
                  value={vehicleSearch}
                  onChange={e => setVehicleSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { setVehiclePage(1); loadVehicles(1); } }}
                />
              </div>
              <button onClick={() => { setVehiclePage(1); loadVehicles(1); }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Buscar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Vehículo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Placa</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Capacidad</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">SOAT</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Rev. Técnica</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">QR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingVehicles ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">Cargando…</td></tr>
                  ) : vehicles.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">No hay vehículos</td></tr>
                  ) : vehicles.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-8 rounded bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden border border-gray-200">
                            {v.photo_url
                              ? <img src={v.photo_url} alt={v.plate} className="w-full h-full object-cover" />
                              : <Car className="h-4 w-4 text-gray-400" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</p>
                            {v.year && <p className="text-xs text-gray-500">{v.year}{v.color ? ` · ${v.color}` : ''}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800">{v.plate}</td>
                      <td className="px-4 py-3 text-gray-700">{v.capacity ? `${v.capacity} pas.` : '—'}</td>
                      <td className="px-4 py-3"><span className={expiryClass(v.soat_expires_at)}>{fmtDate(v.soat_expires_at)}</span></td>
                      <td className="px-4 py-3"><span className={expiryClass(v.inspection_expires_at)}>{fmtDate(v.inspection_expires_at)}</span></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${VEHICLE_STATUS_COLORS[v.status]}`}>
                          {v.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setQrVehicle({ id: v.id, plate: v.plate })}
                          className="p-1.5 rounded hover:bg-blue-50 text-blue-600">
                          <QrCode className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {vehicleTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-600">Página {vehiclePage} de {vehicleTotalPages}</p>
                <div className="flex gap-1">
                  <button onClick={() => setVehiclePage(p => p - 1)} disabled={vehiclePage === 1}
                    className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setVehiclePage(p => p + 1)} disabled={vehiclePage === vehicleTotalPages}
                    className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR mini modal */}
      {qrVehicle && <QrMiniModal vehicleId={qrVehicle.id} plate={qrVehicle.plate} onClose={() => setQrVehicle(null)} />}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value || <span className="text-gray-400 font-normal">—</span>}</p>
      </div>
    </div>
  );
}
