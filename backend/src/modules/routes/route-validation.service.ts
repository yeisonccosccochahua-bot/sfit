import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Route } from '../../entities/route.entity';
import { Driver, DriverStatus } from '../../entities/driver.entity';
import { Trip, TripStatus } from '../../entities/trip.entity';

export interface RouteRules {
  routeId: string;
  origin: string;
  destination: string;
  min_drivers: number;
  rest_between_legs_hours: number | null;
  allows_roundtrip: boolean;
  estimated_duration_minutes: number;
}

export interface DriverValidationResult {
  valid: boolean;
  reason?: string;
  aptDriversFound?: number;
  requiredDrivers?: number;
}

export interface ReturnLegValidationResult {
  allowed: boolean;
  reason?: string;
  /** Horas que restan para poder iniciar el retorno */
  waitHours?: number;
}

@Injectable()
export class RouteValidationService {
  constructor(
    @InjectRepository(Route)
    private routeRepo: Repository<Route>,
    @InjectRepository(Driver)
    private driverRepo: Repository<Driver>,
    @InjectRepository(Trip)
    private tripRepo: Repository<Trip>,
  ) {}

  // ──────────────────────────────────────────────
  // getRouteRules
  // ──────────────────────────────────────────────
  async getRouteRules(routeId: string): Promise<RouteRules> {
    const route = await this.routeRepo.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException(`Ruta ${routeId} no encontrada`);

    return {
      routeId: route.id,
      origin: route.origin,
      destination: route.destination,
      min_drivers: route.min_drivers ?? 1,
      rest_between_legs_hours: route.rest_between_legs_hours != null ? Number(route.rest_between_legs_hours) : null,
      allows_roundtrip: route.allows_roundtrip ?? false,
      estimated_duration_minutes: route.estimated_duration_minutes,
    };
  }

  // ──────────────────────────────────────────────
  // validateDriverRequirements
  // Verifica que los IDs de conductor provistos cumplen con:
  //  1. Cantidad >= route.min_drivers
  //  2. Todos en estado APTO
  // ──────────────────────────────────────────────
  async validateDriverRequirements(
    routeId: string,
    driverIds: string[],
  ): Promise<DriverValidationResult> {
    const rules = await this.getRouteRules(routeId);

    if (!driverIds || driverIds.length === 0) {
      return {
        valid: false,
        reason: 'Se debe asignar al menos un conductor',
        aptDriversFound: 0,
        requiredDrivers: rules.min_drivers,
      };
    }

    if (driverIds.length < rules.min_drivers) {
      return {
        valid: false,
        reason: `Esta ruta requiere mínimo ${rules.min_drivers} conductor(es). Solo se asignaron ${driverIds.length}`,
        aptDriversFound: driverIds.length,
        requiredDrivers: rules.min_drivers,
      };
    }

    const drivers = await this.driverRepo.find({
      where: { id: In(driverIds) },
      select: ['id', 'status', 'name', 'dni'],
    });

    if (drivers.length !== driverIds.length) {
      const found = drivers.map((d) => d.id);
      const missing = driverIds.filter((id) => !found.includes(id));
      return {
        valid: false,
        reason: `Conductor(es) no encontrado(s): ${missing.join(', ')}`,
        aptDriversFound: drivers.length,
        requiredDrivers: rules.min_drivers,
      };
    }

    const notApt = drivers.filter((d) => d.status !== DriverStatus.APTO);
    if (notApt.length > 0) {
      const names = notApt.map((d) => `${d.name} (${d.status})`).join(', ');
      return {
        valid: false,
        reason: `Los siguientes conductores no están en estado APTO: ${names}`,
        aptDriversFound: drivers.length - notApt.length,
        requiredDrivers: rules.min_drivers,
      };
    }

    return {
      valid: true,
      aptDriversFound: drivers.length,
      requiredDrivers: rules.min_drivers,
    };
  }

  // ──────────────────────────────────────────────
  // validateReturnLeg
  // Verifica que el retorno puede registrarse:
  //  1. La ruta permite roundtrip
  //  2. El viaje de ida está FINALIZADO
  //  3. Han pasado rest_between_legs_hours desde que terminó la ida
  // ──────────────────────────────────────────────
  async validateReturnLeg(
    routeId: string,
    parentTripId: string,
  ): Promise<ReturnLegValidationResult> {
    const rules = await this.getRouteRules(routeId);

    if (!rules.allows_roundtrip) {
      return {
        allowed: false,
        reason: `La ruta ${rules.origin} ↔ ${rules.destination} no permite viajes de retorno`,
      };
    }

    const parentTrip = await this.tripRepo.findOne({
      where: { id: parentTripId },
      select: ['id', 'status', 'end_time', 'route_id', 'is_return_leg'],
    });

    if (!parentTrip) {
      return { allowed: false, reason: `Viaje de ida ${parentTripId} no encontrado` };
    }

    if (parentTrip.is_return_leg) {
      return { allowed: false, reason: 'El viaje padre ya es un retorno; no se puede encadenar otro retorno' };
    }

    if (parentTrip.route_id !== routeId) {
      return { allowed: false, reason: 'El viaje de ida no pertenece a esta ruta' };
    }

    if (parentTrip.status !== TripStatus.FINALIZADO) {
      return {
        allowed: false,
        reason: `El viaje de ida debe estar FINALIZADO (estado actual: ${parentTrip.status})`,
      };
    }

    if (rules.rest_between_legs_hours && rules.rest_between_legs_hours > 0) {
      if (!parentTrip.end_time) {
        return { allowed: false, reason: 'El viaje de ida no tiene hora de fin registrada' };
      }

      const restMs = rules.rest_between_legs_hours * 60 * 60 * 1000;
      const earliestReturn = new Date(parentTrip.end_time.getTime() + restMs);
      const now = new Date();

      if (now < earliestReturn) {
        const waitMs = earliestReturn.getTime() - now.getTime();
        const waitHours = Math.ceil((waitMs / (60 * 60 * 1000)) * 10) / 10;
        return {
          allowed: false,
          reason: `Se requieren ${rules.rest_between_legs_hours}h de descanso entre tramos. Faltan ${waitHours}h`,
          waitHours,
        };
      }
    }

    return { allowed: true };
  }
}
