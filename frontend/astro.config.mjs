import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import react from "@astrojs/react";

// Базовый конфиг Astro, дальше будем дополнять (SSR, интеграции и т.п.)
export default defineConfig({
  srcDir: "./src",
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  image: {
    // Разрешаем загрузку изображений с внешних доменов (S3)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s3.firstvds.ru",
        pathname: "/memory/**",
      },
      {
        protocol: "https",
        hostname: "*.firstvds.ru",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
        pathname: "/**",
      },
      // Добавьте другие домены, если используете CDN или другие хранилища
    ],
    // Оптимизация изображений
    service: {
      entrypoint: "astro/assets/services/sharp",
      config: {
        limitInputPixels: false, // Убрать ограничение для больших изображений
      },
    },
  },
  server: {
    host: true,
    port: 4321,
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Разделяем React runtime в отдельный чанк
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'react-vendor';
            }
            // Разделяем другие большие библиотеки (исключая React)
            if (id.includes('node_modules') && !id.includes('react')) {
              return 'vendor';
            }
          },
        },
      },
    },
  },
});
