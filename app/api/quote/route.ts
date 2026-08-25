import { NextResponse } from "next/server";
import { z } from "zod";
import { getStoreBootstrap } from "@/lib/store/data";
import { buildQuote } from "@/lib/store/quote";

const schema = z.object({
  locale: z.string().min(2).max(20),
  currency: z.string().length(3),
  market: z.string().length(2),
  items: z.array(z.object({
    productId: z.string().min(1).max(100),
    quantity: z.number().int().min(1).max(100),
    configuration: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
  })).min(1).max(50),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_QUOTE_REQUEST" }, { status: 400 });
  const bootstrap = await getStoreBootstrap(parsed.data.locale, parsed.data.currency, parsed.data.market);
  if (bootstrap.locale.code !== parsed.data.locale || bootstrap.currency.code !== parsed.data.currency.toUpperCase() || bootstrap.market.countryCode !== parsed.data.market.toUpperCase()) {
    return NextResponse.json({ error: "MARKET_SELECTION_UNAVAILABLE" }, { status: 400 });
  }
  try {
    return NextResponse.json(buildQuote(bootstrap, parsed.data.items));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "QUOTE_FAILED" }, { status: 400 });
  }
}
