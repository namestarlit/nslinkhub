import {
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { OptionalAuthGuard } from 'src/common/guards/optional-auth.guard';
import type { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { CursorQueryDto } from 'src/common/dto/cursor-query.dto';
import { ifNoneMatchHit } from 'src/common/utils/etag.util';
import { apiOk } from 'src/common/utils/response.util';
import { CollectionsService } from './collections.service';

@ApiTags('hubs')
@Controller('api/v1/hubs')
export class HubsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  // Public hub page: display info + published collections.
  @Get(':hubId')
  async getHubPage(
    @Param('hubId', new ParseUUIDPipe()) hubId: string,
    @Query() query: CursorQueryDto,
  ) {
    const data = await this.collectionsService.getHubPage(hubId, query);
    return apiOk({ hub: data.hub, collections: data.collections }, data.meta);
  }

  // Hub collection list: members see all; others see the published subset.
  @UseGuards(OptionalAuthGuard)
  @Get(':hubId/collections')
  async listHubCollections(
    @Param('hubId', new ParseUUIDPipe()) hubId: string,
    @CurrentUser() user: AuthUser | null,
    @Query() query: CursorQueryDto,
  ) {
    const data = await this.collectionsService.listHubCollections(
      hubId,
      user,
      query,
    );
    return apiOk(data.items, data.meta);
  }

  // Canonical collection lookup by hub + slug (replaces the username route).
  @UseGuards(OptionalAuthGuard)
  @Get(':hubId/collections/:slug')
  async getCollectionBySlug(
    @Param('hubId', new ParseUUIDPipe()) hubId: string,
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser | null,
    @Headers('x-share-token') headerToken?: string,
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const shareToken = headerToken ?? (req?.query.s as string | undefined);
    const data = await this.collectionsService.getHubCollectionBySlug(
      hubId,
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

    return apiOk(data.collection, { etag: data.etag });
  }
}
