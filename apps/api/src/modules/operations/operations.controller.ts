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
import { AccountLookupDto, AuditQueryDto, OperationDto } from "./operations.dto";
import { OperationsService, type OperatorRequest } from "./operations.service";

@UseGuards(AuthGuard)
@Controller("api/v1/operations")
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}
  @Get("accounts") async accounts(@Req() req: OperatorRequest, @Query() query: CursorQueryDto) {
    const result = await this.operations.listAccounts(req, query);
    return apiOk(result.items, result.meta);
  }
  @Post("accounts/lookup") async lookup(
    @Req() req: OperatorRequest,
    @Body() dto: AccountLookupDto,
  ) {
    return apiOk(await this.operations.lookup(req, dto.lookup));
  }
  @Get("accounts/:id") async account(
    @Req() req: OperatorRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return apiOk(await this.operations.account(req, id));
  }
  @Get("collections/:id") async collection(
    @Req() req: OperatorRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return apiOk(await this.operations.collection(req, id));
  }
  @Get("audit") async audit(@Req() req: OperatorRequest, @Query() query: AuditQueryDto) {
    const result = await this.operations.auditList(req, query);
    return apiOk(result.items, result.meta);
  }
  @Post("commands") async command(@Req() req: OperatorRequest, @Body() dto: OperationDto) {
    return apiOk(await this.operations.command(req, dto));
  }
}
