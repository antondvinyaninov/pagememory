import type { APIRoute } from "astro";

/**
 * Генерация robots.txt для поисковых систем
 * Динамически формирует URL sitemap из переменных окружения
 */
export const GET: APIRoute = async () => {
  // Всегда используем продакшен домен
  // В разработке можно переопределить через PUBLIC_APP_URL в .env
  const origin = import.meta.env.PUBLIC_APP_URL || "https://pagesofmemory.ru";

  // Формируем URL sitemap
  const sitemapUrl = `${origin}/sitemap.xml`;

  // Содержимое robots.txt
  const robotsTxt = `# robots.txt для сайта "Страницы памяти"
# https://www.robotstxt.org/
# Сгенерировано автоматически

# Разрешаем всем поисковым роботам индексировать сайт
User-agent: *
Allow: /

# Запрещаем индексацию админ-панели и служебных страниц
Disallow: /admin/
Disallow: /api/

# Запрещаем индексацию страниц редактирования и настроек
Disallow: /memorial/create
Disallow: /memorial/*/edit
Disallow: /user/edit
Disallow: /user/security
Disallow: /user/privacy
Disallow: /user/admin

# Запрещаем индексацию страницы входа
Disallow: /login

# Запрещаем индексацию тестовых и служебных страниц
Disallow: /test-map
Disallow: /profile

# Разрешаем индексацию публичного контента
Allow: /
Allow: /memorial/
Allow: /user/id*

# Специальные правила для популярных поисковых систем
User-agent: Googlebot
Allow: /
Disallow: /admin/
Disallow: /memorial/create
Disallow: /memorial/*/edit

User-agent: Yandex
Allow: /
Disallow: /admin/
Disallow: /memorial/create
Disallow: /memorial/*/edit

# Указываем расположение sitemap
Sitemap: ${sitemapUrl}
`;

  return new Response(robotsTxt, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400", // Кэш на 24 часа
    },
  });
};
