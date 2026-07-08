import { Body, Controller, Post, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser } from "src/common/decorators/current-user.decorator";
import { AuthGuard } from "src/common/guards/auth.guard";
import type { AuthUser } from "src/common/interfaces/auth-user.interface";
import { CreateExportDto } from "./dto/create-export.dto";
import { ExportsService } from "./exports.service";

@ApiTags("exports")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("api/v1/exports")
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  // Synchronous export: the response body IS the file (or a zip when several
  // collections are selected) — no job to poll, nothing stored server-side.
  @Post()
  async export(
    @Body() dto: CreateExportDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.exportsService.export(user, dto);
    res.set({
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
    });
    return new StreamableFile(file.body);
  }
}
