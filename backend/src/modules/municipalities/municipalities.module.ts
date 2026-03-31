import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Municipality } from '../../entities';
import { MunicipalitiesController } from './municipalities.controller';
import { MunicipalitiesService } from './municipalities.service';

@Module({
  imports: [TypeOrmModule.forFeature([Municipality])],
  controllers: [MunicipalitiesController],
  providers: [MunicipalitiesService],
  exports: [MunicipalitiesService],
})
export class MunicipalitiesModule {}
