import { Controller, Get, Query } from "@nestjs/common";
import { UtilsService } from "./utils.service";

@Controller("utils")
export class UtilsController {
  constructor(private readonly utilsService: UtilsService) {}

  @Get("dadata/cities")
  async getCitySuggestions(@Query("query") query: string) {
    if (!query || query.length < 2) {
      return { suggestions: [] };
    }
    return await this.utilsService.getCitySuggestions(query);
  }
}
