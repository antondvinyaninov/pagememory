import { Module } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { MemorialsModule } from "./modules/memorials/memorials.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { AdminModule } from "./modules/admin/admin.module";
import { UtilsModule } from "./modules/utils/utils.module";

@Module({
  imports: [
    // Rate Limiting - защита от брутфорса и DDoS
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 1000, // 1 секунда
        limit: 10, // 10 запросов в секунду
      },
      {
        name: "medium",
        ttl: 60000, // 1 минута
        limit: 100, // 100 запросов в минуту
      },
      {
        name: "long",
        ttl: 900000, // 15 минут
        limit: 1000, // 1000 запросов в 15 минут
      },
    ]),
    MemorialsModule,
    AuthModule,
    UsersModule,
    AdminModule,
    UtilsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

