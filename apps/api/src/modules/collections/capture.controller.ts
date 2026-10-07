import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import type { AuthUser } from "../../common/interfaces/auth-user.interface";
import { apiOk } from "../../common/utils/response.util";
import { CaptureService } from "./capture.service";
import { CaptureDto } from "./dto/capture.dto";
@Controller("api/v1/capture")
@UseGuards(AuthGuard)
export class CaptureController {
  constructor(private readonly capture: CaptureService) {}
  @Post()
  async save(@CurrentUser() user: AuthUser, @Body() dto: CaptureDto) {
    return apiOk(await this.capture.save(user, dto));
  }
}
