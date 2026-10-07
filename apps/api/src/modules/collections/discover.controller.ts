import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CursorQueryDto } from "src/common/dto/cursor-query.dto";
import { apiOk } from "src/common/utils/response.util";
import { CollectionsService } from "./collections.service";

// Product-wide public discovery surface: published collections only.
@ApiTags("discover")
@Controller("api/v1/discover")
export class DiscoverController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  async discover(@Query() query: CursorQueryDto) {
    const data = await this.collectionsService.discover(query);
    return apiOk(data.items, data.meta);
  }
}
