import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
export async function sessionClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (
          items: { name: string; value: string; options: CookieOptions }[],
        ) => {
          for (const c of items) store.set(c.name, c.value, c.options);
        },
      },
    },
  );
}
export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function requireUser() {
  const db = await sessionClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user)
    throw new ApiError("Logg inn i Jobbverktøy for å fortsette.", 401);
  if (user.banned_until && new Date(user.banned_until) > new Date())
    throw new ApiError("Kontoen er deaktivert.", 403);
  if (
    !Array.isArray(user.app_metadata.apps) ||
    !user.app_metadata.apps.includes("merkelapp")
  )
    throw new ApiError("Du har ikke tilgang til Merkelapp ennå.", 403);
  return { db, user };
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function failure(error: unknown) {
  if (error instanceof ApiError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    "Merkelapp API:",
    error instanceof Error ? error.message : "Database error",
  );
  return Response.json(
    { error: "Kunne ikke fullføre. Prøv igjen." },
    { status: 500 },
  );
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || new URL(origin).host !== host)
    throw new ApiError("Ugyldig forespørsel.", 403);
}
