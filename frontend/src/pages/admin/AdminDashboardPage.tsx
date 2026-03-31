import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, Bus, Users, Route, ShieldAlert, Building2,
  Settings, UserCog, MapPin, ClipboardList, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Spinner } from '../../components/ui/spinner';
import { useAuthStore } from '../../stores/authStore';

interface DashboardStats {
  routes:    number;
  vehicles:  number;
  drivers:   number;
  sanctions: number;
  companies: number;
  users:     number;
}

interface AuditEntry {
  id:         string;
  user_name:  string;
  action:     string;
  entity:     string;
  created_at: string;
}

const quickLinks = [
  { to: '/admin/users',     label: 'Gestionar usuarios',  Icon: UserCog,     color: 'bg-blue-50 text-blue-700' },
  { to: '/admin/routes',    label: 'Gestionar rutas',     Icon: MapPin,      color: 'bg-indigo-50 text-indigo-700' },
  { to: '/admin/companies', label: 'Ver empresas',        Icon: Building2,   color: 'bg-green-50 text-green-700' },
  { to: '/admin/config',    label: 'Configuración',       Icon: Settings,    color: 'bg-amber-50 text-amber-700' },
  { to: '/admin/audit',     label: 'Registro de auditoría', Icon: ClipboardList, color: 'bg-purple-50 text-purple-700' },
];

export function AdminDashboardPage() {
  const { token, user } = useAuthStore();
  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [audit, setAudit]   = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch('/api/routes?limit=1',    { headers }).then(r => r.json()).catch(() => ({ total: 0 })),
      fetch('/api/vehicles?limit=1',  { headers }).then(r => r.json()).catch(() => ({ total: 0 })),
      fetch('/api/drivers?limit=1',   { headers }).then(r => r.json()).catch(() => ({ total: 0 })),
      fetch('/api/sanctions/stats',   { headers }).then(r => r.json()).catch(() => ({ active: 0 })),
      fetch('/api/companies?limit=1', { headers }).then(r => r.json()).catch(() => ({ total: 0 })),
      fetch('/api/users?limit=1',     { headers }).then(r => r.json()).catch(() => ({ total: 0 })),
      fetch('/api/audit?limit=5',     { headers }).then(r => r.json()).catch(() => ({ items: [] })),
    ]).then(([routes, vehicles, drivers, sanctions, companies, users, auditRes]) => {
      setStats({
        routes:    routes.total    ?? 0,
        vehicles:  vehicles.total  ?? 0,
        drivers:   drivers.total   ?? 0,
        sanctions: sanctions.active ?? 0,
        companies: companies.total  ?? 0,
        users:     users.total      ?? 0,
      });
      setAudit(auditRes.data ?? []);
    }).finally(() => setLoading(false));
  }, [token]);

  const statCards = [
    { label: 'Rutas activas',     value: stats?.routes    ?? '—', Icon: Route,      color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Vehículos',         value: stats?.vehicles  ?? '—', Icon: Bus,         color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Conductores',       value: stats?.drivers   ?? '—', Icon: Users,       color: 'text-green-600',  bg: 'bg-green-50' },
    { label: 'Sanciones activas', value: stats?.sanctions ?? '—', Icon: ShieldAlert, color: 'text-red-600',    bg: 'bg-red-50' },
    { label: 'Empresas',          value: stats?.companies ?? '—', Icon: Building2,   color: 'text-amber-600',  bg: 'bg-amber-50' },
    { label: 'Usuarios del sistema', value: stats?.users  ?? '—', Icon: UserCog,     color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-[#1B4F72]" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Panel Administrativo</h2>
          <p className="text-sm text-gray-500">{user?.municipality?.name ?? 'Municipalidad'}</p>
        </div>
      </div>

      {/* KPI Grid */}
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {statCards.map(({ label, value, Icon, color, bg }) => (
            <Card key={label}>
              <CardContent className="flex flex-col items-center gap-2 pt-5 pb-4 text-center">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500 leading-tight">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick access */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Acceso rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {quickLinks.map(({ to, label, Icon, color }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-gray-800">{label}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Recent audit */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Actividad reciente</CardTitle>
            <Link to="/admin/audit" className="text-xs text-[#2E86C1] hover:underline">Ver todo</Link>
          </CardHeader>
          <CardContent className="pt-0">
            {audit.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">Sin actividad registrada.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {audit.map(entry => (
                  <li key={entry.id} className="flex items-start justify-between py-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{entry.action}</p>
                      <p className="text-xs text-gray-500">{entry.entity} · {entry.user_name}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      {new Date(entry.created_at).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
