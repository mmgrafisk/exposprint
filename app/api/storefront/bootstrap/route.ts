import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicStoreBootstrap } from "@/lib/store/data";

const querySchema = z.object({
  locale: z.string().min(2).max(20).optional(),
  currency: z.string().length(3).optional(),
  market: z.string().length(2).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_SELECTION" }, { status: 400 });
  const bootstrap = await getPublicStoreBootstrap(parsed.data.locale, parsed.data.currency, parsed.data.market);
  return NextResponse.json(bootstrap, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
