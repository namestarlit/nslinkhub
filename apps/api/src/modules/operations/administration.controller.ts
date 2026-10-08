import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";
import { AuthGuard } from "../../common/guards/auth.guard";
import { apiOk } from "../../common/utils/response.util";
import { InviteCommandDto, InviteDto, VersionDto } from "./administration.dto";
import { AdministrationService } from "./administration.service";
import type { OperatorRequest } from "./operations.service";
@UseGuards(AuthGuard)
@Controller("api/v1/operations")
export class AdministrationController {
  constructor(private readonly administration: AdministrationService) {}
  @Get("operators") async operators(@Req() req: OperatorRequest, @Query() query: CursorQueryDto) {
    const result = await this.administration.operators(req, query);
    return apiOk(result.items, result.meta);
  }
  @Get("operator-invitations") async invitations(
    @Req() req: OperatorRequest,
    @Query() query: CursorQueryDto,
  ) {
    const result = await this.administration.list(req, query);
    return apiOk(result.items, result.meta);
  }
  @Post("operator-invitations") async create(@Req() req: OperatorRequest, @Body() dto: InviteDto) {
    return apiOk(await this.administration.create(req, dto));
  }
  @Post("operator-invitations/:id") async change(
    @Req() req: OperatorRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: InviteCommandDto,
  ) {
    return apiOk(await this.administration.change(req, id, dto));
  }
  @Post("operators/:id/revoke") async revoke(
    @Req() req: OperatorRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: VersionDto,
  ) {
    return apiOk(await this.administration.revoke(req, id, dto));
  }
}
