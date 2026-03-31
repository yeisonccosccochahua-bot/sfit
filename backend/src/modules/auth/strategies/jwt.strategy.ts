import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../../entities/user.entity';

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  role: string;
  municipalityId: string;
  type?: 'access' | 'refresh';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'sfit_jwt_secret_change_in_prod'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    if (payload.type === 'refresh') {
      throw new UnauthorizedException('Use el endpoint /auth/refresh con el refresh token');
    }

    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      select: ['id', 'email', 'role', 'municipality_id', 'company_id', 'name', 'status', 'reputation_score', 'total_points', 'dni'],
    });

    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    if (user.status !== UserStatus.ACTIVO) {
      throw new UnauthorizedException(`Cuenta ${user.status.toLowerCase()}`);
    }

    return user;
  }
}
