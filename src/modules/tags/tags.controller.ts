import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { apiOk } from 'src/common/utils/response.util';
import { AttachTagDto } from './dto/attach-tag.dto';
import { TagsService } from './tags.service';

@ApiTags('tags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v2')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post('repositories/:id/tags')
  async attachToRepository(
    @Param('id', new ParseUUIDPipe()) repositoryId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AttachTagDto,
  ) {
    const data = await this.tagsService.attachToRepository(repositoryId, user, dto);
    return apiOk(data);
  }

  @Delete('repositories/:id/tags/:tagName')
  async removeFromRepository(
    @Param('id', new ParseUUIDPipe()) repositoryId: string,
    @CurrentUser() user: AuthUser,
    @Param('tagName') tagName: string,
  ) {
    const data = await this.tagsService.removeFromRepository(
      repositoryId,
      user,
      tagName,
    );
    return apiOk(data);
  }

  @Post('entries/:entryId/tags')
  async attachToEntry(
    @Param('entryId', new ParseUUIDPipe()) entryId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: AttachTagDto,
  ) {
    const data = await this.tagsService.attachToEntry(entryId, user, dto);
    return apiOk(data);
  }

  @Delete('entries/:entryId/tags/:tagName')
  async removeFromEntry(
    @Param('entryId', new ParseUUIDPipe()) entryId: string,
    @CurrentUser() user: AuthUser,
    @Param('tagName') tagName: string,
  ) {
    const data = await this.tagsService.removeFromEntry(entryId, user, tagName);
    return apiOk(data);
  }
}
