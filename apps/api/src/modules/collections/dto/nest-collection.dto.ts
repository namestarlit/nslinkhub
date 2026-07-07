import { IsUUID } from "class-validator";

export class NestCollectionDto {
  // An existing collection in the same hub to nest as a section. It must be a
  // top-level, section-less collection (the two-level rule).
  @IsUUID()
  collectionId: string;
}
