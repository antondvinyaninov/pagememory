import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { DbService } from "../../common/db.service";
import { AuthModule } from "../auth/auth.module";
import { AdminMailerService } from "./admin-mailer.service";

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, AdminMailerService, DbService],
})
export class AdminModule {}
