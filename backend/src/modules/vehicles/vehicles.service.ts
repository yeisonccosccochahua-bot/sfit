import {
  Injectable, NotFoundException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { Vehicle, VehicleStatus } from '../../entities/vehicle.entity';
import { Company } from '../../entities/company.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { AuditService } from '../audit/audit.service';
import { UploadsService } from '../uploads/uploads.service';

export interface PaginatedVehicles { data: Vehicle[]; total: number; page: number; lastPage: number; }

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle) private vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Company) private companyRepo: Repository<Company>,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
    private readonly uploads: UploadsService,
  ) {}

  private hmac(qrCode: string): string {
    const secret = this.config.get('QR_HMAC_SECRET', 'sfit_qr_hmac_secret_change_in_prod');
    return crypto.createHmac('sha256', secret).update(qrCode).digest('hex');
  }

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
    opts: { company_id?: string; status?: VehicleStatus; search?: string; page?: number; limit?: number; operator_company_id?: string },
  ): Promise<PaginatedVehicles> {
    const { company_id, status, search, page = 1, limit = 20 } = opts;
    const qb = this.vehicleRepo
      .createQueryBuilder('v')
      .innerJoinAndSelect('v.company', 'c')
      .where('c.municipality_id = :municipalityId', { municipalityId })
      .orderBy('v.plate', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (company_id) qb.andWhere('v.company_id = :company_id', { company_id });
    if (status)     qb.andWhere('v.status = :status', { status });
    if (search)     qb.andWhere('(v.plate ILIKE :s OR v.brand ILIKE :s OR v.model ILIKE :s)', { s: `%${search}%` });
    // OPERADOR_EMPRESA with company_id sees only their company
    // (opts may carry operatorCompanyId)
    if (opts.operator_company_id) {
      qb.andWhere('v.company_id = :ocid', { ocid: opts.operator_company_id });
    }
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async findOne(id: string, municipalityId: string): Promise<Vehicle> {
    const v = await this.vehicleRepo.findOne({ where: { id }, relations: ['company'] });
    if (!v || v.company?.municipality_id !== municipalityId) {
      throw new NotFoundException(`Vehículo ${id} no encontrado`);
    }
    return v;
  }

  async create(dto: CreateVehicleDto, municipalityId: string): Promise<any> {
    await this.validateCompany(dto.company_id, municipalityId);
    const existing = await this.vehicleRepo.findOne({ where: { plate: dto.plate } });
    if (existing) throw new ConflictException(`La placa ${dto.plate} ya está registrada`);

    const qr_code = uuidv4();
    const qr_hmac = this.hmac(qr_code);
    const qrUrl = `${this.config.get('QR_BASE_URL', 'https://sfit.gob.pe/scan')}/${qr_code}`;
    const qr_data_url = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2, color: { dark: '#1B4F72', light: '#FFFFFF' } });

    // Save QR image as static file
    const qrBuffer = Buffer.from(qr_data_url.split(',')[1], 'base64');
    const qrFile: Express.Multer.File = {
      fieldname: 'qr',
      originalname: `${qr_code}.png`,
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: qrBuffer,
      size: qrBuffer.length,
    } as Express.Multer.File;
    const { url: qr_image_url } = await this.uploads.saveFile(qrFile, 'qr');

    const vehicle = this.vehicleRepo.create({
      plate:                 dto.plate,
      brand:                 dto.brand,
      model:                 dto.model,
      year:                  dto.year,
      color:                 dto.color,
      capacity:              dto.capacity,
      photo_url:             dto.photo_url,
      soat_expires_at:       dto.soat_expires_at       ? new Date(dto.soat_expires_at)       : undefined,
      inspection_expires_at: dto.inspection_expires_at ? new Date(dto.inspection_expires_at) : undefined,
      company_id:            dto.company_id,
      qr_code,
      qr_hmac,
      qr_image_url,
      status: VehicleStatus.ACTIVO,
      reputation_score: 100,
    });
    const saved = await this.vehicleRepo.save(vehicle);
    return { ...saved, qr_data_url, qr_code_image_url: saved.qr_image_url, qr_signature: saved.qr_hmac, qr_generated_at: saved.created_at };
  }

  async update(id: string, dto: UpdateVehicleDto, municipalityId: string): Promise<Vehicle> {
    const vehicle = await this.findOne(id, municipalityId);
    Object.assign(vehicle, dto);
    return this.vehicleRepo.save(vehicle);
  }

  async changeStatus(
    id: string,
    status: VehicleStatus,
    reason: string | undefined,
    municipalityId: string,
    userId: string,
    ip?: string,
  ): Promise<Vehicle> {
    const vehicle = await this.findOne(id, municipalityId);
    const oldStatus = vehicle.status;
    vehicle.status = status;
    const saved = await this.vehicleRepo.save(vehicle);
    await this.auditService.log({
      user_id: userId,
      action: 'VEHICLE_STATUS_CHANGE',
      entity_type: 'Vehicle',
      entity_id: id,
      details: { from: oldStatus, to: status, reason, plate: vehicle.plate },
      ip,
    });
    return saved;
  }

  async getQrImage(id: string, municipalityId: string): Promise<string> {
    const vehicle = await this.findOne(id, municipalityId);
    const qrUrl = `${this.config.get('QR_BASE_URL', 'https://sfit.gob.pe/scan')}/${vehicle.qr_code}`;
    return QRCode.toDataURL(qrUrl, { width: 300, margin: 2, color: { dark: '#1B4F72', light: '#FFFFFF' } });
  }

  async verifyQr(qrCode: string): Promise<{ valid: boolean; vehicle?: Vehicle; reason?: string }> {
    const vehicle = await this.vehicleRepo.findOne({
      where: { qr_code: qrCode },
      relations: ['company'],
    });
    if (!vehicle) return { valid: false, reason: 'QR no encontrado' };
    const expectedHmac = this.hmac(qrCode);
    if (vehicle.qr_hmac !== expectedHmac) return { valid: false, reason: 'HMAC inválido' };
    return { valid: true, vehicle };
  }

  async remove(id: string, municipalityId: string): Promise<{ message: string }> {
    const vehicle = await this.findOne(id, municipalityId);
    await this.vehicleRepo.remove(vehicle);
    return { message: `Vehículo ${vehicle.plate} eliminado` };
  }

  async regenerateQr(id: string, municipalityId: string): Promise<{ qr_data_url: string; qr_code: string; qr_code_image_url: string }> {
    const vehicle = await this.findOne(id, municipalityId);
    const qr_code = uuidv4();
    vehicle.qr_code = qr_code;
    vehicle.qr_hmac = this.hmac(qr_code);
    const qrUrl = `${this.config.get('QR_BASE_URL', 'https://sfit.gob.pe/scan')}/${qr_code}`;
    const qr_data_url = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2, color: { dark: '#1B4F72', light: '#FFFFFF' } });

    // Save QR image as static file
    const qrBuffer = Buffer.from(qr_data_url.split(',')[1], 'base64');
    const qrFile: Express.Multer.File = {
      fieldname: 'qr',
      originalname: `${qr_code}.png`,
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: qrBuffer,
      size: qrBuffer.length,
    } as Express.Multer.File;
    const { url: qr_image_url } = await this.uploads.saveFile(qrFile, 'qr');
    vehicle.qr_image_url = qr_image_url;

    await this.vehicleRepo.save(vehicle);
    return { qr_data_url, qr_code, qr_code_image_url: qr_image_url };
  }
}
