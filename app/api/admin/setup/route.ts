import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminSupabase } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(12).max(128),
  token: z.string().min(16).max(512),
});

function matchesSecret(value: string, expected: string) {
  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  if (!await consumeRateLimit(request, "admin_setup", 5, 60 * 60)) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const bootstrapToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
  const db = adminSupabase();
  if (!parsed.success) return NextResponse.json({ error: "INVALID_SETUP" }, { status: 400 });
  if (!bootstrapToken || !db) return NextResponse.json({ error: "SETUP_NOT_CONFIGURED" }, { status: 503 });
  if (!matchesSecret(parsed.data.token, bootstrapToken)) return NextResponse.json({ error: "INVALID_SETUP" }, { status: 403 });

  const { count, error: ownerError } = await db.from("admin_owner").select("singleton", { count: "exact", head: true });
  if (ownerError) return NextResponse.json({ error: "SETUP_UNAVAILABLE" }, { status: 503 });
  if ((count ?? 0) > 0) return NextResponse.json({ error: "SETUP_CLOSED" }, { status: 409 });

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: { role: "admin" },
  });
  if (createError || !created.user) return NextResponse.json({ error: "OWNER_CREATE_FAILED" }, { status: 400 });
  const { error: insertError } = await db.from("admin_owner").insert({ user_id: created.user.id });
  if (insertError) {
    await db.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: "OWNER_CREATE_FAILED" }, { status: 409 });
  }
  await db.from("audit_log").insert({ actor_id: created.user.id, action: "admin_owner_created", entity_type: "admin_owner", entity_id: created.user.id });
  return NextResponse.json({ ok: true });
}
