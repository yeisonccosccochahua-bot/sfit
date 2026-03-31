import { Injectable, PipeTransform } from '@nestjs/common';

/** Maps Spanish field name aliases to English field names before validation */
@Injectable()
export class NormalizeVehiclePipe implements PipeTransform {
  transform(value: any) {
    if (typeof value !== 'object' || !value) return value;
    const out: Record<string, any> = {};
    const s = (k: string, v: any) => { if (v !== undefined && v !== null && v !== '') out[k] = v; };

    s('plate',                 value.plate                ?? value.placa);
    s('brand',                 value.brand                ?? value.marca);
    s('model',                 value.model                ?? value.modelo);
    s('year',                  value.year                 ?? value.anio);
    s('color',                 value.color);
    s('capacity',              value.capacity             ?? value.capacidad_pasajeros);
    s('photo_url',             value.photo_url            ?? value.foto_url);
    s('soat_expires_at',       value.soat_expires_at      ?? value.fecha_vencimiento_soat);
    s('inspection_expires_at', value.inspection_expires_at ?? value.fecha_vencimiento_revision_tecnica);
    s('company_id',            value.company_id);
    s('status',                value.status               ?? value.estado);
    return out;
  }
}
