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
import { AuthGuard } from 'src/common/guards/auth.guard';
import { OptionalAuthGuard } from 'src/common/guards/optional-auth.guard';
import type { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { apiOk } from 'src/common/utils/response.util';
import { CreateChildRepositoryDto } from './dto/create-child-repository.dto';
import { CreateRepositoryDto } from './dto/create-repository.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';
import { RepositoriesService } from './repositories.service';

@ApiTags('repositories')
@Controller('api/v1/repositories')
export class RepositoriesController {
  constructor(private readonly repositoriesService: RepositoriesService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
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

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.repositoriesService.remove(id, user);
    return apiOk(data);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post(':id/share-link')
  async createOrRotateShareLink(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.repositoriesService.createOrRotateShareLink(
      id,
      user,
    );
    return apiOk(data);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post(':id/children')
  async createChild(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateChildRepositoryDto,
  ) {
    const data = await this.repositoriesService.createChild(id, user, dto);
    return apiOk(data);
  }

  @UseGuards(OptionalAuthGuard)
  @Get(':id/children')
  async getChildren(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser | null,
    @Query() query: PaginationQueryDto,
    @Headers('x-share-token') headerToken?: string,
    @Req() req?: Request,
  ) {
    const shareToken = headerToken ?? (req?.query.s as string | undefined);
    const data = await this.repositoriesService.getChildren(
      id,
      user,
      shareToken,
      query,
    );
    return apiOk(data.items, data.meta);
  }
}
