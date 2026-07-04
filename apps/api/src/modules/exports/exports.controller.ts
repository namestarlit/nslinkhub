import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { AuthGuard } from "src/common/guards/auth.guard";
import type { AuthUser } from "src/common/interfaces/auth-user.interface";
import { apiOk } from "src/common/utils/response.util";
import { ExportsService } from "./exports.service";

@ApiTags("exports")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("api/v1")
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post("collections/:id/export/markdown")
  async exportMarkdown(
    @Param("id", new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.exportsService.exportMarkdown(collectionId, user);
    return apiOk(data);
  }

  @Post("collections/:id/export/pdf")
  async exportPdf(
    @Param("id", new ParseUUIDPipe()) collectionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.exportsService.exportPdf(collectionId, user);
    return apiOk(data);
  }

  @Get("exports/jobs/:jobId")
  async getJob(@Param("jobId", new ParseUUIDPipe()) jobId: string, @CurrentUser() user: AuthUser) {
    const data = await this.exportsService.getJob(jobId, user);
    return apiOk(data);
  }
}
