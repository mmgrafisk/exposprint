import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicStoreBootstrap } from "@/lib/store/data";
import { visitorCountryFromRequest } from "@/lib/store/request";

const querySchema = z.object({
  destinationCountry: z.string().length(2).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_SELECTION" }, { status: 400 });
  const bootstrap = await getPublicStoreBootstrap({
    visitorCountry: visitorCountryFromRequest(request),
    destinationCountry: parsed.data.destinationCountry,
  });
  return NextResponse.json(bootstrap, { headers: { "cache-control": "private, no-store" } });
}
