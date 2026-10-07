import { Module } from "@nestjs/common";
import { AuthGuard } from "src/common/guards/auth.guard";
import { OptionalAuthGuard } from "src/common/guards/optional-auth.guard";
import { CollectionCommentsController, CommentsController } from "./comments.controller";
import { CommentsService } from "./comments.service";

@Module({
  controllers: [CollectionCommentsController, CommentsController],
  providers: [CommentsService, AuthGuard, OptionalAuthGuard],
})
export class CommentsModule {}
