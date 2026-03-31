import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bus } from 'lucide-react';
import api from '../../services/api';
import { MUNICIPALITIES } from '../../lib/constants';
import { UserRole } from '../../types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert } from '../../components/ui/alert';

const schema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres'),
  email: z.string().email('Correo inválido'),
  dni: z.string().regex(/^\d{8}$/, 'DNI debe tener 8 dígitos'),
  phone: z.string().regex(/^\+?[0-9]{9,15}$/, 'Teléfono inválido').optional().or(z.literal('')),
  municipality_id: z.string().uuid('Seleccione una municipalidad'),
  password: z
    .string()
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
      'Mínimo 8 caracteres, una mayúscula, una minúscula y un número',
    ),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      const { confirmPassword, ...payload } = data;
      await api.post('/api/auth/register', { ...payload, role: UserRole.CIUDADANO });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : (msg ?? 'Error al registrarse.'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1B4F72] to-[#2E86C1] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
          <div className="bg-[#1B4F72] px-8 py-6 text-white text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15 mb-2">
              <Bus className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold">SFIT</h1>
            <p className="mt-0.5 text-sm text-[#AED6F1]">Registro de Ciudadano</p>
          </div>

          <div className="px-8 py-7">
            {success ? (
              <Alert variant="success" title="¡Registro exitoso!">
                Su cuenta ha sido creada. Redirigiendo al login…
              </Alert>
            ) : (
              <>
                {error && <Alert variant="error" className="mb-5">{error}</Alert>}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nombre completo</Label>
                    <Input id="name" placeholder="Juan Mamani Quispe" {...register('name')} error={errors.name?.message} className="mt-1" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="dni">DNI</Label>
                      <Input id="dni" placeholder="12345678" maxLength={8} {...register('dni')} error={errors.dni?.message} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input id="phone" placeholder="+51 999 888 777" {...register('phone')} error={errors.phone?.message} className="mt-1" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Correo electrónico</Label>
                    <Input id="email" type="email" placeholder="correo@ejemplo.com" {...register('email')} error={errors.email?.message} className="mt-1" />
                  </div>

                  <div>
                    <Label htmlFor="municipality_id">Municipalidad</Label>
                    <select
                      id="municipality_id"
                      {...register('municipality_id')}
                      className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[#2E86C1] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                    >
                      <option value="">Seleccione…</option>
                      {MUNICIPALITIES.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    {errors.municipality_id && (
                      <p className="mt-1 text-xs text-red-500">{errors.municipality_id.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="password">Contraseña</Label>
                    <Input id="password" type="password" placeholder="Mínimo 8 caracteres" {...register('password')} error={errors.password?.message} className="mt-1" />
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                    <Input id="confirmPassword" type="password" placeholder="Repita la contraseña" {...register('confirmPassword')} error={errors.confirmPassword?.message} className="mt-1" />
                  </div>

                  <Button type="submit" className="w-full mt-2" loading={isSubmitting}>
                    Crear cuenta
                  </Button>
                </form>
              </>
            )}

            <p className="mt-5 text-center text-sm text-gray-500">
              ¿Ya tiene cuenta?{' '}
              <Link to="/login" className="font-medium text-[#2E86C1] hover:text-[#1B4F72]">
                Inicie sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
