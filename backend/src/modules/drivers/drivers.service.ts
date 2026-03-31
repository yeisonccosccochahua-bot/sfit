import {
  Injectable, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver, DriverStatus } from '../../entities/driver.entity';
import { Company } from '../../entities/company.entity';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { AuditService } from '../audit/audit.service';

export interface PaginatedDrivers { data: Driver[]; total: number; page: number; lastPage: number; }

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver)  private driverRepo:  Repository<Driver>,
    @InjectRepository(Company) private companyRepo: Repository<Company>,
    private readonly auditService: AuditService,
  ) {}

  private async validateCompany(companyId: string, municipalityId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException(`Empresa ${companyId} no encontrada`);
    if (company.municipality_id !== municipalityId) {
      throw new ForbiddenException('La empresa no pertenece a tu municipalidad');
    }
    return company;
  }

  async findAll(
    municipalityId: string,
    opts: { company_id?: string; status?: DriverStatus; search?: string; page?: number; limit?: number },
  ): Promise<PaginatedDrivers> {
    const { company_id, status, search, page = 1, limit = 20 } = opts;
    const qb = this.driverRepo
      .createQueryBuilder('d')
      .innerJoinAndSelect('d.company', 'c')
      .where('c.municipality_id = :municipalityId', { municipalityId })
      .orderBy('d.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (company_id) qb.andWhere('d.company_id = :company_id', { company_id });
    if (status)     qb.andWhere('d.status = :status', { status });
    if (search)     qb.andWhere('(d.name ILIKE :s OR d.dni ILIKE :s)', { s: `%${search}%` });
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async findOne(id: string, municipalityId: string): Promise<Driver> {
    const d = await this.driverRepo.findOne({
      where: { id },
      relations: ['company'],
    });
    if (!d || d.company?.municipality_id !== municipalityId) {
      throw new NotFoundException(`Conductor ${id} no encontrado`);
    }
    return d;
  }

  async create(dto: CreateDriverDto, municipalityId: string): Promise<Driver> {
    await this.validateCompany(dto.company_id, municipalityId);
    const existing = await this.driverRepo.findOne({ where: { dni: dto.dni } });
    if (existing) throw new ConflictException(`El DNI ${dto.dni} ya está registrado`);
    const photo_expires_at = dto.license_photo_url
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      : undefined;
    const driver = this.driverRepo.create({ ...dto, status: DriverStatus.APTO, reputation_score: 100, photo_expires_at });
    return this.driverRepo.save(driver);
  }

  async update(id: string, dto: UpdateDriverDto, municipalityId: string): Promise<Driver> {
    const driver = await this.findOne(id, municipalityId);
    if (dto.license_photo_url && !driver.license_photo_url) {
      (dto as any).photo_expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    Object.assign(driver, dto);
    return this.driverRepo.save(driver);
  }

  async changeStatus(
    id: string,
    status: DriverStatus,
    reason: string | undefined,
    municipalityId: string,
    userId: string,
    ip?: string,
  ): Promise<Driver> {
    const driver = await this.findOne(id, municipalityId);
    const oldStatus = driver.status;
    driver.status = status;
    const saved = await this.driverRepo.save(driver);
    await this.auditService.log({
      user_id: userId,
      action: 'DRIVER_STATUS_CHANGE',
      entity_type: 'Driver',
      entity_id: id,
      details: { from: oldStatus, to: status, reason, name: driver.name, dni: driver.dni },
      ip,
    });
    return saved;
  }

  async remove(id: string, municipalityId: string): Promise<{ message: string }> {
    const driver = await this.findOne(id, municipalityId);
    await this.driverRepo.remove(driver);
    return { message: `Conductor ${driver.name} eliminado` };
  }
}
