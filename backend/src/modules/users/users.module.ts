import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { DbService } from "../../common/db.service";
import { AuthModule } from "../auth/auth.module";
import { StorageService } from "../../common/storage.service";

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService, DbService, StorageService],
})
export class UsersModule {}
