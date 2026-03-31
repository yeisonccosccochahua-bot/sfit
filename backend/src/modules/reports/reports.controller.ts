import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { ValidateReportDto } from './dto/validate-report.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole } from '../../entities';

@Controller('api/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ── POST /api/reports ─────────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.CIUDADANO)
  create(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket.remoteAddress ?? '';
    return this.reportsService.create(dto, user, ip);
  }

  // ── GET /api/reports/stats ─────────────────────────────────────────────────
  // IMPORTANT: must be declared BEFORE /:id to avoid route conflict
  @Get('stats')
  @Roles(UserRole.FISCAL, UserRole.ADMIN_MUNICIPAL)
  getStats(@CurrentUser() user: User) {
    return this.reportsService.getStats(user.municipality_id!);
  }

  // ── GET /api/reports ──────────────────────────────────────────────────────
  @Get()
  @Roles(UserRole.CIUDADANO, UserRole.FISCAL, UserRole.ADMIN_MUNICIPAL)
  findAll(@Query() query: ReportQueryDto, @CurrentUser() user: User) {
    return this.reportsService.findAll(query, user);
  }

  // ── GET /api/reports/:id ──────────────────────────────────────────────────
  @Get(':id')
  @Roles(UserRole.CIUDADANO, UserRole.FISCAL, UserRole.ADMIN_MUNICIPAL)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.reportsService.findOne(id, user);
  }

  // ── PATCH /api/reports/:id/validate ──────────────────────────────────────
  @Patch(':id/validate')
  @Roles(UserRole.FISCAL, UserRole.ADMIN_MUNICIPAL)
  validate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ValidateReportDto,
    @CurrentUser() user: User,
  ) {
    return this.reportsService.validate(id, dto, user);
  }
}
