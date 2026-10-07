import { Module } from "@nestjs/common";
import { AuthGuard } from "src/common/guards/auth.guard";
import { OptionalAuthGuard } from "src/common/guards/optional-auth.guard";
import { LinkPreviewController } from "./link-preview.controller";
import { ResourcesController } from "./resources.controller";
import { ResourcesService } from "./resources.service";

@Module({
  controllers: [ResourcesController, LinkPreviewController],
  providers: [ResourcesService, AuthGuard, OptionalAuthGuard],
  exports: [ResourcesService],
})
export class ResourcesModule {}
