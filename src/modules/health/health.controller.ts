import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { apiOk } from 'src/common/utils/response.util';
import { HealthService } from './health.service';

@ApiTags('system')
@Controller('api/v2')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  health() {
    return apiOk(this.healthService.health());
  }

  @Get('status')
  status() {
    return apiOk(this.healthService.status());
  }
}
