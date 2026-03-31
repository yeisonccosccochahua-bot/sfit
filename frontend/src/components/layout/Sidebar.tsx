import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Bus, Route, Building2, Users, FileText,
  ShieldAlert, QrCode, MapPin, Star, ClipboardList,
  UserCog, Activity, X, Settings, Truck, ClipboardPlus,
  BarChart3, Search,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { UserRole } from '../../types';

interface NavItem { label: string; to: string; Icon: React.FC<any> }

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  [UserRole.ADMIN_MUNICIPAL]: [
    { label: 'Dashboard',    to: '/admin',            Icon: LayoutDashboard },
    { label: 'Rutas',        to: '/admin/routes',     Icon: Route },
    { label: 'Empresas',     to: '/admin/companies',  Icon: Building2 },
    { label: 'Conductores',  to: '/admin/drivers',    Icon: Users },
    { label: 'Vehículos',    to: '/admin/vehicles',   Icon: Bus },
    { label: 'Usuarios',     to: '/admin/users',      Icon: UserCog },
    { label: 'Auditoría',    to: '/admin/audit',      Icon: ClipboardList },
    { label: 'Configuración',to: '/admin/config',     Icon: Settings },
  ],
  [UserRole.FISCAL]: [
    { label: 'Dashboard',    to: '/dashboard',              Icon: LayoutDashboard },
    { label: 'Conductores',  to: '/dashboard/drivers',      Icon: Users },
    { label: 'Reportes',     to: '/dashboard/reports',      Icon: FileText },
    { label: 'Sanciones',    to: '/dashboard/sanctions',    Icon: ShieldAlert },
    { label: 'Rutas',        to: '/dashboard/routes',       Icon: Route },
    { label: 'Empresas',     to: '/dashboard/companies',    Icon: Building2 },
    { label: 'Analíticas',   to: '/dashboard/analytics',    Icon: Activity },
  ],
  [UserRole.OPERADOR_EMPRESA]: [
    { label: 'Dashboard',        to: '/operator',              Icon: LayoutDashboard },
    { label: 'Calendario',       to: '/operator/schedule',     Icon: MapPin },
    { label: 'Registrar Viaje',  to: '/operator/trips/new',    Icon: ClipboardPlus },
    { label: 'Mis Viajes',       to: '/operator/trips',        Icon: ClipboardList },
    { label: 'Conductores',      to: '/operator/drivers',      Icon: Users },
    { label: 'Vehículos',        to: '/operator/vehicles',     Icon: Bus },
  ],
  [UserRole.CIUDADANO]: [
    { label: 'Escanear QR',  to: '/citizen',              Icon: QrCode },
    { label: 'Mis Reportes', to: '/citizen/reports',      Icon: FileText },
    { label: 'Ranking',      to: '/citizen/ranking',      Icon: Star },
  ],
  [UserRole.INSPECTOR]: [
    { label: 'Dashboard',        to: '/inspector',                Icon: LayoutDashboard },
    { label: 'Escanear QR',      to: '/inspector/scan',           Icon: QrCode },
    { label: 'Viajes Activos',   to: '/inspector/viajes-activos', Icon: Truck },
    { label: 'Nueva Inspección', to: '/inspector/inspections/new', Icon: ClipboardPlus },
    { label: 'Mis Inspecciones', to: '/inspector/inspections',    Icon: ClipboardList },
    { label: 'Buscar Conductor', to: '/inspector/lookup/driver',  Icon: Search },
    { label: 'Buscar Vehículo',  to: '/inspector/lookup/vehicle', Icon: Bus },
    { label: 'Estadísticas',     to: '/inspector/stats',          Icon: BarChart3 },
  ],
};

interface SidebarProps {
  role: UserRole;
  municipalityName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ role, municipalityName, isOpen, onClose }: SidebarProps) {
  const items = NAV_BY_ROLE[role] ?? [];

  return (
    <>
      {/* Overlay móvil */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-[#1B4F72] text-white transition-transform duration-300',
          'lg:relative lg:translate-x-0 lg:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-[#2E86C1]/40">
          <div>
            <div className="flex items-center gap-2">
              <Bus className="h-7 w-7 text-[#AED6F1]" />
              <span className="text-xl font-bold tracking-wide">SFIT</span>
            </div>
            {municipalityName && (
              <p className="text-xs text-[#AED6F1] mt-1 leading-tight">{municipalityName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="lg:hidden rounded-md p-1 hover:bg-[#2E86C1]/30"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {items.map(({ label, to, Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to.split('/').length <= 2}
                  onClick={() => window.innerWidth < 1024 && onClose()}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-[#2E86C1] text-white'
                        : 'text-[#AED6F1] hover:bg-[#2E86C1]/30 hover:text-white',
                    )
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#2E86C1]/40">
          <p className="text-xs text-[#AED6F1]">SFIT © 2026</p>
          <p className="text-xs text-[#AED6F1]">Sistema Fiscalización Transporte</p>
        </div>
      </aside>
    </>
  );
}
