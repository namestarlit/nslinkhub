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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-jwt-auth.guard';
import type { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { ifNoneMatchHit } from 'src/common/utils/etag.util';
import { apiOk } from 'src/common/utils/response.util';
import { CreateChildRepositoryDto } from './dto/create-child-repository.dto';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { CreateShareLinkDto } from './dto/create-share-link.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';
import { RepositoriesService } from './repositories.service';

@ApiTags('repositories')
@Controller('api/v2/repositories')
export class RepositoriesController {
  constructor(private readonly repositoriesService: RepositoriesService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRepositoryDto,
  ) {
    const data = await this.repositoriesService.create(user, dto);
    return apiOk(data);
  }

  @Get('public')
  async getPublic(@Query() query: PaginationQueryDto) {
    const data = await this.repositoriesService.getPublic(query);
    return apiOk(data.items, data.meta);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':owner/:slug')
  async getByOwnerAndSlug(
    @Param('owner') owner: string,
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser | null,
    @Headers('x-share-token') headerToken?: string,
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const shareToken = headerToken ?? (req?.query.s as string | undefined);
    const data = await this.repositoriesService.getByOwnerAndSlug(
      owner,
      slug,
      user,
      shareToken,
    );

    if (res) {
      res.setHeader('ETag', data.etag);
      res.setHeader('Last-Modified', data.lastModified);
    }

    const ifNoneMatchHeader = req?.headers['if-none-match'];
    const ifNoneMatchValue = Array.isArray(ifNoneMatchHeader)
      ? ifNoneMatchHeader.join(',')
      : ifNoneMatchHeader;

    if (ifNoneMatchHit(ifNoneMatchValue, data.etag) && res) {
      res.status(304);
      return;
    }

    return apiOk(data.repository, { etag: data.etag });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRepositoryDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    const data = await this.repositoriesService.update(id, user, dto, ifMatch);
    return apiOk(data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.repositoriesService.remove(id, user);
    return apiOk(data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/share-link')
  async createOrRotateShareLink(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateShareLinkDto,
  ) {
    const data = await this.repositoriesService.createOrRotateShareLink(
      id,
      user,
      dto,
    );
    return apiOk(data);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':id/children')
  async createChild(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateChildRepositoryDto,
  ) {
    const data = await this.repositoriesService.createChild(id, user, dto);
    return apiOk(data);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/children')
  async getChildren(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser | null,
    @Query() query: PaginationQueryDto,
    @Headers('x-share-token') headerToken?: string,
    @Req() req?: Request,
  ) {
    const shareToken = headerToken ?? (req?.query.s as string | undefined);
    const data = await this.repositoriesService.getChildren(id, user, shareToken, query);
    return apiOk(data.items, data.meta);
  }
}
