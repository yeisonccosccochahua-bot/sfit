import {
  Injectable, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Company, CompanyStatus } from '../../entities/company.entity';
import { Driver } from '../../entities/driver.entity';
import { Vehicle } from '../../entities/vehicle.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { AuditService } from '../audit/audit.service';

export interface PaginatedCompanies {
  data: (Company & { driver_count: number; vehicle_count: number })[];
  total: number;
  page:  number;
  lastPage: number;
}

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company) private companyRepo: Repository<Company>,
    @InjectRepository(Driver)  private driverRepo:  Repository<Driver>,
    @InjectRepository(Vehicle) private vehicleRepo: Repository<Vehicle>,
    private readonly auditService: AuditService,
  ) {}

  async findAll(municipalityId: string, search?: string, page = 1, limit = 20): Promise<PaginatedCompanies> {
    const qb = this.companyRepo.createQueryBuilder('c')
      .where('c.municipality_id = :municipalityId', { municipalityId })
      .orderBy('c.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (search) qb.andWhere('c.name ILIKE :s OR c.ruc ILIKE :s', { s: `%${search}%` });
    const [companies, total] = await qb.getManyAndCount();

    const data = await Promise.all(companies.map(async (co) => ({
      ...co,
      driver_count:  await this.driverRepo.count({ where: { company_id: co.id } }),
      vehicle_count: await this.vehicleRepo.count({ where: { company_id: co.id } }),
    })));

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async findOne(id: string, municipalityId: string): Promise<Company & { driver_count: number; vehicle_count: number }> {
    const company = await this.companyRepo.findOne({ where: { id, municipality_id: municipalityId } });
    if (!company) throw new NotFoundException(`Empresa ${id} no encontrada`);
    return {
      ...company,
      driver_count:  await this.driverRepo.count({ where: { company_id: id } }),
      vehicle_count: await this.vehicleRepo.count({ where: { company_id: id } }),
    };
  }

  async create(dto: CreateCompanyDto, municipalityId: string): Promise<Company> {
    const exists = await this.companyRepo.findOne({ where: { ruc: dto.ruc } });
    if (exists) throw new ConflictException(`El RUC ${dto.ruc} ya está registrado`);
    const company = this.companyRepo.create({ ...dto, municipality_id: municipalityId, status: CompanyStatus.ACTIVO });
    return this.companyRepo.save(company);
  }

  async update(id: string, dto: UpdateCompanyDto, municipalityId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { id, municipality_id: municipalityId } });
    if (!company) throw new NotFoundException(`Empresa ${id} no encontrada`);
    Object.assign(company, dto);
    return this.companyRepo.save(company);
  }

  async changeStatus(
    id: string,
    status: CompanyStatus,
    municipalityId: string,
    userId: string,
    ip?: string,
  ): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { id, municipality_id: municipalityId } });
    if (!company) throw new NotFoundException(`Empresa ${id} no encontrada`);
    const oldStatus = company.status;
    company.status = status;
    const saved = await this.companyRepo.save(company);
    await this.auditService.log({
      user_id: userId,
      action: 'COMPANY_STATUS_CHANGE',
      entity_type: 'Company',
      entity_id: id,
      details: { from: oldStatus, to: status, name: company.name },
      ip,
    });
    return saved;
  }

  async remove(id: string, municipalityId: string): Promise<{ message: string }> {
    const company = await this.companyRepo.findOne({ where: { id, municipality_id: municipalityId } });
    if (!company) throw new NotFoundException(`Empresa ${id} no encontrada`);
    const driverCount  = await this.driverRepo.count({ where: { company_id: id } });
    const vehicleCount = await this.vehicleRepo.count({ where: { company_id: id } });
    if (driverCount > 0 || vehicleCount > 0) {
      throw new ConflictException(
        `No se puede eliminar la empresa: tiene ${driverCount} conductor(es) y ${vehicleCount} vehículo(s) asociados`,
      );
    }
    await this.companyRepo.remove(company);
    return { message: `Empresa ${company.name} eliminada` };
  }
}
