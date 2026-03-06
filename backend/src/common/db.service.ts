import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Pool } from "pg";

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;

  onModuleInit() {
    const host = process.env.DB_HOST || "127.0.0.1";
    const port = Number(process.env.DB_PORT || 5432);
    const user = process.env.DB_USERNAME || "postgres";
    const password = process.env.DB_PASSWORD || "";
    const database = process.env.DB_DATABASE || "postgres";
    const sslEnabled = process.env.DB_SSL === "true";

    // eslint-disable-next-line no-console
    console.log("[DbService] Connecting to Postgres", { host, port, user, database, ssl: sslEnabled });

    this.pool = new Pool({
      host,
      port,
      user,
      password,
      database,
      ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
    });
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  get client() {
    if (!this.pool) {
      throw new Error("DB pool is not initialized");
    }
    return this.pool;
  }
}


