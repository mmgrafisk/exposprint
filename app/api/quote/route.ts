import { NextResponse } from "next/server";
import { z } from "zod";
import { getStoreBootstrap } from "@/lib/store/data";
import { buildQuote } from "@/lib/store/quote";
import { visitorCountryFromRequest } from "@/lib/store/request";

const schema = z.object({
  destinationCountry: z.string().length(2).transform((value) => value.toUpperCase()),
  items: z.array(z.object({
    productId: z.string().min(1).max(100),
    quantity: z.number().int().min(1).max(100),
    configuration: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
  })).min(1).max(50),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_QUOTE_REQUEST" }, { status: 400 });
  const bootstrap = await getStoreBootstrap({
    visitorCountry: visitorCountryFromRequest(request),
    destinationCountry: parsed.data.destinationCountry,
  });
  if (!bootstrap.markets.some((market) => market.countryCode === parsed.data.destinationCountry && market.enabled)) {
    return NextResponse.json({ error: "DESTINATION_UNAVAILABLE" }, { status: 400 });
  }
  try {
    return NextResponse.json(buildQuote(bootstrap, parsed.data.items), { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "QUOTE_FAILED" }, { status: 400 });
  }
}
