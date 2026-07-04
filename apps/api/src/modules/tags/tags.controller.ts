import { Body, Controller, Delete, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { AuthGuard } from "src/common/guards/auth.guard";
import type { AuthUser } from "src/common/interfaces/auth-user.interface";
import { apiOk } from "src/common/utils/response.util";
import { AttachTagDto } from "./dto/attach-tag.dto";
import { TagsService } from "./tags.service";

@ApiTags("tags")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("api/v1")
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post("collections/:id/tags")
  async attachToCollection(
    @Param("id", new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AttachTagDto,
  ) {
    const data = await this.tagsService.attachToCollection(collectionId, user, dto);
    return apiOk(data);
  }

  @Delete("collections/:id/tags/:tagName")
  async removeFromCollection(
    @Param("id", new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: AuthUser,
    @Param("tagName") tagName: string,
  ) {
    const data = await this.tagsService.removeFromCollection(collectionId, user, tagName);
    return apiOk(data);
  }

  @Post("resources/:resourceId/tags")
  async attachToResource(
    @Param("resourceId", new ParseUUIDPipe()) resourceId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AttachTagDto,
  ) {
    const data = await this.tagsService.attachToResource(resourceId, user, dto);
    return apiOk(data);
  }

  @Delete("resources/:resourceId/tags/:tagName")
  async removeFromResource(
    @Param("resourceId", new ParseUUIDPipe()) resourceId: string,
    @CurrentUser() user: AuthUser,
    @Param("tagName") tagName: string,
  ) {
    const data = await this.tagsService.removeFromResource(resourceId, user, tagName);
    return apiOk(data);
  }
}
