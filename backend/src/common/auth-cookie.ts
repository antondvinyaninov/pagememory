import type { Request } from "express";

export function getAuthToken(req: Request): string | null {
  const raw = req.cookies?.["auth_token"];
  if (typeof raw !== "string") return null;
  const token = raw.trim();
  return token.length > 0 ? token : null;
}
