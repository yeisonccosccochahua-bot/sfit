import { Injectable, PipeTransform } from '@nestjs/common';

/** Maps Spanish field name aliases to English field names before validation */
@Injectable()
export class NormalizeDriverPipe implements PipeTransform {
  transform(value: any) {
    if (typeof value !== 'object' || !value) return value;
    const out: Record<string, any> = {};
    const s = (k: string, v: any) => { if (v !== undefined && v !== null && v !== '') out[k] = v; };

    // Combine nombres + apellidos → name
    const fullName = value.name
      ?? (value.nombres || value.apellidos
          ? [value.nombres, value.apellidos].filter(Boolean).join(' ')
          : undefined);

    s('name',                fullName);
    s('dni',                 value.dni);
    s('license_number',      value.license_number      ?? value.numero_licencia);
    s('license_category',    value.license_category    ?? value.categoria_licencia);
    s('license_expires_at',  value.license_expires_at  ?? value.fecha_vencimiento_licencia);
    s('phone',               value.phone               ?? value.telefono);
    s('email',               value.email);
    s('photo_url',           value.photo_url           ?? value.foto_url);
    s('license_photo_url',   value.license_photo_url);
    s('company_id',          value.company_id);
    s('status',              value.status              ?? value.estado);
    return out;
  }
}
