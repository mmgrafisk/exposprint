import { adminSupabase } from "../supabase/admin";
import { publicSupabase } from "../supabase/public";
import { customerUnitPrice } from "./pricing";
import { resolveStoreContext } from "./market";
import type {
  StoreBootstrap,
  StoreContextInput,
  StoreProduct,
  StoreSettings,
  TranslationBundle,
} from "./types";

const fail = (message: string): never => { throw new Error(message); };

export async function getStoreBootstrap(input: StoreContextInput = {}): Promise<StoreBootstrap> {
  const db = input.includeDrafts ? adminSupabase() : publicSupabase();
  if (!db) return fail("STOREFRONT_DATABASE_NOT_CONFIGURED");

  const [settingsResult, localeResult, currencyResult, marketResult, zoneResult] = await Promise.all([
    db.from("shop_settings").select("key,value"),
    db.from("locales").select("*").eq("enabled", true).order("sort_order"),
    db.from("currencies").select("*").eq("enabled", true).order("code"),
    db.from("markets").select("*").eq("enabled", true).order("country_code"),
    db.from("shipping_zones").select("*").eq("enabled", true).order("code"),
  ]);
  const baseError = [settingsResult, localeResult, currencyResult, marketResult, zoneResult]
    .map((result) => result.error)
    .find(Boolean);
  if (baseError) return fail(`STOREFRONT_CONFIGURATION_UNAVAILABLE:${baseError.message}`);
  if (!localeResult.data?.length || !currencyResult.data?.length || !marketResult.data?.length) {
    return fail("STOREFRONT_CONFIGURATION_INCOMPLETE");
  }

  const settingsMap = Object.fromEntries((settingsResult.data ?? []).map((row) => [row.key, row.value]));
  const locales = localeResult.data.map((row) => ({
    code: row.code,
    name: row.name,
    hreflang: row.hreflang,
    intlLocale: row.intl_locale,
    enabled: row.enabled,
    isDefault: row.is_default,
    sortOrder: row.sort_order,
  }));
  const currencies = currencyResult.data.map((row) => ({
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    decimals: row.decimals,
    rateFromDkk: Number(row.rate_from_dkk),
    roundingIncrement: Number(row.rounding_increment),
    enabled: row.enabled,
    isDefault: row.is_default,
    source: row.rate_source,
    updatedAt: row.rate_updated_at,
  }));
  const markets = marketResult.data.map((row) => ({
    countryCode: row.country_code,
    defaultLocale: row.default_locale,
    defaultCurrency: row.default_currency,
    vatRate: Number(row.vat_rate),
    shippingZone: row.shipping_zone_code,
    enabled: row.enabled,
  }));
  const shippingZones = zoneResult.data.map((row) => ({
    code: row.code,
    name: row.name,
    transitDaysMin: row.transit_days_min,
    transitDaysMax: row.transit_days_max,
    priceMinorDkk: Number(row.price_minor_dkk),
    enabled: row.enabled,
  }));
  const settings: StoreSettings = {
    defaultLocale: String(settingsMap.default_locale ?? locales.find((item) => item.isDefault)?.code ?? locales[0].code),
    fallbackLocale: String(settingsMap.fallback_locale ?? locales.find((item) => item.isDefault)?.code ?? locales[0].code),
    defaultMarket: String(settingsMap.default_market ?? markets[0].countryCode),
    defaultCurrency: String(settingsMap.default_currency ?? currencies.find((item) => item.isDefault)?.code ?? currencies[0].code),
    grossMarginPercent: Number(settingsMap.gross_margin_percent ?? 40),
    supportEmail: String(settingsMap.support_email ?? ""),
    launchReady: settingsMap.launch_ready === true || settingsMap.launch_ready === "true",
    geoFallbackLocale: String(settingsMap.geo_fallback_locale ?? "en"),
    geoFallbackCurrency: String(settingsMap.geo_fallback_currency ?? "EUR"),
    brandName: String(settingsMap.brand_name ?? ""),
  };
  const resolved = resolveStoreContext(input, settings, locales, currencies, markets);
  const requestedLocales = Array.from(new Set([resolved.locale.code, settings.fallbackLocale]));

  let productQuery = db.from("products").select(
    "id,sku,status,category_slug,base_currency,net_price_minor_dkk,production_days_min,production_days_max,approved_image_path,gallery,personalized,product_translations(locale,name,slug,description,alt_text,seo_title,seo_description),product_options(id,code,type,required,sort_order,product_option_translations(locale,label,values))",
  ).order("created_at");
  if (!input.includeDrafts) productQuery = productQuery.eq("status", "published");

  const [translationResult, legalResult, productResult, categoryResult, closedResult] = await Promise.all([
    db.from("translation_entries").select("locale,namespace,key,value").in("locale", requestedLocales),
    db.from("legal_documents").select("id,document_type,locale,version,status,title_key,effective_at,body,content_hash,approved_at").in("locale", requestedLocales).order("version", { ascending: false }),
    productQuery,
    db.from("categories").select("id,slug,status,category_translations(locale,name,description)").in("status", input.includeDrafts ? ["draft", "published", "archived"] : ["published"]),
    db.from("closed_dates").select("closed_on").order("closed_on"),
  ]);
  const contentError = [translationResult, legalResult, productResult, categoryResult, closedResult]
    .map((result) => result.error)
    .find(Boolean);
  if (contentError) return fail(`STOREFRONT_CONTENT_UNAVAILABLE:${contentError.message}`);

  const translationRows = translationResult.data ?? [];
  const bundleFor = (code: string) => Object.fromEntries(
    translationRows
      .filter((row) => row.locale === code)
      .map((row) => [row.namespace === "storefront" ? row.key : `${row.namespace}.${row.key}`, row.value]),
  ) as TranslationBundle;
  const translations = { ...bundleFor(settings.fallbackLocale), ...bundleFor(resolved.locale.code) };

  const categoryNames = new Map((categoryResult.data ?? []).map((row) => {
    const available = (row.category_translations ?? []) as Array<Record<string, unknown>>;
    const translated = available.find((item) => item.locale === resolved.locale.code)
      ?? available.find((item) => item.locale === settings.fallbackLocale);
    return [row.slug, String(translated?.name ?? row.slug)];
  }));

  const products: StoreProduct[] = (productResult.data ?? []).map((row) => {
    const available = (row.product_translations ?? []) as Array<Record<string, unknown>>;
    const translated = available.find((item) => item.locale === resolved.locale.code)
      ?? available.find((item) => item.locale === settings.fallbackLocale)
      ?? {};
    return {
      id: row.id,
      sku: row.sku,
      supplierSku: "",
      status: row.status,
      category: categoryNames.get(row.category_slug) ?? row.category_slug,
      categorySlug: row.category_slug,
      slug: String(translated.slug ?? row.sku.toLowerCase()),
      title: String(translated.name ?? ""),
      description: String(translated.description ?? ""),
      supplierCostMinor: null,
      baseCurrency: row.base_currency,
      priceOverrideMinor: null,
      netPriceMinorDkk: row.net_price_minor_dkk == null ? null : Number(row.net_price_minor_dkk),
      productionDaysMin: row.production_days_min,
      productionDaysMax: row.production_days_max,
      approvedImage: row.approved_image_path,
      gallery: Array.isArray(row.gallery) ? row.gallery : row.approved_image_path ? [row.approved_image_path] : [],
      personalized: row.personalized,
      options: ((row.product_options ?? []) as Array<Record<string, unknown>>)
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
        .map((option) => {
          const optionTranslations = (option.product_option_translations ?? []) as Array<Record<string, unknown>>;
          const optionTranslation = optionTranslations.find((item) => item.locale === resolved.locale.code)
            ?? optionTranslations.find((item) => item.locale === settings.fallbackLocale)
            ?? {};
          const values = Array.isArray(optionTranslation.values) ? optionTranslation.values.map(String) : [];
          return {
            code: String(option.code),
            label: String(optionTranslation.label ?? ""),
            type: String(option.type) as "single" | "multiple" | "number" | "text",
            required: Boolean(option.required),
            values: values.filter((value) => !/^(same|choose|\d+)$/i.test(value.trim())),
          };
        })
        .filter((option) => option.values.length > 0 || option.type === "text" || option.type === "number"),
    };
  });

  return {
    settings,
    locale: resolved.locale,
    locales,
    currency: resolved.currency,
    currencies,
    market: resolved.market,
    markets,
    shippingZones,
    closedDates: (closedResult.data ?? []).map((row) => row.closed_on),
    translations,
    legalDocuments: (legalResult.data ?? []).map((row) => ({
      id: row.id,
      documentType: row.document_type,
      locale: row.locale,
      version: row.version,
      status: row.status,
      titleKey: row.title_key,
      effectiveAt: row.effective_at,
      body: row.body,
      contentHash: row.content_hash,
      approvedAt: row.approved_at,
    })),
    products,
    catalogueCount: products.length,
    source: "supabase",
    visitorCountry: resolved.visitorCountry,
    destinationCountry: resolved.destinationCountry,
  };
}

export async function getProductBySlug(input: StoreContextInput, slug: string) {
  const bootstrap = await getPublicStoreBootstrap(input);
  return { bootstrap, product: bootstrap.products.find((item) => item.slug === slug && item.status === "published") ?? null };
}

export async function getPublicStoreBootstrap(input: StoreContextInput = {}) {
  const bootstrap = await getStoreBootstrap(input);
  return {
    ...bootstrap,
    settings: { ...bootstrap.settings, grossMarginPercent: 0 },
    legalDocuments: bootstrap.legalDocuments.filter((document) => document.status === "published" || !bootstrap.settings.launchReady),
    products: bootstrap.products.filter((product) => product.status === "published").map((product) => ({
      ...product,
      supplierSku: "",
      supplierCostMinor: null,
      priceOverrideMinor: null,
      netPriceMinorDkk: null,
      sourceUrl: undefined,
      customerPriceMinor: customerUnitPrice(product, bootstrap.market, bootstrap.currency, 0).gross.amountMinor,
    })),
  };
}
