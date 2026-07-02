import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import type { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { apiOk } from 'src/common/utils/response.util';
import { ExportsService } from './exports.service';

@ApiTags('exports')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/v2')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post('repositories/:id/export/markdown')
  async exportMarkdown(
    @Param('id', new ParseUUIDPipe()) repositoryId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.exportsService.exportMarkdown(repositoryId, user);
    return apiOk(data);
  }

  @Post('repositories/:id/export/pdf')
  async exportPdf(
    @Param('id', new ParseUUIDPipe()) repositoryId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.exportsService.exportPdf(repositoryId, user);
    return apiOk(data);
  }

  @Get('exports/jobs/:jobId')
  async getJob(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.exportsService.getJob(jobId, user);
    return apiOk(data);
  }
}
