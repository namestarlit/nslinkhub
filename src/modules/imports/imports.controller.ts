import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { apiOk } from 'src/common/utils/response.util';
import { ImportTargetDto } from './dto/import-target.dto';
import { ImportsService } from './imports.service';

@ApiTags('imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v2/imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('csv')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @UploadedFile() file: unknown,
    @CurrentUser() user: AuthUser,
    @Body() dto: ImportTargetDto,
  ) {
    const data = await this.importsService.importCsv(user, file, dto);
    return apiOk(data);
  }

  @Post('bookmarks-html')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importBookmarksHtml(
    @UploadedFile() file: unknown,
    @CurrentUser() user: AuthUser,
    @Body() dto: ImportTargetDto,
  ) {
    const data = await this.importsService.importBookmarksHtml(user, file, dto);
    return apiOk(data);
  }

  @Post('whatsapp-txt')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importWhatsappTxt(
    @UploadedFile() file: unknown,
    @CurrentUser() user: AuthUser,
    @Body() dto: ImportTargetDto,
  ) {
    const data = await this.importsService.importWhatsappTxt(user, file, dto);
    return apiOk(data);
  }
}
