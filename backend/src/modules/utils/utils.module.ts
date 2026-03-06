import { Module } from "@nestjs/common";
import { UtilsController } from "./utils.controller";
import { UtilsService } from "./utils.service";
import { DbService } from "../../common/db.service";

@Module({
  controllers: [UtilsController],
  providers: [UtilsService, DbService],
  exports: [UtilsService],
})
export class UtilsModule {}
