import { useEffect, useState } from 'react';
import { Settings, Save, Info } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Spinner } from '../../components/ui/spinner';
import { useAuthStore } from '../../stores/authStore';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const sanctionSchema = z.object({
  l1_threshold: z.coerce.number().min(1).max(10),
  l2_threshold: z.coerce.number().min(1).max(20),
  l3_threshold: z.coerce.number().min(1).max(50),
  l4_threshold: z.coerce.number().min(1).max(100),
});

const reputationSchema = z.object({
  weight_fatigue:  z.coerce.number().min(0).max(100),
  weight_reports:  z.coerce.number().min(0).max(100),
  weight_incidents:z.coerce.number().min(0).max(100),
}).refine(d => d.weight_fatigue + d.weight_reports + d.weight_incidents === 100, {
  message: 'Los pesos deben sumar exactamente 100%',
  path: ['weight_fatigue'],
});

const fatigueSchema = z.object({
  max_hours_24h:        z.coerce.number().min(1).max(24),
  min_rest_hours:       z.coerce.number().min(1).max(12),
  warning_hours_24h:    z.coerce.number().min(1).max(20),
});

type SanctionForm   = z.infer<typeof sanctionSchema>;
type ReputationForm = z.infer<typeof reputationSchema>;
type FatigueForm    = z.infer<typeof fatigueSchema>;

// ─── Defaults ─────────────────────────────────────────────────────────────────

