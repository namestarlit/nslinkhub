import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt-auth.guard';
import type { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { apiOk } from 'src/common/utils/response.util';
import { CreateExternalEntryDto } from './dto/create-external-entry.dto';
import { CreateRepositoryLinkEntryDto } from './dto/create-repository-link-entry.dto';
import { ReorderEntriesDto } from './dto/reorder-entries.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { EntriesService } from './entries.service';

@ApiTags('entries')
@Controller('api/v2/repositories/:id/entries')
export class EntriesController {
  constructor(private readonly entriesService: EntriesService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('external')
  async createExternal(
    @Param('id', new ParseUUIDPipe()) repositoryId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateExternalEntryDto,
  ) {
    const data = await this.entriesService.createExternal(repositoryId, user, dto);
    return apiOk(data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('repository-link')
  async createRepositoryLink(
    @Param('id', new ParseUUIDPipe()) repositoryId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRepositoryLinkEntryDto,
  ) {
    const data = await this.entriesService.createRepositoryLink(
      repositoryId,
      user,
      dto,
    );
    return apiOk(data);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async getByRepository(
    @Param('id', new ParseUUIDPipe()) repositoryId: string,
    @CurrentUser() user: AuthUser | null,
    @Headers('x-share-token') headerToken?: string,
    @Req() req?: Request,
    @Query() query?: PaginationQueryDto,
  ) {
    const shareToken = headerToken ?? (req?.query.s as string | undefined);
    const safeQuery = query ?? { page: 1, limit: 20 };
    const data = await this.entriesService.getByRepository(
      repositoryId,
      user,
      shareToken,
      safeQuery,
    );
    return apiOk(data.items, data.meta);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':entryId')
  async update(
    @Param('id', new ParseUUIDPipe()) repositoryId: string,
    @Param('entryId', new ParseUUIDPipe()) entryId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateEntryDto,
  ) {
    const data = await this.entriesService.update(repositoryId, entryId, user, dto);
    return apiOk(data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':entryId')
  async remove(
    @Param('id', new ParseUUIDPipe()) repositoryId: string,
    @Param('entryId', new ParseUUIDPipe()) entryId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.entriesService.remove(repositoryId, entryId, user);
    return apiOk(data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('reorder')
  async reorder(
    @Param('id', new ParseUUIDPipe()) repositoryId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReorderEntriesDto,
  ) {
    const data = await this.entriesService.reorder(repositoryId, user, dto);
    return apiOk(data);
  }
}
