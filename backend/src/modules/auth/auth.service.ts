import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { User, UserRole, UserStatus } from '../../entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;

// Roles que solo puede crear un ADMIN_MUNICIPAL
const ADMIN_ONLY_ROLES: UserRole[] = [
  UserRole.ADMIN_MUNICIPAL,
  UserRole.FISCAL,
  UserRole.OPERADOR_EMPRESA,
  UserRole.INSPECTOR,
];

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // ──────────────────────────────────────────────
  // REGISTER
  // ──────────────────────────────────────────────
  async register(dto: RegisterDto, requestingUser?: User): Promise<{ user: Omit<User, 'password_hash'> }> {
    // Roles protegidos: solo ADMIN_MUNICIPAL puede crearlos
    if (ADMIN_ONLY_ROLES.includes(dto.role)) {
      if (!requestingUser || requestingUser.role !== UserRole.ADMIN_MUNICIPAL) {
        throw new ForbiddenException(
          `Solo un ADMIN_MUNICIPAL puede crear usuarios con rol ${dto.role}`,
        );
      }
      // Si no se indica municipality_id, se hereda la del admin
      if (!dto.municipality_id && requestingUser.municipality_id) {
        dto.municipality_id = requestingUser.municipality_id;
      }
      // El ADMIN_MUNICIPAL solo puede crear usuarios en su propia municipalidad
      if (requestingUser.municipality_id && dto.municipality_id !== requestingUser.municipality_id) {
        throw new ForbiddenException(
          'Solo puedes crear usuarios en tu propia municipalidad',
        );
      }
    }

    // Email único
    const emailExists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (emailExists) {
      throw new ConflictException('El email ya está registrado');
    }

    // DNI único (si se provee)
    if (dto.dni) {
      const dniExists = await this.userRepo.findOne({ where: { dni: dto.dni } });
      if (dniExists) {
        throw new ConflictException('El DNI ya está registrado');
      }
    }

    const password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = this.userRepo.create({
      email: dto.email,
      password_hash,
      name: dto.name,
      dni: dto.dni,
      phone: dto.phone,
      role: dto.role,
      municipality_id: dto.municipality_id,
      status: UserStatus.ACTIVO,
      reputation_score: 100,
      total_points: 0,
      reports_today: 0,
    });

    const saved = await this.userRepo.save(user);
    const { password_hash: _, ...result } = saved;
    return { user: result as Omit<User, 'password_hash'> };
  }

  // ──────────────────────────────────────────────
  // LOGIN
  // ──────────────────────────────────────────────
  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
      select: ['id', 'email', 'password_hash', 'role', 'municipality_id', 'name', 'status'],
    });

    if (!user) throw new UnauthorizedException('Credenciales inválidas');
    if (user.status !== UserStatus.ACTIVO) {
      throw new UnauthorizedException(`Cuenta ${user.status.toLowerCase()}`);
    }

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    return this.generateTokens(user);
  }

  // ──────────────────────────────────────────────
  // GET PROFILE
  // ──────────────────────────────────────────────
  async getProfile(userId: string): Promise<Omit<User, 'password_hash'>> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['municipality'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const { password_hash: _, ...result } = user;
    return result as Omit<User, 'password_hash'>;
  }

  // ──────────────────────────────────────────────
  // UPDATE PROFILE
  // ──────────────────────────────────────────────
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<Omit<User, 'password_hash'>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.name) user.name = dto.name;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.password) {
      user.password_hash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }

    const saved = await this.userRepo.save(user);
    const { password_hash: _, ...result } = saved;
    return result as Omit<User, 'password_hash'>;
  }

  // ──────────────────────────────────────────────
  // REFRESH TOKEN
  // ──────────────────────────────────────────────
  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET', 'sfit_refresh_secret_change_in_prod'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token no es de tipo refresh');
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      select: ['id', 'email', 'role', 'municipality_id', 'status'],
    });

    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    if (user.status !== UserStatus.ACTIVO) {
      throw new UnauthorizedException(`Cuenta ${user.status.toLowerCase()}`);
    }

    return this.generateTokens(user);
  }

  // ──────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────
  private generateTokens(user: Pick<User, 'id' | 'email' | 'role' | 'municipality_id'>): AuthTokens {
    const expiresIn = 8 * 60 * 60; // 8 horas en segundos

    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      municipalityId: user.municipality_id,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      municipalityId: user.municipality_id,
      type: 'refresh',
    };

    const access_token = this.jwtService.sign(accessPayload, {
      expiresIn,
      secret: this.config.get<string>('JWT_SECRET', 'sfit_jwt_secret_change_in_prod'),
    });

    const refresh_token = this.jwtService.sign(refreshPayload, {
      expiresIn: '7d',
      secret: this.config.get<string>('JWT_REFRESH_SECRET', 'sfit_refresh_secret_change_in_prod'),
    });

    return { access_token, refresh_token, expires_in: expiresIn, token_type: 'Bearer' };
  }
}
