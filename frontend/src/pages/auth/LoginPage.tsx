import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bus, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert } from '../../components/ui/alert';

const schema = z.object({
  email: z.string().email('Ingrese un correo válido'),
  password: z.string().min(1, 'Ingrese su contraseña'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      await login(data.email, data.password);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Credenciales inválidas. Intente nuevamente.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1B4F72] to-[#2E86C1] px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-[#1B4F72] px-8 py-7 text-white text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/15 mb-3">
              <Bus className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-wide">SFIT</h1>
            <p className="mt-1 text-sm text-[#AED6F1]">Sistema de Fiscalización Inteligente de Transporte</p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">Iniciar sesión</h2>

            {error && (
              <Alert variant="error" className="mb-5">
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="usuario@municipio.gob.pe"
                  {...register('email')}
                  error={errors.email?.message}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...register('password')}
                    error={errors.password?.message}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" loading={isSubmitting}>
                Ingresar
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              ¿Ciudadano?{' '}
              <Link to="/register" className="font-medium text-[#2E86C1] hover:text-[#1B4F72]">
                Regístrese aquí
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/60">
          SFIT © 2026 · Apurímac, Perú
        </p>
      </div>
    </div>
  );
}
