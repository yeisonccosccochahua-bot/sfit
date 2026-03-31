import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  IncentivePoint, IncentiveActionType,
  User, UserRole,
} from '../../entities';

// Points per action
export const ACTION_POINTS: Record<IncentiveActionType, number> = {
  [IncentiveActionType.REPORTE_VALIDO]:      10,
  [IncentiveActionType.REPORTE_CON_SANCION]: 50,
  [IncentiveActionType.VALIDACION_CORRECTA]: 2,
  [IncentiveActionType.BONUS]:               0,  // caller sets custom amount
};

export interface PointHistoryItem {
  id:          string;
  points:      number;
  action_type: IncentiveActionType;
  description: string;
  report_id:   string | null;
  created_at:  Date;
}

export interface CitizenRankingEntry {
  position:      number;
  user_id:       string;
  name:          string;
  total_points:  number;
  valid_reports: number;
}

@Injectable()
export class IncentivesService {
  private readonly logger = new Logger(IncentivesService.name);

  constructor(
    @InjectRepository(IncentivePoint) private readonly pointRepo: Repository<IncentivePoint>,
    @InjectRepository(User)           private readonly userRepo:  Repository<User>,
  ) {}

  // ── GRANT POINTS ─────────────────────────────────────────────────────────────
  /**
   * Award incentive points to a citizen.
   * Updates User.total_points atomically.
   */
  async grantPoints(
    citizenId:  string,
    action:     IncentiveActionType,
    reportId?:  string,
    customPts?: number,
  ): Promise<IncentivePoint> {
    const points = customPts ?? ACTION_POINTS[action];

    const record = await this.pointRepo.save(
      this.pointRepo.create({
        citizen_id:  citizenId,
        points,
        action_type: action,
        report_id:   reportId ?? null,
        date:        new Date().toISOString().split('T')[0],
      }),
    );

    // Increment user total_points atomically via parameterized raw update
    await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({ total_points: () => 'total_points + :pts' })
      .setParameter('pts', points)
      .where('id = :id', { id: citizenId })
      .execute();

    this.logger.log(`+${points} pts (${action}) → citizen ${citizenId}`);
    return record;
  }

  // ── MY POINTS SUMMARY ─────────────────────────────────────────────────────────
  async getMyPoints(citizenId: string) {
    const user = await this.userRepo.findOne({
      where:  { id: citizenId },
      select: ['id', 'name', 'total_points', 'reputation_score', 'reports_today'],
    });

    const [byAction] = await Promise.all([
      this.pointRepo
        .createQueryBuilder('p')
        .select('p.action_type', 'action_type')
        .addSelect('SUM(p.points)', 'total')
        .where('p.citizen_id = :id', { id: citizenId })
        .groupBy('p.action_type')
        .getRawMany<{ action_type: string; total: string }>(),
    ]);

    return {
      citizen:  user,
      by_action: byAction.map((r) => ({ action_type: r.action_type, total: parseInt(r.total, 10) })),
    };
  }

  // ── HISTORY (paginated) ────────────────────────────────────────────────────────
  async getHistory(citizenId: string, page = 1, limit = 20) {
    const [data, total] = await this.pointRepo
      .createQueryBuilder('p')
      .where('p.citizen_id = :id', { id: citizenId })
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data:     data.map((p) => ({
        id:          p.id,
        points:      p.points,
        action_type: p.action_type,
        description: this.describeAction(p.action_type),
        report_id:   p.report_id,
        created_at:  p.created_at,
      })),
      total,
      page,
      lastPage: Math.ceil(total / limit) || 1,
    };
  }

  // ── RANKING (top 20 by municipality) ─────────────────────────────────────────
  async getRanking(municipalityId: string): Promise<CitizenRankingEntry[]> {
    const rows = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.name', 'u.total_points'])
      .where('u.municipality_id = :mId', { mId: municipalityId })
      .andWhere('u.role = :role', { role: UserRole.CIUDADANO })
      .orderBy('u.total_points', 'DESC')
      .limit(20)
      .getMany();

    // Fetch valid report counts for each user in one query
    const userIds = rows.map((r) => r.id);
    let validReports: Record<string, number> = {};
    if (userIds.length > 0) {
      const counts = await this.pointRepo
        .createQueryBuilder('p')
        .select('p.citizen_id', 'citizen_id')
        .addSelect('COUNT(*)', 'cnt')
        .where('p.citizen_id IN (:...ids)', { ids: userIds })
        .andWhere('p.action_type IN (:...types)', {
          types: [IncentiveActionType.REPORTE_VALIDO, IncentiveActionType.REPORTE_CON_SANCION],
        })
        .groupBy('p.citizen_id')
        .getRawMany<{ citizen_id: string; cnt: string }>();

      validReports = Object.fromEntries(counts.map((c) => [c.citizen_id, parseInt(c.cnt, 10)]));
    }

    return rows.map((u, i) => ({
      position:      i + 1,
      user_id:       u.id,
      name:          u.name,
      total_points:  u.total_points,
      valid_reports: validReports[u.id] ?? 0,
    }));
  }

  // ── RESET DAILY COUNTERS ──────────────────────────────────────────────────────
  async resetDailyCounters(): Promise<number> {
    const result = await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({ reports_today: 0 })
      .where('role = :role', { role: UserRole.CIUDADANO })
      .execute();
    return result.affected ?? 0;
  }

  // ── Private ───────────────────────────────────────────────────────────────────
  private describeAction(action: IncentiveActionType): string {
    const labels: Record<IncentiveActionType, string> = {
      [IncentiveActionType.REPORTE_VALIDO]:      'Reporte validado',
      [IncentiveActionType.REPORTE_CON_SANCION]: 'Reporte que generó sanción (bonus)',
      [IncentiveActionType.VALIDACION_CORRECTA]: 'Confirmación de conductor correcto',
      [IncentiveActionType.BONUS]:               'Bonificación especial',
    };
    return labels[action] ?? action;
  }
}
