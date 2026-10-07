import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { AuthGuard } from "src/common/guards/auth.guard";
import { OptionalAuthGuard } from "src/common/guards/optional-auth.guard";
import type { AuthUser } from "src/common/interfaces/auth-user.interface";
import { apiOk } from "src/common/utils/response.util";
import { shareTokenFrom } from "src/common/utils/token.util";
import { CommentsService } from "./comments.service";
import { CommentQueryDto, CreateCommentDto, UpdateCommentDto } from "./dto/comment.dto";

@ApiTags("comments")
@Controller("api/v1/collections/:id/comments")
export class CollectionCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @UseGuards(OptionalAuthGuard)
  @Get()
  async list(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser | null,
    @Query() query: CommentQueryDto,
    @Headers("x-share-token") headerToken?: string,
    @Req() req?: Request,
  ) {
    const result = await this.comments.list(id, user, shareTokenFrom(headerToken, req), query);
    return apiOk(result.data, { limit: query.limit ?? 20, nextCursor: result.nextCursor });
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post()
  async create(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCommentDto,
    @Headers("x-share-token") headerToken?: string,
    @Req() req?: Request,
  ) {
    return apiOk(await this.comments.create(id, user, shareTokenFrom(headerToken, req), dto));
  }
}

// Literal action routes are declared before the bare :id routes.
@ApiTags("comments")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("api/v1/comments")
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post(":id/hide") @HttpCode(200) hide(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.setHidden(id, user, true).then(apiOk);
  }

  @Post(":id/show") @HttpCode(200) show(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.setHidden(id, user, false).then(apiOk);
  }

  @Post(":id/accept") @HttpCode(200) accept(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.setAccepted(id, user, true).then(apiOk);
  }

  @Post(":id/unaccept") @HttpCode(200) unaccept(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.setAccepted(id, user, false).then(apiOk);
  }

  @Patch(":id") update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.comments.update(id, user, dto).then(apiOk);
  }

  @Delete(":id") remove(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.remove(id, user).then(apiOk);
  }
}
