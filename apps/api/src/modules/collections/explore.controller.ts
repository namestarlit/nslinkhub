import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CursorQueryDto } from "src/common/dto/cursor-query.dto";
import { apiOk } from "src/common/utils/response.util";
import { CollectionsService } from "./collections.service";

// Product-wide public discovery surface: published collections only.
@ApiTags("explore")
@Controller("api/v1/explore")
export class ExploreController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  async explore(@Query() query: CursorQueryDto) {
    const data = await this.collectionsService.explore(query);
    return apiOk(data.items, data.meta);
  }
}
