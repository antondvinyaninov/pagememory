import { ImageResponse } from "@vercel/og";
import type { APIRoute } from "astro";

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

  const fullName = `${memorial.last_name} ${memorial.first_name} ${memorial.middle_name ?? ""}`.trim();
  const birthDate = formatDate(memorial.birth_date);
  const deathDate = formatDate(memorial.death_date);
  const location = memorial.birth_place || memorial.burial_city || memorial.burial_place || "";
  const photoUrl = resolvePhotoUrl(memorial);

  // Загружаем фото заранее и конвертируем в base64 для @vercel/og
  let photoBase64 = "";
  try {
    const photoRes = await fetch(photoUrl);
    if (photoRes.ok) {
      const buffer = await photoRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      const contentType = photoRes.headers.get("content-type") || "image/jpeg";
      photoBase64 = `data:${contentType};base64,${base64}`;
    }
  } catch (error) {
    console.error("[og-image] Error loading photo:", error);
    // Используем fallback аватар
    photoBase64 = photoUrl;
  }

  try {
    const html = {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "linear-gradient(135deg, #1e293b 0%, #111827 55%, #0b1120 100%)",
          padding: "60px 80px",
          fontFamily: "system-ui, sans-serif",
        },
        children: [
          // Фото
          {
            type: "div",
            props: {
              style: {
                width: "320px",
                height: "320px",
                marginRight: "60px",
                borderRadius: "16px",
                overflow: "hidden",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
                display: "flex",
              },
              children: {
                type: "img",
                props: {
                  src: photoBase64,
                  alt: fullName,
                  width: "320",
                  height: "320",
                  style: {
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  },
                },
              },
            },
          },
          // Текст
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                color: "white",
                flex: 1,
              },
              children: [
                // Имя
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "56px",
                      fontWeight: 800,
                      lineHeight: 1.2,
                      marginBottom: "24px",
                      color: "white",
                    },
                    children: fullName,
                  },
                },
                // Даты
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      borderRadius: "12px",
                      border: "1px solid rgba(255, 255, 255, 0.45)",
                      background: "rgba(15, 23, 42, 0.45)",
                      padding: "12px 16px",
                      marginBottom: "20px",
                      width: "fit-content",
                    },
                    children: [
                      {
                        type: "span",
                        props: {
                          style: { fontSize: "20px", fontWeight: 600, color: "white" },
                          children: birthDate,
                        },
                      },
                      {
                        type: "span",
                        props: {
                          style: { fontSize: "20px", fontWeight: 600, color: "white" },
                          children: " — ",
                        },
                      },
                      {
                        type: "span",
                        props: {
                          style: { fontSize: "20px", fontWeight: 600, color: "white" },
                          children: deathDate,
                        },
                      },
                    ],
                  },
                },
                // Локация
                location
                  ? {
                      type: "div",
                      props: {
                        style: {
                          fontSize: "20px",
                          color: "rgba(241, 245, 249, 1)",
                          display: "flex",
                          alignItems: "center",
                        },
                        children: `📍 ${location}`,
                      },
                    }
                  : null,
              ].filter(Boolean),
            },
          },
        ],
      },
    };

    return new ImageResponse(html as any, {
      width: 1200,
      height: 630,
    });
  } catch (error) {
    console.error("[og-image] Error generating image:", error);
    return new Response("Error generating image", { status: 500 });
  }
};
