import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';

import { QrService } from './qr.service';
import { Vehicle } from '../../entities/vehicle.entity';
import { Trip, TripStatus } from '../../entities/trip.entity';
import { TripDriver } from '../../entities/trip-driver.entity';
import { Driver } from '../../entities/driver.entity';
import { Report } from '../../entities/report.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { User, UserRole, UserStatus } from '../../entities/user.entity';

// ─────────────────────────────────────────────────
// Mock repositories
// ─────────────────────────────────────────────────
const mockVehicleRepo  = { findOne: jest.fn(), save: jest.fn() };
const mockTripRepo     = { findOne: jest.fn() };
const mockTripDrvRepo  = { find: jest.fn() };
const mockDriverRepo   = { findOne: jest.fn() };
const mockReportRepo   = { create: jest.fn(), save: jest.fn() };
const mockAuditRepo    = { create: jest.fn(), save: jest.fn() };

const mockConfig = {
  get: jest.fn((key: string, def: string) => {
    if (key === 'QR_HMAC_SECRET') return 'test_hmac_secret';
    if (key === 'QR_BASE_URL') return 'https://sfit.gob.pe/scan';
    return def;
  }),
};

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────
function buildUser(overrides: Partial<User> = {}): User {
  return { id: 'user-1', role: UserRole.CIUDADANO, municipality_id: 'muni-1', status: UserStatus.ACTIVO, name: 'Citizen', ...overrides } as User;
}

function buildVehicle(qrCode: string, hmac: string) {
  return {
    id: 'vehicle-1',
    plate: 'ABC-123',
    qr_code: qrCode,
    qr_hmac: hmac,
    company: { id: 'company-1', name: 'Trans Cotabambas', municipality_id: 'muni-1' },
  };
}

