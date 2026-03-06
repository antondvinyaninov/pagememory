import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from "class-validator";

export class RegisterDto {
  @IsString({ message: "Имя должно быть строкой" })
  @IsNotEmpty({ message: "Имя обязательно для заполнения" })
  @MinLength(2, { message: "Имя должно содержать минимум 2 символа" })
  @MaxLength(50, { message: "Имя не должно превышать 50 символов" })
  first_name!: string;

  @IsString({ message: "Фамилия должна быть строкой" })
  @IsNotEmpty({ message: "Фамилия обязательна для заполнения" })
  @MinLength(2, { message: "Фамилия должна содержать минимум 2 символа" })
  @MaxLength(50, { message: "Фамилия не должна превышать 50 символов" })
  last_name!: string;

  @IsEmail({}, { message: "Email должен быть валидным адресом" })
  @IsNotEmpty({ message: "Email обязателен для заполнения" })
  email!: string;

  @IsString({ message: "Пароль должен быть строкой" })
  @IsNotEmpty({ message: "Пароль обязателен для заполнения" })
  @MinLength(8, { message: "Пароль должен содержать минимум 8 символов" })
  @MaxLength(100, { message: "Пароль не должен превышать 100 символов" })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: "Пароль должен содержать хотя бы одну заглавную букву, одну строчную букву и одну цифру",
  })
  password!: string;

  @IsString({ message: "Подтверждение пароля должно быть строкой" })
  @IsNotEmpty({ message: "Подтверждение пароля обязательно для заполнения" })
  password_confirmation!: string;
}
