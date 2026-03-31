import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { ReputationService } from './reputation.service';
import {
  Driver, DriverStatus,
  Vehicle,
  Company,
  FatigueLog, FatigueLogResult,
  Report, ReportStatus,
  Sanction, AppealStatus,
  Trip, TripStatus,
} from '../../entities';

// ─── Mock factory ─────────────────────────────────────────────────────────────
const mockRepo = () => ({
  find:               jest.fn(),
  findOne:            jest.fn(),
  update:             jest.fn(),
  count:              jest.fn(),
  createQueryBuilder: jest.fn(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id:               'driver-uuid',
    name:             'Pedro Quispe',
    status:           DriverStatus.APTO,
    reputation_score: 80,
    company_id:       'company-uuid',
    ...overrides,
  } as Driver;
}

function makeSanction(level: number, appealStatus = AppealStatus.SIN_APELACION): Sanction {
  return { id: `s-${level}`, level, appeal_status: appealStatus } as Sanction;
}

// ─── Test suite ───────────────────────────────────────────────────────────────
describe('ReputationService', () => {
  let service:      ReputationService;
  let driverRepo:   ReturnType<typeof mockRepo>;
  let vehicleRepo:  ReturnType<typeof mockRepo>;
  let companyRepo:  ReturnType<typeof mockRepo>;
  let fatigueRepo:  ReturnType<typeof mockRepo>;
  let reportRepo:   ReturnType<typeof mockRepo>;
  let sanctionRepo: ReturnType<typeof mockRepo>;
  let tripRepo:     ReturnType<typeof mockRepo>;
  let mockQb:       any;

  beforeEach(async () => {
    driverRepo   = mockRepo();
    vehicleRepo  = mockRepo();
    companyRepo  = mockRepo();
    fatigueRepo  = mockRepo();
    reportRepo   = mockRepo();
    sanctionRepo = mockRepo();
    tripRepo     = mockRepo();

    mockQb = {
      select:    jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where:     jest.fn().mockReturnThis(),
      andWhere:  jest.fn().mockReturnThis(),
      orderBy:   jest.fn().mockReturnThis(),
      limit:     jest.fn().mockReturnThis(),
      getMany:   jest.fn().mockResolvedValue([]),
      getCount:  jest.fn().mockResolvedValue(0),
      getRawOne: jest.fn().mockResolvedValue({ avg: '100' }),
    };

    fatigueRepo.createQueryBuilder.mockReturnValue(mockQb);
    reportRepo.createQueryBuilder.mockReturnValue(mockQb);
    sanctionRepo.createQueryBuilder.mockReturnValue(mockQb);
    driverRepo.createQueryBuilder.mockReturnValue(mockQb);
    vehicleRepo.createQueryBuilder.mockReturnValue(mockQb);
    companyRepo.createQueryBuilder.mockReturnValue(mockQb);

    driverRepo.update.mockResolvedValue({});
    vehicleRepo.update.mockResolvedValue({});
    companyRepo.update.mockResolvedValue({});
    tripRepo.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReputationService,
        { provide: getRepositoryToken(Driver),     useValue: driverRepo },
        { provide: getRepositoryToken(Vehicle),    useValue: vehicleRepo },
        { provide: getRepositoryToken(Company),    useValue: companyRepo },
        { provide: getRepositoryToken(FatigueLog), useValue: fatigueRepo },
        { provide: getRepositoryToken(Report),     useValue: reportRepo },
        { provide: getRepositoryToken(Sanction),   useValue: sanctionRepo },
        { provide: getRepositoryToken(Trip),       useValue: tripRepo },
      ],
    }).compile();

    service = module.get<ReputationService>(ReputationService);
  });

  // ── calculateDriverReputation ───────────────────────────────────────────────

  it('[driver] lanza NotFoundException si no existe', async () => {
    driverRepo.findOne.mockResolvedValue(null);
    await expect(service.calculateDriverReputation('no-uuid')).rejects.toThrow(NotFoundException);
  });

  it('[driver] score=100 cuando no hay fatiga, reportes ni sanciones', async () => {
    driverRepo.findOne.mockResolvedValue(makeDriver());
    mockQb.getMany.mockResolvedValue([]);          // no fatigue logs
    mockQb.getCount.mockResolvedValue(0);          // no reports, no sanctions

    const result = await service.calculateDriverReputation('driver-uuid');

    expect(result.score).toBe(100);
    expect(result.fatigue_score).toBe(100);
    expect(result.report_score).toBe(100);
    expect(result.incident_score).toBe(100);
    expect(driverRepo.update).toHaveBeenCalledWith('driver-uuid', { reputation_score: 100 });
  });

  it('[driver] score disminuye con fatiga NO_APTO', async () => {
    driverRepo.findOne.mockResolvedValue(makeDriver());

    // 3 fatigue logs: 2 APTO, 1 NO_APTO → fatigue_score = 67
    mockQb.getMany.mockResolvedValue([
      { result: FatigueLogResult.APTO },
      { result: FatigueLogResult.APTO },
      { result: FatigueLogResult.NO_APTO },
    ]);
    mockQb.getCount.mockResolvedValue(0);

    const result = await service.calculateDriverReputation('driver-uuid');

    expect(result.fatigue_score).toBe(67);
    expect(result.score).toBeLessThan(100);
  });

  it('[driver] score disminuye con sanción nivel 3 (-30 puntos incidentes)', async () => {
    driverRepo.findOne.mockResolvedValue(makeDriver());
    mockQb.getMany
      .mockResolvedValueOnce([]) // fatigue logs
      .mockResolvedValueOnce([makeSanction(3)]); // active sanctions

    mockQb.getCount.mockResolvedValue(0);

    const result = await service.calculateDriverReputation('driver-uuid');

    expect(result.incident_score).toBe(70); // 100 - 30
    // score = 100*0.4 + 100*0.3 + 70*0.3 = 40+30+21 = 91
    expect(result.score).toBe(91);
  });

  it('[driver] sanción aceptada (APELACION_ACEPTADA) no cuenta en incidentes', async () => {
    driverRepo.findOne.mockResolvedValue(makeDriver());
    mockQb.getMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]); // no active sanctions (accepted appeal filtered by query)
    mockQb.getCount.mockResolvedValue(0);

    const result = await service.calculateDriverReputation('driver-uuid');
    expect(result.incident_score).toBe(100);
  });

  it('[driver] score baja a 0 con sanciones masivas', async () => {
    driverRepo.findOne.mockResolvedValue(makeDriver());
    const manySanctions = [
      makeSanction(4), makeSanction(3), makeSanction(3),
    ]; // penalty = 50+30+30 = 110 > 100 → capped at 0
    mockQb.getMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(manySanctions);
    mockQb.getCount.mockResolvedValue(0);

    const result = await service.calculateDriverReputation('driver-uuid');
    expect(result.incident_score).toBe(0);
  });

  // ── calculateVehicleReputation ──────────────────────────────────────────────

  it('[vehicle] lanza NotFoundException si no existe', async () => {
    vehicleRepo.findOne.mockResolvedValue(null);
    await expect(service.calculateVehicleReputation('no-uuid')).rejects.toThrow(NotFoundException);
  });

  it('[vehicle] score=100 sin viajes auto-cerrados y drivers con rep 100', async () => {
    vehicleRepo.findOne.mockResolvedValue({ id: 'v-uuid', plate: 'ABC-123', reputation_score: 100 });
    mockQb.getRawOne.mockResolvedValue({ avg: '100' });
    tripRepo.count.mockResolvedValue(0);

    const result = await service.calculateVehicleReputation('v-uuid');
    expect(result.score).toBe(100);
    expect(result.auto_closed_cnt).toBe(0);
  });

  it('[vehicle] score baja con viajes auto-cerrados', async () => {
    vehicleRepo.findOne.mockResolvedValue({ id: 'v-uuid', plate: 'ABC-123', reputation_score: 80 });
    mockQb.getRawOne.mockResolvedValue({ avg: '90' });
    tripRepo.count.mockResolvedValue(4); // 4 auto-closes → -20

    const result = await service.calculateVehicleReputation('v-uuid');
    expect(result.score).toBe(70); // 90 - 20
  });

  // ── calculateCompanyReputation ──────────────────────────────────────────────

  it('[company] lanza NotFoundException si no existe', async () => {
    companyRepo.findOne.mockResolvedValue(null);
    await expect(service.calculateCompanyReputation('no-uuid')).rejects.toThrow(NotFoundException);
  });

  it('[company] score=100 sin conductores ni sanciones', async () => {
    companyRepo.findOne.mockResolvedValue({ id: 'c-uuid', name: 'Trans Lima' });
    driverRepo.find.mockResolvedValue([]);
    mockQb.getCount.mockResolvedValue(0);

    const result = await service.calculateCompanyReputation('c-uuid');
    // 100*0.5 + 100*0.3 + 100*0.2 = 100
    expect(result.score).toBe(100);
  });

  it('[company] ratio_apto baja cuando hay conductores NO_APTO', async () => {
    companyRepo.findOne.mockResolvedValue({ id: 'c-uuid', name: 'Trans Lima' });
    driverRepo.find.mockResolvedValue([
      makeDriver({ status: DriverStatus.APTO,    reputation_score: 80 }),
      makeDriver({ status: DriverStatus.NO_APTO, reputation_score: 40 }),
    ]);
    mockQb.getCount.mockResolvedValue(0);

    const result = await service.calculateCompanyReputation('c-uuid');
    expect(result.drivers_apto).toBe(1);
    expect(result.score).toBeLessThan(100);
  });
});
