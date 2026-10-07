import { Module } from "@nestjs/common";
import { ParsedUploadAuthorityInterceptor } from "src/common/authority.interceptor";
import { ImportsController } from "./imports.controller";
import { ImportsService } from "./imports.service";

@Module({
  controllers: [ImportsController],
  providers: [ImportsService, ParsedUploadAuthorityInterceptor],
  exports: [ImportsService],
})
export class ImportsModule {}
