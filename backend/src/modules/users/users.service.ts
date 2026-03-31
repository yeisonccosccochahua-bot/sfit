import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { User, UserRole, UserStatus } from '../../entities';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async findAll(
    municipalityId: string,
    opts: { role?: string; status?: string; search?: string; page: number; limit: number },
  ) {
    const { role, status, search, page, limit } = opts;
    const qb = this.userRepo
      .createQueryBuilder('u')
      .where('u.municipality_id = :municipalityId', { municipalityId })
      .select(['u.id', 'u.email', 'u.name', 'u.role', 'u.status', 'u.dni',
               'u.reputation_score', 'u.total_points', 'u.created_at'])
      .orderBy('u.created_at', 'DESC');

    if (role) qb.andWhere('u.role = :role', { role });
    if (status) qb.andWhere('u.status = :status', { status });
    if (search) qb.andWhere('(u.name ILIKE :s OR u.email ILIKE :s)', { s: `%${search}%` });

    const total = await qb.getCount();
    const data  = await qb.skip((page - 1) * limit).take(limit).getMany();

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async updateCompany(id: string, company_id: string | null, municipalityId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    if (user.municipality_id !== municipalityId) {
      throw new ForbiddenException('No puede modificar usuarios de otra municipalidad');
    }
    user.company_id = company_id as any;
    return this.userRepo.save(user);
  }

  async updateStatus(id: string, status: string, municipalityId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`Usuario ${id} no encontrado`);
    if (user.municipality_id !== municipalityId) {
      throw new ForbiddenException('No puede modificar usuarios de otra municipalidad');
    }
    if (!Object.values(UserStatus).includes(status as UserStatus)) {
      throw new ForbiddenException(`Estado inválido: ${status}`);
    }
    user.status = status as UserStatus;
    return this.userRepo.save(user);
  }
}
