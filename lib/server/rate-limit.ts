import { createHash } from "crypto";
import { adminSupabase } from "@/lib/supabase/admin";

function clientAddress(request: Request) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

export async function consumeRateLimit(request: Request, action: string, limit: number, windowSeconds: number) {
  const db = adminSupabase();
  if (!db) return false;
  const fingerprint = createHash("sha256")
    // Do not include caller-controlled headers such as User-Agent: rotating them
    // must not create a fresh rate-limit bucket for the same network address.
    .update(clientAddress(request))
    .digest("hex");
  const { data, error } = await db.rpc("consume_service_rate_limit", {
    p_key_hash: fingerprint,
    p_action: action,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  return !error && data === true;
}
