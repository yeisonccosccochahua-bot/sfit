import { MapPin, Bus, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

const stats = [
  { label: 'Mis viajes hoy',  value: '—', Icon: MapPin, color: 'text-blue-600',  bg: 'bg-blue-50' },
  { label: 'Vehículos',       value: '—', Icon: Bus,    color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { label: 'Conductores',     value: '—', Icon: Users,  color: 'text-green-600', bg: 'bg-green-50' },
];

export function OperatorPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6 text-[#1B4F72]" />
          <h2 className="text-xl font-bold text-gray-900">Panel Operador</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-5">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`h-6 w-6 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Mis viajes</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 py-8 text-center">No hay viajes registrados hoy.</p>
        </CardContent>
      </Card>
    </div>
  );
}
