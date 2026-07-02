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
import { RepositoriesService } from './repositories.service';

// Owner+slug lookup lives under /users/:username/repositories/:slug so it can
// never collide with the /repositories/:id/* routes (a catch-all
// ':owner/:slug' under /repositories shadowed ':id/entries' and
// ':id/children').
@ApiTags('repositories')
@Controller('api/v2/users/:username/repositories')
export class RepositoryLookupController {
  constructor(private readonly repositoriesService: RepositoriesService) {}

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
    const data = await this.repositoriesService.getByOwnerAndSlug(
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

    return apiOk(data.repository, { etag: data.etag });
  }
}
