import { Module } from "@nestjs/common";
import { MemorialsService } from "./memorials.service";
import { MemorialsController } from "./memorials.controller";
import { DbService } from "../../common/db.service";
import { AuthModule } from "../auth/auth.module";
import { StorageService } from "../../common/storage.service";

@Module({
  imports: [AuthModule],
  controllers: [MemorialsController],
  providers: [MemorialsService, DbService, StorageService],
})
export class MemorialsModule {}
