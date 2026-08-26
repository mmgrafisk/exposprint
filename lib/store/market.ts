import type {
  CurrencyDefinition,
  LocaleDefinition,
  Market,
  ResolvedStoreContext,
  StoreContextInput,
  StoreSettings,
} from "./types";

const COUNTRY_CODE = /^[A-Z]{2}$/;
const UNKNOWN_COUNTRIES = new Set(["XX", "T1"]);

export function normalizeCountryCode(value?: string | null): string | null {
  const code = value?.trim().toUpperCase();
  return code && COUNTRY_CODE.test(code) && !UNKNOWN_COUNTRIES.has(code) ? code : null;
}

export function visitorCountryFromHeaders(headers: Headers): string | null {
  return normalizeCountryCode(
    headers.get("cf-ipcountry") ??
    headers.get("x-vercel-ip-country") ??
    headers.get("x-country-code"),
  );
}

export function resolveStoreContext(
  input: StoreContextInput,
  settings: StoreSettings,
  locales: LocaleDefinition[],
  currencies: CurrencyDefinition[],
  markets: Market[],
): ResolvedStoreContext {
  const visitorCountry = normalizeCountryCode(input.visitorCountry) ?? "XX";
  const destinationCountry = normalizeCountryCode(input.destinationCountry);
  const visitorMarket = markets.find((market) => market.countryCode === visitorCountry && market.enabled);
  const destinationMarket = destinationCountry
    ? markets.find((market) => market.countryCode === destinationCountry && market.enabled)
    : undefined;
  const pricingMarket = destinationMarket ?? visitorMarket ?? markets.find((market) => market.countryCode === settings.defaultMarket) ?? markets[0];
  if (!pricingMarket) throw new Error("MARKET_UNAVAILABLE");

  const localeCode = visitorMarket?.defaultLocale ?? settings.geoFallbackLocale;
  const currencyCode = visitorMarket?.defaultCurrency ?? settings.geoFallbackCurrency;
  const locale = locales.find((item) => item.code === localeCode && item.enabled)
    ?? locales.find((item) => item.code === settings.fallbackLocale && item.enabled)
    ?? locales[0];
  const currency = currencies.find((item) => item.code === currencyCode && item.enabled)
    ?? currencies.find((item) => item.code === settings.defaultCurrency && item.enabled)
    ?? currencies[0];
  if (!locale || !currency) throw new Error("STOREFRONT_CONFIGURATION_UNAVAILABLE");

  return { visitorCountry, destinationCountry, locale, currency, market: pricingMarket };
}
