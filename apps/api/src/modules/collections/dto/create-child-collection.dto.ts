import { OmitType } from "@nestjs/mapped-types";
import { CreateCollectionDto } from "./create-collection.dto";

export class CreateChildCollectionDto extends OmitType(CreateCollectionDto, [
  "parentCollectionId",
] as const) {}
