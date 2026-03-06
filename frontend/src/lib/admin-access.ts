type RedirectFn = (path: string, status?: 301 | 302 | 303 | 307 | 308 | 300 | 304) => Response;

type AdminContext = {
  request: Request;
  redirect: RedirectFn;
};

type AuthMePayload = {
  id?: number | string;
  role?: string | null;
};

type AdminGuardResult = {
  cookieHeader: string;
  me: {
    id: number;
    role: string;
  };
};

const ADMIN_ROLES = new Set(["admin", "superadmin", "super_admin"]);

function normalizeRole(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function toUserId(value: unknown): number {
  const id = Number(value || 0);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

export async function requireAdminPage(
  context: AdminContext,
  apiBaseUrl: string,
): Promise<AdminGuardResult | Response> {
  const cookieHeader = context.request.headers.get("cookie") ?? "";
  if (!cookieHeader) {
    return context.redirect("/login", 302);
  }

  try {
    const res = await fetch(`${apiBaseUrl}/auth/me`, {
      method: "GET",
      headers: { cookie: cookieHeader },
    });

    if (!res.ok) {
      return context.redirect("/login", 302);
    }

    const me = (await res.json().catch(() => null)) as AuthMePayload | null;
    const userId = toUserId(me?.id);
    const role = normalizeRole(me?.role);

    if (userId <= 0) {
      return context.redirect("/login", 302);
    }

    if (!ADMIN_ROLES.has(role)) {
      return context.redirect(`/user/id${userId}`, 302);
    }

    return {
      cookieHeader,
      me: {
        id: userId,
        role,
      },
    };
  } catch {
    return context.redirect("/login", 302);
  }
}
