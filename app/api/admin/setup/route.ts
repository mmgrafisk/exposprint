import { NextResponse } from "next/server";
import { z } from "zod";
import { serverSupabase } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(12).max(128),
  token: z.string().min(16).max(512),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_SETUP" }, { status: 400 });
  const supabase = await serverSupabase();
  if (!supabase) return NextResponse.json({ error: "SETUP_NOT_CONFIGURED" }, { status: 503 });

  let { data: { user } } = await supabase.auth.getUser();
  if (user && user.email?.toLowerCase() !== parsed.data.email.toLowerCase()) {
    return NextResponse.json({ error: "INVALID_SETUP" }, { status: 403 });
  }

  if (!user) {
    const origin = new URL(request.url).origin;
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/admin/setup")}` },
    });
    if (error || !data.user) return NextResponse.json({ error: "OWNER_CREATE_FAILED" }, { status: 400 });
    if (!data.session) return NextResponse.json({ ok: false, confirmationRequired: true }, { status: 202 });
    user = data.user;
  }

  const { data: claimed, error: claimError } = await supabase.rpc("claim_admin_owner", { p_token: parsed.data.token });
  if (claimError) return NextResponse.json({ error: "SETUP_UNAVAILABLE" }, { status: 503 });
  if (!claimed) return NextResponse.json({ error: "INVALID_SETUP" }, { status: 403 });
  await supabase.auth.refreshSession();
  return NextResponse.json({ ok: true });
}
