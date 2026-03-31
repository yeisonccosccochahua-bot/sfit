import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function MainLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        role={user.role}
        municipalityName={user.municipality?.name}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
