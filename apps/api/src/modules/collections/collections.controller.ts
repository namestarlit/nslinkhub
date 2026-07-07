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
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { PaginationQueryDto } from "src/common/dto/pagination-query.dto";
import { AuthGuard } from "src/common/guards/auth.guard";
import { OptionalAuthGuard } from "src/common/guards/optional-auth.guard";
import type { AuthUser } from "src/common/interfaces/auth-user.interface";
import { apiOk } from "src/common/utils/response.util";
import { CollectionsService } from "./collections.service";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { CreateShareDto } from "./dto/create-share.dto";
import { NestCollectionDto } from "./dto/nest-collection.dto";
import { SetLinkSharingDto } from "./dto/set-link-sharing.dto";
import { TransferCollectionDto } from "./dto/transfer-collection.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";

@ApiTags("collections")
@Controller("api/v1/collections")
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateCollectionDto) {
    return apiOk(await this.collectionsService.create(user, dto));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch(":id")
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCollectionDto,
    @Headers("if-match") ifMatch?: string,
  ) {
    return apiOk(await this.collectionsService.update(id, user, dto, ifMatch));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Delete(":id")
  async remove(@Param("id", new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthUser) {
    return apiOk(await this.collectionsService.remove(id, user));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post(":id/publish")
  async publish(@Param("id", new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthUser) {
    return apiOk(await this.collectionsService.setPublished(id, user, true));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post(":id/unpublish")
  async unpublish(@Param("id", new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthUser) {
    return apiOk(await this.collectionsService.setPublished(id, user, false));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Put(":id/link-sharing")
  async setLinkSharing(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SetLinkSharingDto,
  ) {
    return apiOk(await this.collectionsService.setLinkSharing(id, user, dto));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get(":id/shares")
  async listShares(@Param("id", new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthUser) {
    return apiOk(await this.collectionsService.listShares(id, user));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post(":id/shares")
  async createShare(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateShareDto,
  ) {
    return apiOk(await this.collectionsService.createShare(id, user, dto));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Delete(":id/shares/:userId")
  async removeShare(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return apiOk(await this.collectionsService.removeShare(id, user, userId));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post(":id/transfer")
  async transfer(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: TransferCollectionDto,
  ) {
    return apiOk(await this.collectionsService.transfer(id, user, dto));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post(":id/save")
  async save(@Param("id", new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthUser) {
    return apiOk(await this.collectionsService.save(id, user));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Delete(":id/save")
  async unsave(@Param("id", new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthUser) {
    return apiOk(await this.collectionsService.unsave(id, user));
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post(":id/collections")
  async nestCollection(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: NestCollectionDto,
  ) {
    return apiOk(await this.collectionsService.nestCollection(id, user, dto));
  }

  @UseGuards(OptionalAuthGuard)
  @Get(":id/children")
  async getChildren(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser | null,
    @Query() query: PaginationQueryDto,
    @Headers("x-share-token") headerToken?: string,
    @Req() req?: Request,
  ) {
    const shareToken = headerToken ?? (req?.query.s as string | undefined);
    const data = await this.collectionsService.getChildren(id, user, shareToken, query);
    return apiOk(data.items, data.meta);
  }
}
