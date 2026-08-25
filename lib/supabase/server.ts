import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function serverSupabase() {
  const store = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components cannot always persist refreshed cookies. Middleware/API routes can.
        }
      },
    },
  });
}

export async function requireAdmin() {
  const supabase = await serverSupabase();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const role = user.app_metadata?.role;
  const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
  return role === "admin" || roles.includes("admin") ? user : null;
}
