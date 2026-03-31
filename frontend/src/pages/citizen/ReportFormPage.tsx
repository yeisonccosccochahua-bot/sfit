import { useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { Report } from '../../types';

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  type: z.enum([
    'CONDUCTOR_DIFERENTE',
    'CONDICION_VEHICULO',
    'CONDUCCION_PELIGROSA',
    'EXCESO_VELOCIDAD',
    'OTRO',
  ]),
  description: z.string().min(20, 'Mínimo 20 caracteres').max(1000, 'Máximo 1000 caracteres'),
});

type FormValues = z.infer<typeof schema>;

const REPORT_TYPE_OPTIONS = [
  { value: 'CONDUCTOR_DIFERENTE',  label: 'Conductor diferente' },
  { value: 'CONDICION_VEHICULO',   label: 'Condición del vehículo' },
  { value: 'CONDUCCION_PELIGROSA', label: 'Conducción peligrosa' },
  { value: 'EXCESO_VELOCIDAD',     label: 'Exceso de velocidad' },
  { value: 'OTRO',                 label: 'Otro' },
];

export function ReportFormPage() {
  const { tripId }  = useParams<{ tripId: string }>();
  const location    = useLocation();
  const navigate    = useNavigate();
  const { user, setUser } = useAuthStore();

  const isSameDriver    = location.state?.isSameDriver ?? true;
  const preselectedType = location.state?.preselectedType ?? 'OTRO';
  const qrCode          = location.state?.qrCode ?? '';

  const reportsToday  = user?.reports_today ?? 0;
  const limitReached  = reportsToday >= 3;

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [success, setSuccess]           = useState<{ points: number } | null>(null);
  const [apiError, setApiError]         = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type:        preselectedType as FormValues['type'],
      description: isSameDriver ? '' : 'El conductor que opera el vehículo no coincide con el registrado en el sistema.',
    },
  });

  const description = watch('description') ?? '';

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function onSubmit(values: FormValues) {
    if (limitReached || submitting) return;
    setSubmitting(true);
    setApiError('');

    try {
      await api.post<Report>('/api/reports', {
        trip_id:        tripId,
        qr_code:        qrCode,
        type:           values.type,
        description:    values.description,
        is_same_driver: isSameDriver,
      });

      // Update user points in store
      if (user) {
        setUser({
          ...user,
          total_points:  (user.total_points ?? 0) + 10,
          reports_today: (user.reports_today ?? 0) + 1,
        });
      }

      setSuccess({ points: 10 });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error al enviar el reporte. Intenta de nuevo.';
      setApiError(Array.isArray(msg) ? msg.join(' ') : msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success screen ───────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center gap-5">
        <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">¡Reporte enviado!</h2>
          <p className="text-gray-500 mt-2">Tu reporte fue recibido y está en revisión.</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-6 py-4">
          <p className="text-amber-700 font-semibold text-lg">+{success.points} puntos</p>
          <p className="text-amber-600 text-sm">sumados a tu cuenta</p>
        </div>
        <p className="text-xs text-gray-400">
          Reportes realizados hoy: {(user?.reports_today ?? 0)} de 3
        </p>
        <button
          onClick={() => navigate('/citizen')}
          className="w-full max-w-xs py-3 bg-[#1B4F72] text-white rounded-xl font-semibold hover:bg-[#154060] transition-colors"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reportar problema</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Reportes hoy:&nbsp;
          <span className={`font-semibold ${limitReached ? 'text-red-600' : 'text-gray-700'}`}>
            {reportsToday} de 3
          </span>
        </p>
      </div>

      {limitReached && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm font-medium">
            Límite diario alcanzado. Podrás reportar de nuevo mañana.
          </p>
        </div>
      )}

      {!isSameDriver && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <p className="text-amber-700 text-sm">
            Conductor diferente al registrado — alerta automática enviada a la fiscalización.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Tipo de problema *
          </label>
          <select
            {...register('type')}
            disabled={limitReached}
            className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-[#1B4F72] bg-white disabled:bg-gray-100"
          >
            {REPORT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Descripción *
          </label>
          <textarea
            {...register('description')}
            disabled={limitReached}
            rows={4}
            placeholder="Describe el problema con al menos 20 caracteres…"
            className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-[#1B4F72] resize-none disabled:bg-gray-100"
          />
          <div className="flex justify-between mt-1">
            {errors.description ? (
              <p className="text-xs text-red-500">{errors.description.message}</p>
            ) : (
              <span />
            )}
            <span className={`text-xs ${description.length < 20 ? 'text-amber-500' : 'text-gray-400'}`}>
              {description.length}/1000
            </span>
          </div>
        </div>

        {/* Photo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Foto (opcional)
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
            disabled={limitReached}
          />
          {photoPreview ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src={photoPreview} alt="Preview" className="w-full max-h-48 object-cover" />
              <button
                type="button"
                onClick={() => { setPhotoPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full h-7 w-7 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={limitReached}
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-6
                         flex flex-col items-center gap-2 text-gray-400 hover:border-[#2E86C1]
                         hover:text-[#2E86C1] transition-colors disabled:opacity-50"
            >
              <Camera className="h-7 w-7" />
              <span className="text-sm">Tomar o adjuntar foto</span>
            </button>
          )}
        </div>

        {apiError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-sm">{apiError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={limitReached || submitting}
          className="w-full py-4 bg-[#1B4F72] hover:bg-[#154060] text-white rounded-xl
                     font-semibold flex items-center justify-center gap-2 transition-colors
                     disabled:opacity-60 active:scale-95"
        >
          {submitting ? (
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
          {submitting ? 'Enviando…' : 'Enviar reporte'}
        </button>
      </form>
    </div>
  );
}
