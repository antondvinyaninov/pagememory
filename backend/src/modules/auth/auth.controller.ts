import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import type { Request, Response } from "express";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private cookieOptions() {
    const secure = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
    return {
      httpOnly: true,
      sameSite: "lax" as const,
      secure,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }

  @Post("login")
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 попыток входа в минуту
  async login(@Body() body: LoginDto, @Res() res: Response) {
    const { email, password } = body;
    // Валидация теперь выполняется автоматически через ValidationPipe

    const { token, user } = await this.authService.login(email, password);

    res
      .cookie("auth_token", token, {
        ...this.cookieOptions(),
      })
      .json({ success: true, user: { id: user.id, name: user.name, email: user.email } });
  }

  @Post("register")
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 регистрации в минуту
  async register(@Body() body: RegisterDto, @Res() res: Response) {
    const { first_name, last_name, email, password, password_confirmation } = body;
    // Валидация полей теперь выполняется автоматически через ValidationPipe
    
    if (password !== password_confirmation) {
      throw new BadRequestException("Пароли не совпадают");
    }

    const user = await this.authService.register(first_name, last_name, email, password);
    const token = await this.authService.login(user.email, password).then((r) => r.token);

    res
      .cookie("auth_token", token, {
        ...this.cookieOptions(),
      })
      .json({ success: true, user });
  }

  @Post("logout")
  async logout(@Res() res: Response) {
    res.clearCookie("auth_token").json({ success: true });
  }

  @Get("me")
  async me(@Req() req: Request) {
    const token = req.cookies?.["auth_token"];
    if (!token) {
      // Возвращаем 200 OK с null вместо 401, чтобы не было ошибок в консоли браузера
      return null;
    }
    const user = await this.authService.verifyToken(token);
    if (!user) {
      // Возвращаем 200 OK с null вместо 401, чтобы не было ошибок в консоли браузера
      return null;
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar ?? null,
      role: user.role ?? "user",
      country: user.country ?? null,
      region: user.region ?? null,
      city: user.city ?? null,
      profile_type: user.profile_type ?? "public",
      show_email: user.show_email ?? false,
      show_memorials: user.show_memorials ?? true,
    };
  }
}

