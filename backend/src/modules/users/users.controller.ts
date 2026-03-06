import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { AuthService } from "../auth/auth.service";
import type { Request } from "express";
import { getAuthToken } from "../../common/auth-cookie";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Express } from "express";
import { StorageService } from "../../common/storage.service";

import { IsEmail, IsOptional, IsString } from "class-validator";

class UpdateProfileDto {
  @IsString()
  first_name!: string;
  
  @IsString()
  last_name!: string;
  
  @IsOptional()
  @IsString()
  middle_name?: string;
  
  @IsEmail()
  email!: string;
  
  @IsOptional()
  @IsString()
  country?: string;
  
  @IsOptional()
  @IsString()
  region?: string;
  
  @IsOptional()
  @IsString()
  city?: string;
}

class UpdatePasswordDto {
  current_password!: string;
  password!: string;
  password_confirmation!: string;
}

class UpdatePrivacyDto {
  profile_type!: "public" | "private";
  show_email?: boolean;
  show_memorials?: boolean;
}

@Controller("users")
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly authService: AuthService,
    private readonly storageService: StorageService,
  ) {}

  private async requireUser(req: Request) {
    const token = getAuthToken(req);
    if (!token) {
      throw new UnauthorizedException("Не авторизован");
    }
    const user = await this.authService.verifyToken(token);
    if (!user) {
      throw new UnauthorizedException("Не авторизован");
    }
    return user;
  }

  @Get(":id")
  async show(@Param("id", ParseIntPipe) id: number) {
    const profile = await this.users.findPublicProfile(id);
    if (!profile) {
      throw new NotFoundException("User not found");
    }
    return profile;
  }

  @Put("me")
  @UseInterceptors(FileInterceptor("avatar", { limits: { fileSize: 10 * 1024 * 1024 } }))
  async updateMe(
    @Req() req: Request,
    @Body() body: UpdateProfileDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    const currentUser = await this.requireUser(req);
    try {
      let avatarPath: string | undefined;
      if (avatar) {
        avatarPath = await this.storageService.uploadUserAvatar(currentUser.id, avatar);
      }

      const user = await this.users.updateProfile(currentUser.id, {
        ...body,
        avatar: avatarPath,
      });
      return { success: true, user };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось обновить профиль";
      throw new BadRequestException(message);
    }
  }

  @Put("me/password")
  async updatePassword(@Req() req: Request, @Body() body: UpdatePasswordDto) {
    const currentUser = await this.requireUser(req);

    if (body.password !== body.password_confirmation) {
      throw new BadRequestException("Пароли не совпадают");
    }

    try {
      await this.users.updatePassword(currentUser.id, body.current_password, body.password);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось обновить пароль";
      throw new BadRequestException(message);
    }
  }

  @Put("me/privacy")
  async updatePrivacy(@Req() req: Request, @Body() body: UpdatePrivacyDto) {
    const currentUser = await this.requireUser(req);
    try {
      const privacy = await this.users.updatePrivacy(currentUser.id, {
        profile_type: body.profile_type,
        show_email: body.show_email === true,
        show_memorials: body.show_memorials !== false,
      });
      return { success: true, privacy };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось обновить настройки приватности";
      throw new BadRequestException(message);
    }
  }
}
