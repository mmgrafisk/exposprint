import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && publishableKey ? { url, publishableKey } : null;
}

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
  if (user.app_metadata?.role !== "admin") return null;
  const [{ data: owner }, { data: assurance }] = await Promise.all([
    supabase.from("admin_owner").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  return owner && assurance?.currentLevel === "aal2" ? user : null;
}

export async function getAdminAccessState() {
  const supabase = await serverSupabase();
  if (!supabase) return { state: "unavailable" as const, user: null };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { state: "signed_out" as const, user: null };
  if (user.app_metadata?.role !== "admin") return { state: "forbidden" as const, user };
  const [{ data: owner }, { data: assurance }] = await Promise.all([
    supabase.from("admin_owner").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!owner) return { state: "forbidden" as const, user };
  if (assurance?.currentLevel !== "aal2") return { state: "needs_mfa" as const, user };
  return { state: "ready" as const, user };
}
