import { Link } from 'react-router-dom';
import { MapPinOff } from 'lucide-react';
import { Button } from '../components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#AED6F1]/30">
        <MapPinOff className="h-10 w-10 text-[#1B4F72]" />
      </div>
      <h1 className="text-5xl font-extrabold text-[#1B4F72]">404</h1>
      <p className="mt-2 text-lg font-medium text-gray-700">Página no encontrada</p>
      <p className="mt-1 text-sm text-gray-500">La ruta que busca no existe o fue movida.</p>
      <Link to="/" className="mt-6">
        <Button>Volver al inicio</Button>
      </Link>
    </div>
  );
}