// ─────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────
describe('QrService', () => {
  let service: QrService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrService,
        { provide: getRepositoryToken(Vehicle),    useValue: mockVehicleRepo },
        { provide: getRepositoryToken(Trip),       useValue: mockTripRepo },
        { provide: getRepositoryToken(TripDriver), useValue: mockTripDrvRepo },
        { provide: getRepositoryToken(Driver),     useValue: mockDriverRepo },
        { provide: getRepositoryToken(Report),     useValue: mockReportRepo },
        { provide: getRepositoryToken(AuditLog),   useValue: mockAuditRepo },
        { provide: ConfigService,                  useValue: mockConfig },
      ],
    }).compile();

    service = module.get<QrService>(QrService);
    jest.clearAllMocks();

    mockAuditRepo.create.mockReturnValue({});
    mockAuditRepo.save.mockResolvedValue({});
    mockReportRepo.create.mockReturnValue({ id: 'report-1' });
    mockReportRepo.save.mockResolvedValue({ id: 'report-1' });
  });

  // ──────────────────────────────────────────────
  // T1: HMAC válido → retorna datos del vehículo
  // ──────────────────────────────────────────────
  it('T1: HMAC válido → retorna datos del vehículo con active_trip null', async () => {
    const qrCode = 'valid-uuid-1234';
    const validHmac = service.computeHmac(qrCode);
    mockVehicleRepo.findOne.mockResolvedValue(buildVehicle(qrCode, validHmac));
    mockTripRepo.findOne.mockResolvedValue(null); // sin viaje activo

    const result = await service.scan(qrCode);

    expect(result.vehicle.qr_valid).toBe(true);
    expect(result.vehicle.plate).toBe('ABC-123');
    expect(result.active_trip).toBeNull();
    expect(result.can_report).toBe(false);
  });

  // ──────────────────────────────────────────────
  // T2: HMAC inválido → lanza UnauthorizedException
  // ──────────────────────────────────────────────
  it('T2: HMAC inválido → lanza UnauthorizedException', async () => {
    const qrCode = 'valid-uuid-1234';
    mockVehicleRepo.findOne.mockResolvedValue(buildVehicle(qrCode, 'tampered-hmac-value-00000000000000000000000000000000000000000000000000000000000000000'));

    await expect(service.scan(qrCode)).rejects.toThrow(UnauthorizedException);
  });

  // ──────────────────────────────────────────────
  // T3: QR con viaje activo → retorna active_trip
  // ──────────────────────────────────────────────
  it('T3: QR con viaje activo → retorna active_trip con conductores', async () => {
    const qrCode = 'uuid-with-active-trip';
    const validHmac = service.computeHmac(qrCode);
    mockVehicleRepo.findOne.mockResolvedValue(buildVehicle(qrCode, validHmac));

    const now = new Date();
    mockTripRepo.findOne.mockResolvedValue({
      id: 'trip-1',
      status: TripStatus.EN_CURSO,
      start_time: now,
      vehicle_id: 'vehicle-1',
      route: { origin: 'Cusco', destination: 'Tambobamba', estimated_duration_minutes: 300 },
    });

    mockTripDrvRepo.find.mockResolvedValue([
      {
        trip_id: 'trip-1',
        driver_id: 'driver-1',
        role: 'PRINCIPAL',
        fatigue_check_result: 'APTO',
        driver: { id: 'driver-1', name: 'Juan Quispe', dni: '12345678', license_photo_url: null, status: 'APTO' },
      },
    ]);

    const result = await service.scan(qrCode);

    expect(result.active_trip).not.toBeNull();
    expect(result.active_trip!.route.origin).toBe('Cusco');
    expect(result.active_trip!.drivers).toHaveLength(1);
    expect(result.active_trip!.drivers[0].dni_last_4).toBe('5678');
    expect(result.active_trip!.drivers[0].fatigue_status).toBe('APTO');
    expect(result.can_report).toBe(true);
  });

  // ──────────────────────────────────────────────
  // T4: QR sin viaje activo → can_report = false
  // ──────────────────────────────────────────────
  it('T4: QR sin viaje activo → active_trip=null y can_report=false', async () => {
    const qrCode = 'uuid-no-active-trip';
    const validHmac = service.computeHmac(qrCode);
    mockVehicleRepo.findOne.mockResolvedValue(buildVehicle(qrCode, validHmac));
    mockTripRepo.findOne.mockResolvedValue(null);

    const result = await service.scan(qrCode);

    expect(result.active_trip).toBeNull();
    expect(result.can_report).toBe(false);
  });

  // ──────────────────────────────────────────────
  // T5: QR no encontrado → UnauthorizedException
  // ──────────────────────────────────────────────
  it('T5: QR no encontrado en DB → UnauthorizedException', async () => {
    mockVehicleRepo.findOne.mockResolvedValue(null);

    await expect(service.scan('nonexistent-uuid')).rejects.toThrow(UnauthorizedException);
  });

  // ──────────────────────────────────────────────
  // T6: validate — is_same_driver=false → crea alerta
  // ──────────────────────────────────────────────
  it('T6: validate con is_same_driver=false → crea reporte CONDUCTOR_DIFERENTE', async () => {
    const qrCode = 'qr-validate-test';
    const validHmac = service.computeHmac(qrCode);
    mockVehicleRepo.findOne.mockResolvedValue(buildVehicle(qrCode, validHmac));
    mockTripRepo.findOne.mockResolvedValue({ id: 'trip-1', vehicle_id: 'vehicle-1' });

    const result = await service.validate(
      { qr_code: qrCode, is_same_driver: false, trip_id: 'trip-1' },
      buildUser(),
    );

    expect(result.recorded).toBe(true);
    expect(result.alert_created).toBe(true);
    expect(mockReportRepo.save).toHaveBeenCalledTimes(1);
  });

  // ──────────────────────────────────────────────
  // T7: validate — is_same_driver=true → sin alerta
  // ──────────────────────────────────────────────
  it('T7: validate con is_same_driver=true → sin alerta', async () => {
    const qrCode = 'qr-validate-ok';
    const validHmac = service.computeHmac(qrCode);
    mockVehicleRepo.findOne.mockResolvedValue(buildVehicle(qrCode, validHmac));
    mockTripRepo.findOne.mockResolvedValue({ id: 'trip-1', vehicle_id: 'vehicle-1' });

    const result = await service.validate(
      { qr_code: qrCode, is_same_driver: true, trip_id: 'trip-1' },
      buildUser(),
    );

    expect(result.alert_created).toBe(false);
    expect(mockReportRepo.save).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // T8: timingSafeEqual — HMAC correcto pasa
  // ──────────────────────────────────────────────
  it('T8: validateHmac con el valor correcto retorna true', () => {
    const code = 'test-code-abc';
    const hmac = service.computeHmac(code);
    expect(service.validateHmac(code, hmac)).toBe(true);
  });
});
