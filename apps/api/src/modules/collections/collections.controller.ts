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
import { CursorQueryDto } from 'src/common/dto/cursor-query.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { apiOk } from 'src/common/utils/response.util';
import { CreateChildCollectionDto } from './dto/create-child-collection.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { CollectionsService } from './collections.service';

@ApiTags('collections')
@Controller('api/v1/collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCollectionDto,
  ) {
    const data = await this.collectionsService.create(user, dto);
    return apiOk(data);
  }

  @Get('public')
  async getPublic(@Query() query: CursorQueryDto) {
    const data = await this.collectionsService.getPublic(query);
    return apiOk(data.items, data.meta);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCollectionDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    const data = await this.collectionsService.update(id, user, dto, ifMatch);
    return apiOk(data);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Delete(':id')
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.collectionsService.remove(id, user);
    return apiOk(data);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post(':id/share-link')
  async createOrRotateShareLink(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.collectionsService.createOrRotateShareLink(
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
    @Body() dto: CreateChildCollectionDto,
  ) {
    const data = await this.collectionsService.createChild(id, user, dto);
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
    const data = await this.collectionsService.getChildren(
      id,
      user,
      shareToken,
      query,
    );
    return apiOk(data.items, data.meta);
  }
}
