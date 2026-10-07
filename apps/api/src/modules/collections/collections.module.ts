import { Module } from "@nestjs/common";
import { ResourcesModule } from "../resources/resources.module";
import { CaptureController } from "./capture.controller";
import { CaptureService } from "./capture.service";
import { CollectionsController } from "./collections.controller";
import { CollectionsService } from "./collections.service";
import { DiscoverController } from "./discover.controller";
import { HubsController } from "./hubs.controller";
import { MeController } from "./me.controller";

@Module({
  imports: [ResourcesModule],
  controllers: [
    CaptureController,
    CollectionsController,
    DiscoverController,
    HubsController,
    MeController,
  ],
  providers: [CollectionsService, CaptureService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
