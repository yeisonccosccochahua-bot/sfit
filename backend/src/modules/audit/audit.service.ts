import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../entities';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async findAll(
    municipalityId: string,
    opts: {
      action?: string; entity_type?: string;
      date_from?: string; date_to?: string;
      page: number; limit: number;
    },
  ) {
    const { action, entity_type, date_from, date_to, page, limit } = opts;

    const qb = this.auditRepo
      .createQueryBuilder('a')
      .leftJoin('a.user', 'u')
      .addSelect(['u.name', 'u.email', 'u.role', 'u.municipality_id'])
      .where('(u.municipality_id = :mId OR a.user_id IS NULL)', { mId: municipalityId })
      .orderBy('a.created_at', 'DESC');

    if (action)      qb.andWhere('a.action ILIKE :action', { action: `%${action}%` });
    if (entity_type) qb.andWhere('a.entity_type = :entity_type', { entity_type });
    if (date_from)   qb.andWhere('a.created_at >= :date_from', { date_from: new Date(date_from) });
    if (date_to)     qb.andWhere('a.created_at <= :date_to',   { date_to: new Date(date_to) });

    const total = await qb.getCount();
    const raw   = await qb.skip((page - 1) * limit).take(limit).getMany();

    const data = raw.map(a => ({
      id:         a.id,
      action:     a.action,
      entity:     a.entity_type,
      entity_id:  a.entity_id,
      user_name:  (a as any).user?.name ?? 'Sistema',
      user_email: (a as any).user?.email ?? '',
      details:    a.details_json,
      ip:         a.ip,
      created_at: a.created_at,
    }));

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async log(data: {
    user_id?: string;
    action: string;
    entity_type: string;
    entity_id: string;
    details?: Record<string, any>;
    ip?: string;
  }): Promise<void> {
    const entry = this.auditRepo.create({
      user_id: data.user_id ?? null,
      action: data.action,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      details_json: data.details ?? null,
      ip: data.ip ?? null,
    });
    await this.auditRepo.save(entry);
  }

  async exportCsv(municipalityId: string): Promise<string> {
    const { data } = await this.findAll(municipalityId, { page: 1, limit: 1000 });
    const header = 'fecha,usuario,accion,entidad,entidad_id,ip\n';
    const rows = data.map(i =>
      [
        new Date(i.created_at).toISOString(),
        i.user_name,
        i.action,
        i.entity,
        i.entity_id,
        i.ip ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','),
    );
    return header + rows.join('\n');
  }
}
