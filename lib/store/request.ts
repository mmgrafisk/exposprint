import { headers } from "next/headers";
import { visitorCountryFromHeaders } from "./market";

export async function getVisitorCountry(): Promise<string | null> {
  return visitorCountryFromHeaders(await headers());
}

export function visitorCountryFromRequest(request: Request): string | null {
  return visitorCountryFromHeaders(request.headers);
}
