import { IsEmail, MaxLength } from "class-validator";

export class TransferCollectionDto {
  // The recipient's email. They must already be an editor on the collection.
  @IsEmail()
  @MaxLength(255)
  email: string;
}
