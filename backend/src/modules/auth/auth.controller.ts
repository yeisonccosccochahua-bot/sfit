import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { MunicipalityGuard } from './guards/municipality.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../../entities/user.entity';

@ApiTags('Auth')
@UseGuards(JwtAuthGuard, RolesGuard, MunicipalityGuard)
@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ──────────────────────────────────────────────
  // REGISTER
  // ──────────────────────────────────────────────
  @Post('register')
  @Public()
  @ApiOperation({
    summary: 'Registro de usuario',
    description:
      'CIUDADANO puede auto-registrarse. Los roles ADMIN_MUNICIPAL, FISCAL, OPERADOR_EMPRESA e INSPECTOR requieren autenticación como ADMIN_MUNICIPAL.',
  })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  @ApiResponse({ status: 409, description: 'Email o DNI ya registrados' })
  @ApiResponse({ status: 403, description: 'Sin permiso para crear este rol' })
  async register(
    @Body() dto: RegisterDto,
    @CurrentUser() requestingUser?: User,
  ) {
    return this.authService.register(dto, requestingUser);
  }

  // ──────────────────────────────────────────────
  // LOGIN
  // ──────────────────────────────────────────────
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión', description: 'Retorna access_token (8h) y refresh_token (7d)' })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expires_in: 28800,
        token_type: 'Bearer',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas o cuenta bloqueada' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ──────────────────────────────────────────────
  // PROFILE
  // ──────────────────────────────────────────────
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Datos del usuario autenticado' })
  @ApiResponse({ status: 401, description: 'Token inválido o expirado' })
  async getProfile(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }

  @Patch('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar perfil (nombre, teléfono, contraseña)' })
  @ApiResponse({ status: 200, description: 'Perfil actualizado' })
  @ApiResponse({ status: 401, description: 'Token inválido o expirado' })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, dto);
  }

  // ──────────────────────────────────────────────
  // REFRESH
  // ──────────────────────────────────────────────
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renovar access token',
    description: 'Envía el refresh_token obtenido en login para recibir nuevos tokens.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Tokens renovados' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refresh_token);
  }
}
