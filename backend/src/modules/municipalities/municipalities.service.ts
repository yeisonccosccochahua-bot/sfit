import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Municipality } from '../../entities';

@Injectable()
export class MunicipalitiesService {
  constructor(
    @InjectRepository(Municipality) private munRepo: Repository<Municipality>,
  ) {}

  async getConfig(id: string, requestingMunicipalityId: string): Promise<Record<string, any>> {
    if (id !== requestingMunicipalityId) {
      throw new ForbiddenException('No puede acceder a la configuración de otra municipalidad');
    }
    const mun = await this.munRepo.findOne({ where: { id } });
    if (!mun) throw new NotFoundException(`Municipalidad ${id} no encontrada`);
    return mun.config_json ?? {};
  }

  async updateConfig(
    id: string,
    config: Record<string, any>,
    requestingMunicipalityId: string,
  ): Promise<Record<string, any>> {
    if (id !== requestingMunicipalityId) {
      throw new ForbiddenException('No puede modificar la configuración de otra municipalidad');
    }
    const mun = await this.munRepo.findOne({ where: { id } });
    if (!mun) throw new NotFoundException(`Municipalidad ${id} no encontrada`);
    mun.config_json = { ...(mun.config_json ?? {}), ...config };
    await this.munRepo.save(mun);
    return mun.config_json;
  }
}
