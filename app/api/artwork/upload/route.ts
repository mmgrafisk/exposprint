import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminSupabase } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/server/rate-limit";

const requestSchema = z.object({
  fileName: z.string().min(1).max(240),
  size: z.number().int().positive().max(200 * 1024 * 1024),
  mime: z.string().max(120),
  cartSession: z.string().uuid(),
});
const allowed = new Map([
  ["pdf", new Set(["application/pdf"])],
  ["ai", new Set(["application/postscript", "application/pdf"])],
  ["eps", new Set(["application/postscript"])],
  ["svg", new Set(["image/svg+xml"])],
]);

export async function POST(request: Request) {
  if (!await consumeRateLimit(request, "artwork_authorization", 10, 60 * 60)) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_UPLOAD_REQUEST" }, { status: 400 });
  const ext = parsed.data.fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!allowed.has(ext) || !allowed.get(ext)?.has(parsed.data.mime)) return NextResponse.json({ error: "FILE_TYPE_NOT_ALLOWED" }, { status: 415 });
  const db = adminSupabase();
  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!db || !storageUrl) return NextResponse.json({ error: "UPLOADS_NOT_CONFIGURED" }, { status: 503 });
  const objectName = `${parsed.data.cartSession}/${randomUUID()}.${ext}`;
  const { data, error } = await db.storage.from("artwork-private").createSignedUploadUrl(objectName);
  if (error) return NextResponse.json({ error: "UPLOAD_AUTHORIZATION_FAILED" }, { status: 500 });
  const { error: authorizationError } = await db.from("artwork_uploads").insert({
    path: objectName,
    cart_session: parsed.data.cartSession,
    file_name: parsed.data.fileName,
    size_bytes: parsed.data.size,
    mime: parsed.data.mime,
  });
  if (authorizationError) return NextResponse.json({ error: "UPLOAD_AUTHORIZATION_FAILED" }, { status: 500 });
  const directStorage = storageUrl.replace(".supabase.co", ".storage.supabase.co");
  return NextResponse.json({
    path: objectName,
    cartSession: parsed.data.cartSession,
    token: data.token,
    endpoint: `${directStorage}/storage/v1/upload/resumable`,
    protocol: "tus",
    maxBytes: 200 * 1024 * 1024,
  });
}
