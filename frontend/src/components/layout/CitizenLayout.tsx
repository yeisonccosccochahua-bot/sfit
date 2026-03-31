import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, QrCode, FileText, User } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const tabs = [
  { to: '/citizen',          label: 'Inicio',      Icon: Home,     exact: true },
  { to: '/citizen/scan',     label: 'Escanear',    Icon: QrCode    },
  { to: '/citizen/reports',  label: 'Reportes',    Icon: FileText  },
  { to: '/citizen/profile',  label: 'Perfil',      Icon: User      },
];

export function CitizenLayout() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Top header */}
      <header className="sticky top-0 z-40 bg-[#1B4F72] text-white px-4 py-3 flex items-center justify-between shadow">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg tracking-wide">SFIT</span>
          <span className="text-xs text-blue-200 hidden sm:inline">Ciudadano</span>
        </div>
        {user && (
          <button
            onClick={() => navigate('/citizen/profile')}
            className="flex items-center gap-2 text-sm text-blue-100 hover:text-white transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </button>
        )}
      </header>

      {/* Page content — extra bottom padding so content isn't hidden under nav */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex">
          {tabs.map(({ to, label, Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors ${
                  isActive
                    ? 'text-[#1B4F72] font-semibold'
                    : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-6 w-6 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
