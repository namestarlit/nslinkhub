import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  health() {
    return {
      status: 'ok',
    };
  }

  status() {
    return {
      status: 'ok',
      service: 'nslinkhub-api-v2',
    };
  }
}
