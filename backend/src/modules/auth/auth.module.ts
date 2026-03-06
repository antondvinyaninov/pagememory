import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { DbService } from "../../common/db.service";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || "dev-secret-change-me",
      signOptions: { expiresIn: "7d" },
    }),
  ],
  providers: [AuthService, DbService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}

