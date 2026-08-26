export type LocaleCode = string;
export type CurrencyCode = string;

export type StoreSettings = {
  defaultLocale: LocaleCode;
  fallbackLocale: LocaleCode;
  defaultMarket: string;
  defaultCurrency: CurrencyCode;
  grossMarginPercent: number;
  supportEmail: string;
  launchReady: boolean;
  geoFallbackLocale: LocaleCode;
  geoFallbackCurrency: CurrencyCode;
  brandName: string;
};

export type LocaleDefinition = {
  code: LocaleCode;
  name: string;
  hreflang: string;
  intlLocale: string;
  enabled: boolean;
  isDefault: boolean;
  sortOrder: number;
};

export type CurrencyDefinition = {
  code: CurrencyCode;
  name: string;
  symbol: string;
  decimals: number;
  rateFromDkk: number;
  roundingIncrement: number;
  enabled: boolean;
  isDefault: boolean;
  source: string;
  updatedAt: string;
};

export type Market = {
  countryCode: string;
  defaultLocale: LocaleCode;
  defaultCurrency: CurrencyCode;
  vatRate: number;
  shippingZone: string;
  enabled: boolean;
};

export type ShippingZone = {
  code: string;
  name: string;
  transitDaysMin: number;
  transitDaysMax: number;
  priceMinorDkk: number;
  enabled: boolean;
};

export type ProductOption = {
  code: string;
  label: string;
  type: "single" | "multiple" | "number" | "text";
  required: boolean;
  values: string[];
  valueLabels?: Record<string, string>;
};

export type StoreProduct = {
  id: string;
  sku: string;
  supplierSku: string;
  slug: string;
  category: string;
  categorySlug: string;
  title: string;
  description: string;
  supplierCostMinor: number | null;
  baseCurrency: CurrencyCode;
  priceOverrideMinor?: number | null;
  netPriceMinorDkk?: number | null;
  customerPriceMinor?: number;
  productionDaysMin: number | null;
  productionDaysMax: number | null;
  approvedImage: string | null;
  gallery: string[];
  status: "draft" | "hidden" | "published" | "archived";
  personalized: boolean;
  options: ProductOption[];
  sourceUrl?: string;
};

export type TranslationBundle = Record<string, string>;

export type LegalDocumentVersion = {
  id?: string;
  documentType: string;
  locale: LocaleCode;
  version: number;
  status: "draft" | "published" | "archived";
  titleKey: string;
  effectiveAt: string | null;
  body: string;
  contentHash?: string;
  approvedAt?: string | null;
};

export type StoreBootstrap = {
  settings: StoreSettings;
  locale: LocaleDefinition;
  locales: LocaleDefinition[];
  currency: CurrencyDefinition;
  currencies: CurrencyDefinition[];
  market: Market;
  markets: Market[];
  shippingZones: ShippingZone[];
  closedDates: string[];
  translations: TranslationBundle;
  legalDocuments: LegalDocumentVersion[];
  products: StoreProduct[];
  catalogueCount: number;
  source: "supabase" | "seed";
  visitorCountry: string;
  destinationCountry: string | null;
};

export type Money = { amountMinor: number; currency: CurrencyCode };

export type DeliveryEstimate = {
  productionDaysMin: number;
  productionDaysMax: number;
  transitDaysMin: number;
  transitDaysMax: number;
  totalDaysMin: number;
  totalDaysMax: number;
};

export type ShippingQuote = {
  zoneCode: string;
  amount: Money;
  isFree: boolean;
  delivery: DeliveryEstimate;
};

export type QuoteLineInput = {
  productId: string;
  quantity: number;
  configuration?: Record<string, string | string[]>;
};

export type QuoteLine = {
  productId: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
  taxMinor: number;
  configuration: Record<string, string | string[]>;
  delivery: DeliveryEstimate;
};

export type StoreQuote = {
  locale: LocaleCode;
  visitorCountry: string;
  destinationCountry: string;
  market: string;
  currency: CurrencyCode;
  lines: QuoteLine[];
  subtotal: Money;
  shipping: ShippingQuote;
  taxMinor: number;
  total: Money;
  legalVersions: Record<string, number>;
};

export type StoreContextInput = {
  visitorCountry?: string | null;
  destinationCountry?: string | null;
  routeLocale?: LocaleCode | null;
  includeDrafts?: boolean;
};

export type ResolvedStoreContext = {
  visitorCountry: string;
  destinationCountry: string | null;
  locale: LocaleDefinition;
  currency: CurrencyDefinition;
  market: Market;
};
