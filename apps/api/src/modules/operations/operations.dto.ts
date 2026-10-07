import {
  type OperationAction,
  type OperationReason,
  operationActions,
  operationReasons,
} from "@nslinkhub/types";
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import { CursorQueryDto } from "../../common/dto/cursor-query.dto";
export class OperationDto {
  @IsIn(operationActions) action!: OperationAction;
  @IsUUID() targetId!: string;
  @IsIn(operationReasons) reason!: OperationReason;
  @IsInt() @Min(0) version!: number;
  @IsUUID() operationId!: string;
}
export class AccountLookupDto {
  @IsString() @MaxLength(254) lookup!: string;
}
export class AuditQueryDto extends CursorQueryDto {
  @IsOptional() @IsUUID() actor?: string;
  @IsOptional() @IsUUID() target?: string;
  @IsOptional() @IsString() @MaxLength(40) action?: string;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
}
