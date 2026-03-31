import { Injectable, PipeTransform } from '@nestjs/common';

/** Maps Spanish field name aliases to English field names before validation */
@Injectable()
export class NormalizeCompanyPipe implements PipeTransform {
  transform(value: any) {
    if (typeof value !== 'object' || !value) return value;
    const out: Record<string, any> = {};
    const s = (k: string, v: any) => { if (v !== undefined && v !== null && v !== '') out[k] = v; };
    s('ruc',              value.ruc);
    s('name',             value.name             ?? value.razon_social);
    s('address',          value.address          ?? value.direccion);
    s('license',          value.license);
    s('phone',            value.phone            ?? value.telefono);
    s('email',            value.email);
    s('representative',   value.representative   ?? value.representante_legal);
    s('representative_dni', value.representative_dni ?? value.dni_representante);
    s('status',           value.status           ?? value.estado);
    return out;
  }
}
