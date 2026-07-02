import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import type { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { apiOk } from 'src/common/utils/response.util';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('api/v2/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':username')
  async getByUsername(@Param('username') username: string) {
    const data = await this.usersService.getByUsername(username);
    return apiOk(data);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Patch(':username')
  async updateByUsername(
    @Param('username') username: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateUserDto,
  ) {
    const data = await this.usersService.updateByUsername(username, user, dto);
    return apiOk(data);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Delete(':username')
  async deleteByUsername(
    @Param('username') username: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.usersService.deleteByUsername(username, user);
    return apiOk(data);
  }
}
