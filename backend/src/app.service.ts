import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'SFIT Backend',
      version: '1.0.0',
    };
  }
}
