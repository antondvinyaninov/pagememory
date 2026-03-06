import { Injectable, UnauthorizedException } from "@nestjs/common";
import { DbService } from "../../common/db.service";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  role?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  profile_type?: string | null;
  show_email?: boolean;
  show_memorials?: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DbService,
    private readonly jwt: JwtService,
  ) {}

  private async findUserByEmail(email: string): Promise<{
    id: number;
    name: string;
    email: string;
    password: string;
    avatar?: string | null;
    role?: string | null;
  } | null> {
    const sql = `
      SELECT id, name, email, password, avatar, role
      FROM users
      WHERE email = $1
      LIMIT 1
    `;
    const result = await this.db.client.query(sql, [email]);

    return (result.rows[0] as any) ?? null;
  }

  async validateUser(email: string, password: string): Promise<AuthUser> {
    const user = await this.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException("Неверный логин или пароль");
    }

    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      throw new UnauthorizedException("Неверный логин или пароль");
    }

    return { id: user.id, name: user.name, email: user.email, avatar: (user as any).avatar ?? null };
  }

  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const user = await this.validateUser(email, password);
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email });
    return { token, user };
  }

  async register(firstName: string, lastName: string, email: string, password: string): Promise<AuthUser> {
    const existing = await this.findUserByEmail(email);
    if (existing) {
      throw new UnauthorizedException("Пользователь с таким email уже существует");
    }

    const hashed = await bcrypt.hash(password, 10);
    const name = `${firstName} ${lastName}`.trim();

    const sql = `
      INSERT INTO users (name, email, password, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING id, name, email
    `;
    const result = await this.db.client.query(sql, [name, email, hashed]);
    const row = result.rows[0] as AuthUser;
    return row;
  }

  async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: number; email: string }>(token);
      const sql = `
        SELECT
          id,
          name,
          email,
          avatar,
          role,
          country,
          region,
          city,
          profile_type,
          COALESCE(show_email, false) AS show_email,
          COALESCE(show_memorials, true) AS show_memorials
        FROM users
        WHERE id = $1
        LIMIT 1
      `;
      const result = await this.db.client.query(sql, [payload.sub]);
      const row = result.rows[0];
      if (!row) return null;
      return row as AuthUser;
    } catch {
      return null;
    }
  }
}

