import {
  Controller,
  Get,
  Headers,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { OptionalAuthGuard } from 'src/common/guards/optional-auth.guard';
import type { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { ifNoneMatchHit } from 'src/common/utils/etag.util';
import { apiOk } from 'src/common/utils/response.util';
import { CollectionsService } from './collections.service';

// Interim owner+slug lookup under /users/:username/collections/:slug. It
// resolves the owner's personal hub, so it cannot collide with the
// /collections/:id/* routes. Phase C replaces it with the hub-scoped route
// GET /hubs/:hubId/collections/:slug.
@ApiTags('collections')
@Controller('api/v1/users/:username/collections')
export class CollectionLookupController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @UseGuards(OptionalAuthGuard)
  @Get(':slug')
  async getByOwnerAndSlug(
    @Param('username') username: string,
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser | null,
    @Headers('x-share-token') headerToken?: string,
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const shareToken = headerToken ?? (req?.query.s as string | undefined);
    const data = await this.collectionsService.getByOwnerAndSlug(
      username,
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