const SANCTION_DEFAULTS:   SanctionForm   = { l1_threshold: 1, l2_threshold: 3, l3_threshold: 5, l4_threshold: 8 };
const REPUTATION_DEFAULTS: ReputationForm = { weight_fatigue: 40, weight_reports: 30, weight_incidents: 30 };
const FATIGUE_DEFAULTS:    FatigueForm    = { max_hours_24h: 10, min_rest_hours: 8, warning_hours_24h: 8 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-800">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function FieldRow({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:items-start">
      <div className="sm:pt-2">
        <Label className="text-sm font-medium text-gray-700">{label}</Label>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="sm:col-span-2">
        {children}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConfigPage() {
  const { token, user } = useAuthStore();
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<string | null>(null);
  const [toast,    setToast]    = useState<{ ok: boolean; msg: string } | null>(null);

  const sanctionForm   = useForm<SanctionForm>({   resolver: zodResolver(sanctionSchema),   defaultValues: SANCTION_DEFAULTS });
  const reputationForm = useForm<ReputationForm>({ resolver: zodResolver(reputationSchema), defaultValues: REPUTATION_DEFAULTS });
  const fatigueForm    = useForm<FatigueForm>({    resolver: zodResolver(fatigueSchema),    defaultValues: FATIGUE_DEFAULTS });

  // Weights sum live
  const [wf, wr, wi] = reputationForm.watch(['weight_fatigue', 'weight_reports', 'weight_incidents']);
  const weightsSum = (+wf || 0) + (+wr || 0) + (+wi || 0);

  useEffect(() => {
    fetch(`/api/municipalities/${user?.municipality_id}/config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(cfg => {
        if (!cfg) return;
        const s = cfg.sanctions ?? {};
        const r = cfg.reputation ?? {};
        const f = cfg.fatigue ?? {};
        sanctionForm.reset({
          l1_threshold: s.l1_threshold ?? SANCTION_DEFAULTS.l1_threshold,
          l2_threshold: s.l2_threshold ?? SANCTION_DEFAULTS.l2_threshold,
          l3_threshold: s.l3_threshold ?? SANCTION_DEFAULTS.l3_threshold,
          l4_threshold: s.l4_threshold ?? SANCTION_DEFAULTS.l4_threshold,
        });
        reputationForm.reset({
          weight_fatigue:   r.weight_fatigue   ?? REPUTATION_DEFAULTS.weight_fatigue,
          weight_reports:   r.weight_reports   ?? REPUTATION_DEFAULTS.weight_reports,
          weight_incidents: r.weight_incidents ?? REPUTATION_DEFAULTS.weight_incidents,
        });
        fatigueForm.reset({
          max_hours_24h:     f.max_hours_24h     ?? FATIGUE_DEFAULTS.max_hours_24h,
          min_rest_hours:    f.min_rest_hours    ?? FATIGUE_DEFAULTS.min_rest_hours,
          warning_hours_24h: f.warning_hours_24h ?? FATIGUE_DEFAULTS.warning_hours_24h,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, user?.municipality_id]);

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const save = (section: string, payload: object) => async () => {
    setSaving(section);
    try {
      const res = await fetch(`/api/municipalities/${user?.municipality_id}/config`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ [section]: payload }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Error al guardar');
      showToast(true, 'Configuración guardada correctamente.');
    } catch (e: any) {
      showToast(false, e.message ?? 'Error inesperado.');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-[#1B4F72]" />
        <h2 className="text-xl font-bold text-gray-900">Configuración Municipal</h2>
      </div>

      {toast && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${
          toast.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          <Info className="h-4 w-4 shrink-0" />
          {toast.msg}
        </div>
      )}

      {/* ── Sanction thresholds ─────────────────────────────────────────── */}
      <Section title="Umbrales de Sanciones">
        <form
          onSubmit={sanctionForm.handleSubmit((data) => save('sanctions', data)())}
          className="space-y-4"
        >
          <p className="text-xs text-gray-500 flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Número de incidentes acumulados que activan cada nivel de sanción.
          </p>
          {(['l1','l2','l3','l4'] as const).map((lvl, i) => (
            <FieldRow
              key={lvl}
              label={`Nivel ${i+1}`}
              hint={['Advertencia','Suspensión temporal','Suspensión prolongada','Inhabilitación'][i]}
              error={sanctionForm.formState.errors[`${lvl}_threshold`]?.message}
            >
              <Input
                type="number"
                min={1}
                {...sanctionForm.register(`${lvl}_threshold`)}
                className="max-w-[120px]"
              />
            </FieldRow>
          ))}
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving === 'sanctions'} size="sm">
              {saving === 'sanctions' ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4 mr-1.5" />}
              Guardar umbrales
            </Button>
          </div>
        </form>
      </Section>

      {/* ── Reputation weights ──────────────────────────────────────────── */}
      <Section title="Pesos de Reputación de Conductores">
        <form
          onSubmit={reputationForm.handleSubmit((data) => save('reputation', data)())}
          className="space-y-4"
        >
          <p className="text-xs text-gray-500 flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Los tres pesos deben sumar exactamente 100%.
          </p>
          {([
            { key: 'weight_fatigue',   label: 'Fatiga',             hint: 'Resultado de controles de fatiga' },
            { key: 'weight_reports',   label: 'Reportes ciudadanos', hint: 'Validez de reportes recibidos' },
            { key: 'weight_incidents', label: 'Incidentes / Sanciones', hint: 'Número y gravedad de sanciones' },
          ] as const).map(({ key, label, hint }) => (
            <FieldRow
              key={key}
              label={label}
              hint={hint}
              error={reputationForm.formState.errors[key]?.message}
            >
              <div className="flex items-center gap-2 max-w-[180px]">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  {...reputationForm.register(key)}
                  className="text-right"
                />
                <span className="text-sm text-gray-500 shrink-0">%</span>
              </div>
            </FieldRow>
          ))}
          <div className={`rounded-md px-3 py-2 text-sm font-medium w-fit ${
            weightsSum === 100 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}>
            Suma: {weightsSum}%{weightsSum !== 100 && ' — debe ser 100%'}
          </div>
          {reputationForm.formState.errors.weight_fatigue?.message?.includes('100') && (
            <p className="text-xs text-red-600">{reputationForm.formState.errors.weight_fatigue.message}</p>
          )}
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving === 'reputation' || weightsSum !== 100} size="sm">
              {saving === 'reputation' ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4 mr-1.5" />}
              Guardar pesos
            </Button>
          </div>
        </form>
      </Section>

      {/* ── Fatigue rules ───────────────────────────────────────────────── */}
      <Section title="Reglas de Fatiga">
        <form
          onSubmit={fatigueForm.handleSubmit((data) => save('fatigue', data)())}
          className="space-y-4"
        >
          <FieldRow
            label="Horas máx. en 24h"
            hint="El conductor queda NO APTO al superar este límite"
            error={fatigueForm.formState.errors.max_hours_24h?.message}
          >
            <div className="flex items-center gap-2 max-w-[180px]">
              <Input type="number" min={1} max={24} {...fatigueForm.register('max_hours_24h')} className="text-right" />
              <span className="text-sm text-gray-500 shrink-0">h</span>
            </div>
          </FieldRow>
          <FieldRow
            label="Horas de alerta"
            hint="El conductor entra en estado RIESGO al superar este límite"
            error={fatigueForm.formState.errors.warning_hours_24h?.message}
          >
            <div className="flex items-center gap-2 max-w-[180px]">
              <Input type="number" min={1} max={20} {...fatigueForm.register('warning_hours_24h')} className="text-right" />
              <span className="text-sm text-gray-500 shrink-0">h</span>
            </div>
          </FieldRow>
          <FieldRow
            label="Descanso mínimo"
            hint="Horas de descanso requeridas antes del siguiente turno"
            error={fatigueForm.formState.errors.min_rest_hours?.message}
          >
            <div className="flex items-center gap-2 max-w-[180px]">
              <Input type="number" min={1} max={12} {...fatigueForm.register('min_rest_hours')} className="text-right" />
              <span className="text-sm text-gray-500 shrink-0">h</span>
            </div>
          </FieldRow>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving === 'fatigue'} size="sm">
              {saving === 'fatigue' ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4 mr-1.5" />}
              Guardar reglas de fatiga
            </Button>
          </div>
        </form>
      </Section>
    </div>
  );
}
