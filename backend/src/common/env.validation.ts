/**
 * Валидация критичных переменных окружения при старте приложения
 */
export function validateEnv(): void {
  const requiredVars = [
    "JWT_SECRET",
    "DB_HOST",
    "DB_USERNAME",
    "DB_DATABASE",
  ];

  const missingVars: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    throw new Error(
      `Отсутствуют обязательные переменные окружения: ${missingVars.join(", ")}\n` +
        "Проверьте файл .env и убедитесь, что все необходимые переменные установлены."
    );
  }

  // Проверка JWT_SECRET на безопасность
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret === "change-me-in-prod" || (jwtSecret && jwtSecret.length < 32)) {
    console.warn(
      "⚠️  ВНИМАНИЕ: JWT_SECRET должен быть изменен на случайную строку длиной минимум 32 символа!"
    );
  }

  // Проверка COOKIE_SECURE для продакшена
  if (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "true") {
    console.warn(
      "⚠️  ВНИМАНИЕ: В продакшене COOKIE_SECURE должен быть установлен в 'true' для безопасности!"
    );
  }

  // Проверка CORS для продакшена
  if (
    process.env.NODE_ENV === "production" &&
    process.env.CORS_ORIGINS?.includes("localhost")
  ) {
    console.warn(
      "⚠️  ВНИМАНИЕ: В продакшене CORS_ORIGINS не должен содержать localhost!"
    );
  }
}
