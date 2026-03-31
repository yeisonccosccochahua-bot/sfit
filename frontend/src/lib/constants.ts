import { UserRole } from '../types';

export const MUNICIPALITIES = [
  { id: '', name: 'Selecciona una municipalidad' },
  { id: 'cotabambas',     name: 'Municipalidad Provincial de Cotabambas — Apurímac' },
  { id: 'challhuahuacho', name: 'Municipalidad Distrital de Challhuahuacho — Apurímac' },
  { id: 'chumbivilcas',   name: 'Municipalidad Provincial de Chumbivilcas — Cusco' },
  { id: 'colquemarca',    name: 'Municipalidad Distrital de Colquemarca — Cusco' },
] as const;

export const ROLE_REDIRECT: Record<UserRole, string> = {
  [UserRole.ADMIN_MUNICIPAL]:  '/admin',
  [UserRole.FISCAL]:           '/dashboard',
  [UserRole.OPERADOR_EMPRESA]: '/operator',
  [UserRole.CIUDADANO]:        '/citizen',
  [UserRole.INSPECTOR]:        '/inspector',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN_MUNICIPAL]:  'Administrador Municipal',
  [UserRole.FISCAL]:           'Fiscal',
  [UserRole.OPERADOR_EMPRESA]: 'Operador de Empresa',
  [UserRole.CIUDADANO]:        'Ciudadano',
  [UserRole.INSPECTOR]:        'Inspector',
};

export const COLORS = {
  blueDark:  '#1B4F72',
  blueMid:   '#2E86C1',
  blueLight: '#AED6F1',
  white:     '#FFFFFF',
  gray50:    '#F8FAFC',
} as const;
