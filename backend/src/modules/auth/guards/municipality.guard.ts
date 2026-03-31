import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../entities/user.entity';

export const SKIP_MUNICIPALITY_KEY = 'skipMunicipality';

/**
 * MunicipalityGuard — CRÍTICO para el aislamiento multi-municipalidad.
 *
 * Inyecta `req.municipalityFilter` con el municipality_id del usuario
 * autenticado. Los servicios deben usar este valor al construir queries
 * para garantizar que ningún usuario acceda a datos de otra municipalidad.
 *
 * El CIUDADANO también queda restringido a su municipalidad en operaciones
 * de escritura; puede consultar viajes activos de cualquier municipalidad
 * solo en los endpoints marcados con @SkipMunicipalityFilter().
 */
@Injectable()
export class MunicipalityGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_MUNICIPALITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || skip) {
      request.municipalityFilter = null;
      return true;
    }

    // Todos los roles quedan atados a su municipalidad
    request.municipalityFilter = user.municipality_id ?? null;

    return true;
  }
}

import { SetMetadata } from '@nestjs/common';
/**
 * Permite omitir el filtro de municipalidad en endpoints donde no aplica
 * (por ejemplo, consultar una ruta por QR desde la PWA pública).
 */
export const SkipMunicipalityFilter = () =>
  SetMetadata(SKIP_MUNICIPALITY_KEY, true);
