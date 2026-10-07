import {
  type OperationAction,
  type OperationReason,
  type OperatorAuditAction,
  operationActions,
  operationReasons,
  operatorAuditActions,
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
// Accounts are found the way people know them: an email or a hub handle.
export class AccountListQueryDto extends CursorQueryDto {
  @IsOptional() @IsString() @MaxLength(254) q?: string;
}
// A collection link as copied from the site: /c/<id> or /@handle/<slug>,
// with or without the origin.
export class CollectionLinkQueryDto {
  @IsString() @MaxLength(2048) link!: string;
}
export class AuditQueryDto extends CursorQueryDto {
  // An email, hub handle or id; matches who acted or who was affected.
  @IsOptional() @IsString() @MaxLength(254) q?: string;
  @IsOptional() @IsIn(operatorAuditActions) action?: OperatorAuditAction;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
}
