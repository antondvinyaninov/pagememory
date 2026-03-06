import type { APIRoute } from "astro";
import sharp from "sharp";

export const GET: APIRoute = async ({ params }) => {
  const { id: rawId } = params;
  const id = rawId ? String(rawId).replace(/^id/, "") : null;

  const API_BASE_URL = "http://127.0.0.1:4000/api";
  const S3_BASE_URL = "https://s3.firstvds.ru/memory";

  type MemorialApi = {
    id: number | string;
    first_name: string;
    last_name: string;
    middle_name: string | null;
    birth_date: string | null;
    death_date: string | null;
    birth_place: string | null;
    burial_city: string | null;
    burial_place: string | null;
    photo: string | null;
    religion: string | null;
  };

  let memorial: MemorialApi | null = null;

  if (id) {
    try {
      const res = await fetch(`${API_BASE_URL}/memorials/${id}`);
      if (res.ok) {
        memorial = (await res.json()) as MemorialApi;
      }
    } catch (error) {
      console.error(`[og-image] Error fetching memorial:`, error);
    }
  }

  if (!memorial) {
    return new Response("Memorial not found", { status: 404 });
  }

  function resolvePhotoUrl(memorial: MemorialApi): string {
    if (memorial.photo) {
      if (memorial.photo.startsWith("http://") || memorial.photo.startsWith("https://")) {
        return memorial.photo;
      }
      return `${S3_BASE_URL}/${memorial.photo.replace(/^\//, "")}`;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      `${memorial.first_name} ${memorial.last_name}`,
    )}&size=400&background=e5e7eb&color=6b7280&bold=true`;
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    try {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    } catch {
      return dateStr;
    }
  }

  const lastName = memorial.last_name;
  const firstName = memorial.first_name;
  const middleName = memorial.middle_name ?? "";
  const birthDate = formatDate(memorial.birth_date);
  const deathDate = formatDate(memorial.death_date);
  const location = memorial.burial_city || memorial.burial_place || "";
  const photoUrl = resolvePhotoUrl(memorial);

  try {
    const width = 1200;
    const height = 630;
    const photoSize = 480;
    
    console.log('[og-image] Fetching photo from:', photoUrl);
    const photoRes = await fetch(photoUrl);
    if (!photoRes.ok) {
      throw new Error(`Failed to fetch photo: ${photoRes.status}`);
    }
    const photoBuffer = Buffer.from(await photoRes.arrayBuffer());
    
    // Просто ресайзим фото
    const photo = await sharp(photoBuffer)
      .resize(photoSize, photoSize, { fit: "cover", position: "center" })
      .toBuffer();

    // Создаем полное изображение в одном SVG
    const fullSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#475569;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#334155;stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <!-- Фон карточки -->
        <rect width="${width}" height="${height}" rx="32" ry="32" fill="url(#grad)"/>
        
        <!-- Православный крест -->
        ${memorial.religion === "orthodox" ? `
          <g transform="translate(1080, 60) scale(2.5)">
            <path d="M12 2v20M8 6h8M6 10h12M8 18h8" stroke="white" stroke-width="2" fill="none"/>
            <path d="M12 2L10 4h4l-2-2zM12 22l-2-2h4l-2 2z" fill="white"/>
          </g>
        ` : ''}
        
        <!-- Фамилия -->
        <text x="580" y="140" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="800" fill="white" text-anchor="start">
          ${lastName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </text>
        <!-- Имя -->
        <text x="580" y="210" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="800" fill="white" text-anchor="start">
          ${firstName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </text>
        <!-- Отчество -->
        ${middleName ? `<text x="580" y="280" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="800" fill="white" text-anchor="start">
          ${middleName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </text>` : ''}
        
        <!-- Даты -->
        <text x="580" y="${middleName ? '350' : '290'}" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="600" fill="#ef4444">
          ${birthDate} — ${deathDate}
        </text>
        
        <!-- Локация -->
        ${location ? `
          <g transform="translate(580, ${middleName ? '385' : '325'}) scale(1.2)">
            <path
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              stroke="rgba(241, 245, 249, 1)"
              stroke-width="2"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              stroke="rgba(241, 245, 249, 1)"
              stroke-width="2"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </g>
          <text x="610" y="${middleName ? '408' : '348'}" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="rgba(241, 245, 249, 1)">
            ${location.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
          </text>
        ` : ''}
        
        <!-- Текст -->
        <text x="580" y="${middleName ? (location ? '470' : '420') : (location ? '410' : '360')}" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-style="italic" fill="rgba(241, 245, 249, 0.9)">
          Что то написать надо
        </text>
      </svg>
    `;

    // Генерируем фон
    const background = await sharp(Buffer.from(fullSvg))
      .png()
      .toBuffer();

    // Накладываем фото
    const image = await sharp(background)
      .composite([
        {
          input: photo,
          top: 75,
          left: 70,
        },
      ])
      .png()
      .toBuffer();

    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[og-image] Error generating image:", error);
    return new Response(`Error generating image: ${error}`, { status: 500 });
  }
};
