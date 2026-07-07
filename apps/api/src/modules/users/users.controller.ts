import { Body, Controller, Delete, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { AuthGuard } from "src/common/guards/auth.guard";
import type { AuthUser } from "src/common/interfaces/auth-user.interface";
import { apiOk } from "src/common/utils/response.util";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

// The authenticated user's own profile. Public identity is the hub handle
// (see the hub page), so there is no public user-by-username lookup.
@ApiTags("profile")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("api/v1/profile")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getMe(@CurrentUser() user: AuthUser) {
    return apiOk(await this.usersService.getMe(user));
  }

  @Patch()
  async updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto) {
    return apiOk(await this.usersService.updateMe(user, dto));
  }

  @Delete()
  async deleteMe(@CurrentUser() user: AuthUser) {
    return apiOk(await this.usersService.deleteMe(user));
  }
}
