import type { APIRoute } from "astro";
import { getApiBaseUrl } from "../../lib/api-url";

/**
 * Генерация sitemap.xml для поисковых систем
 * Включает главную страницу и все опубликованные мемориалы
 */
export const GET: APIRoute = async () => {
  const API_BASE_URL = getApiBaseUrl();
  
  // Всегда используем продакшен домен
  // В разработке можно переопределить через PUBLIC_APP_URL в .env
  const origin = import.meta.env.PUBLIC_APP_URL || "https://pagesofmemory.ru";

  let memorials: Array<{ id: number; updated_at: string | null }> = [];

  try {
    const res = await fetch(`${API_BASE_URL}/memorials/sitemap`, {
      headers: {
        "Accept": "application/json",
      },
    });
    
    if (res.ok) {
      const data = await res.json();
      memorials = Array.isArray(data) ? data : [];
    } else {
      console.error(`[sitemap] API returned status ${res.status}`);
    }
  } catch (error) {
    console.error("[sitemap] Error fetching memorials:", error);
    memorials = [];
  }

  // Экранирование XML специальных символов
  const escapeXml = (str: string): string => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  // Формирование URL для главной страницы
  const homeUrl = escapeXml(`${origin}/`);
  const homeRow = `  <url>
    <loc>${homeUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;

  // Формирование URL для мемориалов
  const memorialRows = memorials.map((memorial) => {
    const url = escapeXml(`${origin}/memorial/id${memorial.id}`);
    let lastmod = "";
    
    if (memorial.updated_at) {
      try {
        // Проверяем, что дата валидна
        const date = new Date(memorial.updated_at);
        if (!isNaN(date.getTime())) {
          lastmod = `\n    <lastmod>${date.toISOString()}</lastmod>`;
        }
      } catch {
        // Игнорируем невалидные даты
      }
    }
    
    return `  <url>
    <loc>${url}</loc>${lastmod}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  });

  // Формирование полного XML
  const rows = [homeRow, ...memorialRows];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.join("\n")}
</urlset>
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
};
