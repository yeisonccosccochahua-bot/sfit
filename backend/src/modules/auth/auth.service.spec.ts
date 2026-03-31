import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { User, UserRole, UserStatus } from '../../entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────
const mockUserRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('test_secret'),
};

const buildUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'uuid-1',
    email: 'test@example.com',
    password_hash: '$2b$12$hashedpassword',
    role: UserRole.CIUDADANO,
    municipality_id: 'muni-uuid-1',
    name: 'Test User',
    dni: '12345678',
    phone: '+51987654321',
    status: UserStatus.ACTIVO,
    reputation_score: 100,
    total_points: 0,
    reports_today: 0,
    ...overrides,
  } as User);

// ──────────────────────────────────────────────
// Suite
// ──────────────────────────────────────────────
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────
  // 1. register — CIUDADANO sin autenticación previa
  // ──────────────────────────────────────────────
  describe('register', () => {
    const dto: RegisterDto = {
      email: 'nuevo@example.com',
      password: 'Password1',
      name: 'Nuevo Usuario',
      dni: '87654321',
      phone: '+51900000000',
      role: UserRole.CIUDADANO,
      municipality_id: 'muni-uuid-1',
    };

    it('debería registrar un CIUDADANO sin autenticación previa', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const newUser = buildUser({ email: dto.email, role: UserRole.CIUDADANO });
      mockUserRepo.create.mockReturnValue(newUser);
      mockUserRepo.save.mockResolvedValue(newUser);

      const result = await service.register(dto);

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(newUser.email);
      expect((result.user as any).password_hash).toBeUndefined();
    });

    it('debería lanzar ConflictException si el email ya existe', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(buildUser()); // email existe

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('debería lanzar ConflictException si el DNI ya existe', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(null)       // email no existe
        .mockResolvedValueOnce(buildUser()); // dni existe

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('debería lanzar ForbiddenException si se intenta crear FISCAL sin ser ADMIN_MUNICIPAL', async () => {
      const fiscalDto: RegisterDto = { ...dto, role: UserRole.FISCAL };

      await expect(service.register(fiscalDto, undefined)).rejects.toThrow(ForbiddenException);
    });

    it('debería permitir a un ADMIN_MUNICIPAL crear un FISCAL en su misma municipalidad', async () => {
      const admin = buildUser({ role: UserRole.ADMIN_MUNICIPAL, municipality_id: 'muni-uuid-1' });
      const fiscalDto: RegisterDto = { ...dto, role: UserRole.FISCAL, municipality_id: 'muni-uuid-1' };

      mockUserRepo.findOne.mockResolvedValue(null);
      const newUser = buildUser({ role: UserRole.FISCAL });
      mockUserRepo.create.mockReturnValue(newUser);
      mockUserRepo.save.mockResolvedValue(newUser);

      const result = await service.register(fiscalDto, admin);
      expect(result.user.role).toBe(UserRole.FISCAL);
    });

    it('debería lanzar ForbiddenException si ADMIN_MUNICIPAL intenta crear usuario en otra municipalidad', async () => {
      const admin = buildUser({ role: UserRole.ADMIN_MUNICIPAL, municipality_id: 'muni-uuid-1' });
      const fiscalDto: RegisterDto = { ...dto, role: UserRole.FISCAL, municipality_id: 'muni-uuid-OTRA' };

      await expect(service.register(fiscalDto, admin)).rejects.toThrow(ForbiddenException);
    });
  });

  // ──────────────────────────────────────────────
  // 2. login
  // ──────────────────────────────────────────────
  describe('login', () => {
    const dto: LoginDto = { email: 'test@example.com', password: 'Password1' };

    it('debería retornar tokens JWT con un login válido', async () => {
      const user = buildUser();
      user.password_hash = await bcrypt.hash('Password1', 1);
      mockUserRepo.findOne.mockResolvedValue(user);

      const result = await service.login(dto);

      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
      expect(result.expires_in).toBe(28800);
      expect(result.token_type).toBe('Bearer');
    });

    it('debería lanzar UnauthorizedException si el email no existe', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('debería lanzar UnauthorizedException si la contraseña es incorrecta', async () => {
      const user = buildUser();
      user.password_hash = await bcrypt.hash('OtraPassword1', 1);
      mockUserRepo.findOne.mockResolvedValue(user);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('debería lanzar UnauthorizedException si la cuenta está BLOQUEADA', async () => {
      const user = buildUser({ status: UserStatus.BLOQUEADO });
      mockUserRepo.findOne.mockResolvedValue(user);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('debería lanzar UnauthorizedException si la cuenta está SUSPENDIDA', async () => {
      const user = buildUser({ status: UserStatus.SUSPENDIDO });
      mockUserRepo.findOne.mockResolvedValue(user);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ──────────────────────────────────────────────
  // 3. refresh
  // ──────────────────────────────────────────────
  describe('refresh', () => {
    it('debería lanzar UnauthorizedException si el token no es de tipo refresh', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'uuid-1',
        email: 'test@example.com',
        role: UserRole.CIUDADANO,
        municipalityId: 'muni-uuid-1',
        type: 'access', // tipo incorrecto
      });

      await expect(service.refresh('invalid.token')).rejects.toThrow(UnauthorizedException);
    });

    it('debería emitir nuevos tokens con un refresh token válido', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'uuid-1',
        email: 'test@example.com',
        role: UserRole.CIUDADANO,
        municipalityId: 'muni-uuid-1',
        type: 'refresh',
      });
      mockUserRepo.findOne.mockResolvedValue(buildUser());

      const result = await service.refresh('valid.refresh.token');
      expect(result.access_token).toBe('mock.jwt.token');
    });
  });
});
