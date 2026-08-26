import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";

export function safeNextUrl(value: string | null, origin: string) {
  const fallback = new URL("/", origin);
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  const resolved = new URL(value, origin);
  return resolved.origin === origin ? resolved : fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextUrl(url.searchParams.get("next"), url.origin);
  const supabase = await serverSupabase();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(next);
  }

  return NextResponse.redirect(new URL("/admin/login", url.origin));
}
