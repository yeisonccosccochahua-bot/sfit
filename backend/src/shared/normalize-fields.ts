/** Map Spanish field name aliases → English (used by middleware and multipart controllers) */
export function normalizeSpanishFields(body: Record<string, any>): void {
  if (!body || typeof body !== 'object') return;
  const alias = (eng: string, esp: string) => {
    if (body[esp] !== undefined && body[eng] === undefined) {
      body[eng] = body[esp];
      delete body[esp];
    }
  };
  // Company
  alias('name',               'razon_social');
  alias('address',            'direccion');
  alias('phone',              'telefono');
  alias('representative',     'representante_legal');
  alias('representative_dni', 'dni_representante');
  // Vehicle
  alias('plate',                 'placa');
  alias('brand',                 'marca');
  alias('model',                 'modelo');
  alias('year',                  'anio');
  alias('capacity',              'capacidad_pasajeros');
  alias('photo_url',             'foto_url');
  alias('soat_expires_at',       'fecha_vencimiento_soat');
  alias('inspection_expires_at', 'fecha_vencimiento_revision_tecnica');
  // Driver
  alias('license_number',    'numero_licencia');
  alias('license_category',  'categoria_licencia');
  alias('license_expires_at','fecha_vencimiento_licencia');
  alias('license_photo_url', 'foto_licencia_url');
  // Common
  alias('status', 'estado');
  alias('reason', 'motivo_estado');
  alias('reason', 'motivo_inactividad');
  // Special: nombres + apellidos → name
  if (body['name'] === undefined && (body['nombres'] || body['apellidos'])) {
    body['name'] = [body['nombres'], body['apellidos']].filter(Boolean).join(' ');
    delete body['nombres'];
    delete body['apellidos'];
  }
}
