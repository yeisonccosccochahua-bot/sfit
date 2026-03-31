import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../entities/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Decorator para definir los roles permitidos en un endpoint.
 * @example @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
