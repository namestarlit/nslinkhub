import { Module } from "@nestjs/common";
import { ExportsController } from "./exports.controller";
import { ExportsService } from "./exports.service";

// Export is synchronous — no queue. BullMQ/Redis stay in the stack as the async
// backbone for future email/notifications (Phase E), wired when that ships.
@Module({
  controllers: [ExportsController],
  providers: [ExportsService],
  exports: [ExportsService],
})
export class ExportsModule {}
