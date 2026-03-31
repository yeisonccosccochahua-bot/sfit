import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, User } from '../../entities';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN_MUNICIPAL, UserRole.FISCAL)
  @ApiOperation({ summary: 'Listar registros de auditoría' })
  findAll(
    @CurrentUser() user: User,
    @Query('action') action?: string,
    @Query('entity_type') entity_type?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.findAll(user.municipality_id!, {
      action, entity_type, date_from, date_to, page: +page, limit: +limit,
    });
  }

  @Get('export')
  @Roles(UserRole.ADMIN_MUNICIPAL)
  @ApiOperation({ summary: 'Exportar auditoría como CSV' })
  async exportCsv(@CurrentUser() user: User, @Res() res: Response) {
    const csv = await this.service.exportCsv(user.municipality_id!);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit.csv"');
    res.send(csv);
  }
}
