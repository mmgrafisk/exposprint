import catalogue from "../../data/catalog.generated.json";
import seed from "../../data/storefront.seed.json";
import type {
  CurrencyDefinition,
  LegalDocumentVersion,
  LocaleDefinition,
  Market,
  ShippingZone,
  StoreBootstrap,
  StoreProduct,
  StoreSettings,
  TranslationBundle,
} from "./types";

type SeedShape = {
  settings: StoreSettings;
  locales: LocaleDefinition[];
  currencies: CurrencyDefinition[];
  markets: Market[];
  shippingZones: ShippingZone[];
  closedDates: string[];
  translations: Record<string, TranslationBundle>;
  legalDocuments: LegalDocumentVersion[];
};

const source = seed as SeedShape;
const products = (catalogue as unknown as StoreProduct[]).map((product) => ({
  ...product,
  gallery: Array.isArray(product.gallery) ? product.gallery : product.approvedImage ? [product.approvedImage] : [],
  options: product.options.map((option) => ({
    ...option,
    values: option.values.filter((value) => !/^(same|choose|\d+)$/i.test(value.trim())),
  })).filter((option) => option.values.length > 0 || option.type === "text" || option.type === "number"),
}));

export function getSeedBootstrap(localeCode?: string, currencyCode?: string, marketCode?: string): StoreBootstrap {
  const locales = source.locales.filter((item) => item.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
  const locale = locales.find((item) => item.code === localeCode) ?? locales.find((item) => item.code === source.settings.defaultLocale) ?? locales[0];
  const currencies = source.currencies.filter((item) => item.enabled);
  const currency = currencies.find((item) => item.code === currencyCode?.toUpperCase()) ?? currencies.find((item) => item.code === source.settings.defaultCurrency) ?? currencies[0];
  const markets = source.markets.filter((item) => item.enabled);
  const market = markets.find((item) => item.countryCode === marketCode?.toUpperCase()) ?? markets.find((item) => item.countryCode === source.settings.defaultMarket) ?? markets[0];
  const primary = source.translations[locale.code] ?? {};
  const fallback = source.translations[source.settings.fallbackLocale] ?? {};
  return {
    settings: source.settings,
    locale,
    locales,
    currency,
    currencies,
    market,
    markets,
    shippingZones: source.shippingZones.filter((item) => item.enabled),
    closedDates: source.closedDates,
    translations: { ...fallback, ...primary },
    legalDocuments: source.legalDocuments.filter((item) => item.locale === locale.code || item.locale === source.settings.fallbackLocale),
    products,
    catalogueCount: products.length,
    source: "seed",
  };
}
