import { useState } from 'react';
import { Menu, Bell, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_LABELS } from '../../lib/constants';
import { cn } from '../../lib/utils';

interface HeaderProps {
  onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden lg:block">
          <h1 className="text-base font-semibold text-[#1B4F72]">
            {user?.municipality?.name ?? 'Sistema de Fiscalización'}
          </h1>
        </div>
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-2">
        {/* Notificaciones */}
        <button className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1B4F72] text-white text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="font-medium text-gray-900 leading-none">{user?.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{user?.role ? ROLE_LABELS[user.role] : ''}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-gray-200 bg-white shadow-lg py-1">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <button
                  className={cn(
                    'flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600',
                    'hover:bg-red-50 transition-colors',
                  )}
                  onClick={() => { setDropdownOpen(false); logout(); }}
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
