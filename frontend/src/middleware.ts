import { defineMiddleware } from "astro:middleware";

const STATIC_ASSET_EXT = /\.(?:css|js|mjs|json|map|png|jpg|jpeg|gif|svg|webp|avif|ico|woff|woff2|ttf|otf)$/i;

function isStaticAssetPath(pathname: string): boolean {
  if (pathname.startsWith("/_astro/")) return true;
  if (pathname.startsWith("/brand/")) return true;
  if (pathname.startsWith("/images/")) return true;
  return STATIC_ASSET_EXT.test(pathname);
}

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const method = context.request.method.toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    return response;
  }

  if (response.status < 200 || response.status >= 300) {
    return response;
  }

  const { pathname } = new URL(context.request.url);

  if (isStaticAssetPath(pathname) && !response.headers.has("cache-control")) {
    response.headers.set("cache-control", "public, max-age=31536000, immutable");
  }

  return response;
});
