import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { MunicipalReportsService } from './municipal-reports.service';
import { EmailService } from '../notifications/email.service';
import {
  Trip, Driver, FatigueLog, Report, Sanction, User, Municipality,
  DriverStatus, TripStatus, ReportStatus,
} from '../../entities';

// ─── Mock factory ─────────────────────────────────────────────────────────────
const mockRepo = () => ({
  find:               jest.fn(),
  findOne:            jest.fn(),
  createQueryBuilder: jest.fn(),
});

const FROM = new Date('2025-01-06T00:00:00');
const TO   = new Date('2025-01-12T23:59:59');

// ─── Test suite ───────────────────────────────────────────────────────────────
describe('MunicipalReportsService', () => {
  let service:         MunicipalReportsService;
  let tripRepo:        ReturnType<typeof mockRepo>;
  let driverRepo:      ReturnType<typeof mockRepo>;
  let fatigueRepo:     ReturnType<typeof mockRepo>;
  let reportRepo:      ReturnType<typeof mockRepo>;
  let sanctionRepo:    ReturnType<typeof mockRepo>;
  let userRepo:        ReturnType<typeof mockRepo>;
  let municipalityRepo: ReturnType<typeof mockRepo>;
  let emailService:    jest.Mocked<EmailService>;
  let mockQb:          any;

  beforeEach(async () => {
    tripRepo        = mockRepo();
    driverRepo      = mockRepo();
    fatigueRepo     = mockRepo();
    reportRepo      = mockRepo();
    sanctionRepo    = mockRepo();
    userRepo        = mockRepo();
    municipalityRepo = mockRepo();

    emailService = {
      send:       jest.fn().mockResolvedValue({ success: true }),
      isMockMode: true,
    } as unknown as jest.Mocked<EmailService>;

    mockQb = {
      select:     jest.fn().mockReturnThis(),
      addSelect:  jest.fn().mockReturnThis(),
      innerJoin:  jest.fn().mockReturnThis(),
      where:      jest.fn().mockReturnThis(),
      andWhere:   jest.fn().mockReturnThis(),
      groupBy:    jest.fn().mockReturnThis(),
      orderBy:    jest.fn().mockReturnThis(),
      limit:      jest.fn().mockReturnThis(),
      getCount:   jest.fn().mockResolvedValue(0),
      getMany:    jest.fn().mockResolvedValue([]),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    tripRepo.createQueryBuilder.mockReturnValue(mockQb);
    driverRepo.createQueryBuilder.mockReturnValue(mockQb);
    fatigueRepo.createQueryBuilder.mockReturnValue(mockQb);
    reportRepo.createQueryBuilder.mockReturnValue(mockQb);
    sanctionRepo.createQueryBuilder.mockReturnValue(mockQb);
    userRepo.find.mockResolvedValue([]);
    municipalityRepo.findOne.mockResolvedValue({ id: 'mun-uuid', name: 'Lima' });
    municipalityRepo.find.mockResolvedValue([{ id: 'mun-uuid', name: 'Lima' }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MunicipalReportsService,
        { provide: getRepositoryToken(Trip),         useValue: tripRepo },
        { provide: getRepositoryToken(Driver),       useValue: driverRepo },
        { provide: getRepositoryToken(FatigueLog),   useValue: fatigueRepo },
        { provide: getRepositoryToken(Report),       useValue: reportRepo },
        { provide: getRepositoryToken(Sanction),     useValue: sanctionRepo },
        { provide: getRepositoryToken(User),         useValue: userRepo },
        { provide: getRepositoryToken(Municipality), useValue: municipalityRepo },
        { provide: EmailService,                     useValue: emailService },
        { provide: ConfigService,                    useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<MunicipalReportsService>(MunicipalReportsService);
  });

  // ── gatherData ───────────────────────────────────────────────────────────────

  it('[gatherData] retorna estructura completa con zeros cuando no hay datos', async () => {
    const data = await service.gatherData('mun-uuid', FROM, TO, 'SEMANAL');

    expect(data.municipalityId).toBe('mun-uuid');
    expect(data.municipalityName).toBe('Lima');
    expect(data.type).toBe('SEMANAL');
    expect(data.tripsTotal).toBe(0);
    expect(data.driversApto).toBe(0);
    expect(data.reportsTotal).toBe(0);
    expect(data.sanctionsTotal).toBe(0);
    expect(data.trend).toBeUndefined(); // no trend for SEMANAL
  });

  it('[gatherData] cuenta viajes auto-cerrados desde el QB', async () => {
    mockQb.getCount
      .mockResolvedValueOnce(15) // tripsTotal
      .mockResolvedValueOnce(3); // tripsAutoClosed

    const data = await service.gatherData('mun-uuid', FROM, TO, 'SEMANAL');
    expect(data.tripsTotal).toBe(15);
    expect(data.tripsAutoClosed).toBe(3);
  });

  it('[gatherData] parsea conteos de conductores por estado', async () => {
    mockQb.getRawMany
      .mockResolvedValueOnce([
        { status: 'APTO',    cnt: '8'  },
        { status: 'RIESGO',  cnt: '3'  },
        { status: 'NO_APTO', cnt: '1'  },
      ])
      .mockResolvedValue([]); // subsequent calls return empty

    const data = await service.gatherData('mun-uuid', FROM, TO, 'SEMANAL');
    expect(data.driversApto).toBe(8);
    expect(data.driversRiesgo).toBe(3);
    expect(data.driversNoApto).toBe(1);
  });

  it('[gatherData] incluye tendencia (trend) para reporte MENSUAL', async () => {
    // All counts 0 (first period) and then 0 again (previous period)
    const data = await service.gatherData('mun-uuid', FROM, TO, 'MENSUAL');
    expect(data.trend).toBeDefined();
    expect(data.trend).toHaveProperty('trips');
    expect(data.trend).toHaveProperty('reports');
    expect(data.trend).toHaveProperty('sanctions');
  });

  it('[gatherData] calcula delta de tendencia correctamente', async () => {
    // trips current=10, previous=8 → delta=2, up=true
    let callCount = 0;
    mockQb.getCount.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(10); // trips current
      if (callCount === 2) return Promise.resolve(0);  // tripsAutoClosed
      if (callCount === 3) return Promise.resolve(8);  // trips previous (trend)
      return Promise.resolve(0);
    });

    const data = await service.gatherData('mun-uuid', FROM, TO, 'MENSUAL');
    expect(data.trend!.trips.current).toBe(10);
    expect(data.trend!.trips.previous).toBe(8);
    expect(data.trend!.trips.delta).toBe(2);
    expect(data.trend!.trips.up).toBe(true);
  });

  // ── generateAndSend ──────────────────────────────────────────────────────────

  it('[generateAndSend] envía email a cada usuario FISCAL/ADMIN', async () => {
    userRepo.find.mockResolvedValue([
      { id: 'u1', email: 'fiscal@test.com', name: 'Carlos' },
      { id: 'u2', email: 'admin@test.com',  name: 'María'  },
    ]);

    await service.generateAndSend('mun-uuid', 'SEMANAL', FROM, TO);

    expect(emailService.send).toHaveBeenCalledTimes(2);
    expect(emailService.send).toHaveBeenCalledWith(
      'fiscal@test.com',
      expect.any(String),
      expect.stringContaining('Lima'),
      expect.any(String),
      expect.objectContaining({ html_report: expect.any(String) }),
    );
  });

  it('[generateAndSend] no falla si no hay usuarios para notificar', async () => {
    userRepo.find.mockResolvedValue([]);
    await expect(service.generateAndSend('mun-uuid', 'SEMANAL', FROM, TO)).resolves.toBeDefined();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  // ── toCsv ────────────────────────────────────────────────────────────────────

  it('[toCsv] genera CSV con secciones correctas', async () => {
    const data = await service.gatherData('mun-uuid', FROM, TO, 'SEMANAL');
    const csv  = service.toCsv(data);

    expect(csv).toContain('VIAJES');
    expect(csv).toContain('CONDUCTORES');
    expect(csv).toContain('REPORTES CIUDADANOS');
    expect(csv).toContain('SANCIONES');
    expect(csv).toContain('TOP 5 MEJOR REPUTACIÓN');
    expect(csv).not.toContain('TENDENCIA'); // no trend for SEMANAL
  });

  it('[toCsv] incluye sección TENDENCIA para reporte MENSUAL', async () => {
    const data = await service.gatherData('mun-uuid', FROM, TO, 'MENSUAL');
    const csv  = service.toCsv(data);

    expect(csv).toContain('TENDENCIA');
  });

  // ── buildHtmlReport ──────────────────────────────────────────────────────────

  it('[buildHtmlReport] genera HTML con el nombre de la municipalidad', async () => {
    const data = await service.gatherData('mun-uuid', FROM, TO, 'SEMANAL');
    const html = service.buildHtmlReport(data);

    expect(html).toContain('Lima');
    expect(html).toContain('SFIT');
    expect(html).toContain('Reporte Semanal');
    expect(html).toContain('Sistema de Fiscalización Inteligente de Transporte');
  });

  // ── period helpers ────────────────────────────────────────────────────────────

  it('[getPreviousWeekRange] retorna 7 días completos', () => {
    const { from, to } = service.getPreviousWeekRange();
    const diff = to.getTime() - from.getTime();
    const days = diff / (24 * 60 * 60 * 1_000);
    expect(Math.round(days)).toBe(7); // Mon to Sun inclusive = 7 days
  });

  it('[getPreviousMonthRange] retorna el mes anterior completo', () => {
    const { from, to } = service.getPreviousMonthRange();
    expect(from.getDate()).toBe(1); // First day
    expect(to.getMonth()).toBe(from.getMonth()); // Same month
  });
});
