import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsEmail({}, { message: "Email должен быть валидным адресом" })
  @IsNotEmpty({ message: "Email обязателен для заполнения" })
  email!: string;

  @IsString({ message: "Пароль должен быть строкой" })
  @IsNotEmpty({ message: "Пароль обязателен для заполнения" })
  @MinLength(6, { message: "Пароль должен содержать минимум 6 символов" })
  password!: string;
}
