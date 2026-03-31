import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { Button } from '../components/ui/button';

export function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
        <ShieldOff className="h-10 w-10 text-red-500" />
      </div>
      <h1 className="text-5xl font-extrabold text-red-500">403</h1>
      <p className="mt-2 text-lg font-medium text-gray-700">Acceso denegado</p>
      <p className="mt-1 text-sm text-gray-500">No tiene permisos para ver esta página.</p>
      <Link to="/" className="mt-6">
        <Button variant="secondary">Regresar</Button>
      </Link>
    </div>
  );
}
