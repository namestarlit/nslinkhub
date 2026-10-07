import { Module } from "@nestjs/common";
import { HubsModule } from "../hubs/hubs.module";
import { AdministrationController, InvitationsController } from "./administration.controller";
import { AdministrationService } from "./administration.service";
import { NotificationsController } from "./notifications.controller";
import { OperationsController } from "./operations.controller";
import { OperationsService } from "./operations.service";
import { SessionController } from "./session.controller";
@Module({
  imports: [HubsModule],
  controllers: [
    OperationsController,
    SessionController,
    NotificationsController,
    AdministrationController,
    InvitationsController,
  ],
  providers: [OperationsService, AdministrationService],
})
export class OperationsModule {}
