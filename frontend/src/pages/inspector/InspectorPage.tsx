import { LayoutDashboard, Activity, QrCode } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

const stats = [
  { label: 'Viajes activos',   value: '—', Icon: Activity, color: 'text-green-600', bg: 'bg-green-50' },
  { label: 'QR verificados hoy', value: '—', Icon: QrCode,   color: 'text-blue-600',  bg: 'bg-blue-50' },
];

export function InspectorPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-[#1B4F72]" />
        <h2 className="text-xl font-bold text-gray-900">Panel Inspector</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <CardHeader><CardTitle>Viajes activos</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 py-8 text-center">No hay viajes activos en este momento.</p>
        </CardContent>
      </Card>
    </div>
  );
}
