import { adminSupabase } from "../supabase/admin";
import { getSeedBootstrap } from "./seed";
import { customerUnitPrice } from "./pricing";
import type { StoreBootstrap, StoreProduct, TranslationBundle } from "./types";

export async function getStoreBootstrap(locale?: string, currency?: string, market?: string): Promise<StoreBootstrap> {
  const fallback = getSeedBootstrap(locale, currency, market);
  const db = adminSupabase();
  if (!db) return fallback;

  try {
    const [settingsResult, localeResult, currencyResult, marketResult, zoneResult, translationResult, legalResult, productResult, closedResult] = await Promise.all([
      db.from("shop_settings").select("key,value"),
      db.from("locales").select("*").eq("enabled", true).order("sort_order"),
      db.from("currencies").select("*").eq("enabled", true).order("code"),
      db.from("markets").select("*").eq("enabled", true).order("country_code"),
      db.from("shipping_zones").select("*").eq("enabled", true).order("code"),
      db.from("translation_entries").select("locale,namespace,key,value").in("locale", [locale ?? fallback.locale.code, fallback.settings.fallbackLocale]),
      db.from("legal_documents").select("id,document_type,locale,version,status,title_key,effective_at,body,content_hash,approved_at").in("locale", [locale ?? fallback.locale.code, fallback.settings.fallbackLocale]).order("version", { ascending: false }),
      db.from("products").select("id,sku,supplier_sku,status,category_slug,supplier_cost_minor,base_currency,price_override_minor,production_days_min,production_days_max,approved_image_path,personalized,product_translations(locale,name,slug,description,alt_text),product_options(code,label,type,required,values,sort_order)").order("created_at"),
      db.from("closed_dates").select("closed_on").order("closed_on"),
    ]);

    const errors = [settingsResult, localeResult, currencyResult, marketResult, zoneResult, translationResult, legalResult, productResult, closedResult].map((result) => result.error).filter(Boolean);
    if (errors.length || !localeResult.data?.length || !currencyResult.data?.length || !marketResult.data?.length) return fallback;

    const settingsMap = Object.fromEntries((settingsResult.data ?? []).map((row) => [row.key, row.value]));
    const locales = localeResult.data.map((row) => ({
      code: row.code, name: row.name, hreflang: row.hreflang, intlLocale: row.intl_locale, enabled: row.enabled,
      isDefault: row.is_default, sortOrder: row.sort_order,
    }));
    const activeLocale = locales.find((item) => item.code === locale) ?? locales.find((item) => item.isDefault) ?? locales[0];
    const currencies = currencyResult.data.map((row) => ({
      code: row.code, name: row.name, symbol: row.symbol, decimals: row.decimals, rateFromDkk: Number(row.rate_from_dkk),
      roundingIncrement: Number(row.rounding_increment), enabled: row.enabled, isDefault: row.is_default, source: row.rate_source, updatedAt: row.rate_updated_at,
    }));
    const activeCurrency = currencies.find((item) => item.code === currency?.toUpperCase()) ?? currencies.find((item) => item.isDefault) ?? currencies[0];
    const markets = marketResult.data.map((row) => ({
      countryCode: row.country_code, defaultLocale: row.default_locale, defaultCurrency: row.default_currency,
      vatRate: Number(row.vat_rate), shippingZone: row.shipping_zone_code, enabled: row.enabled,
    }));
    const activeMarket = markets.find((item) => item.countryCode === market?.toUpperCase()) ?? markets.find((item) => item.countryCode === settingsMap.default_market) ?? markets[0];
    const shippingZones = zoneResult.data.map((row) => ({
      code: row.code, name: row.name, transitDaysMin: row.transit_days_min, transitDaysMax: row.transit_days_max,
      priceMinorDkk: Number(row.price_minor_dkk), enabled: row.enabled,
    }));
    const translationRows = translationResult.data ?? [];
    const bundleFor = (code: string) => Object.fromEntries(translationRows.filter((row) => row.locale === code).map((row) => [row.namespace === "storefront" ? row.key : `${row.namespace}.${row.key}`, row.value])) as TranslationBundle;
    const translations = { ...bundleFor(settingsMap.fallback_locale ?? fallback.settings.fallbackLocale), ...bundleFor(activeLocale.code) };
    const productRows = productResult.data ?? [];
    const products: StoreProduct[] = productRows.map((row) => {
      const translationsForProduct = (row.product_translations ?? []) as Array<Record<string, unknown>>;
      const translated = translationsForProduct.find((item) => item.locale === activeLocale.code) ?? translationsForProduct.find((item) => item.locale === (settingsMap.fallback_locale ?? fallback.settings.fallbackLocale)) ?? translationsForProduct[0] ?? {};
      return {
        id: row.id, sku: row.sku, supplierSku: row.supplier_sku ?? "", status: row.status, category: row.category_slug,
        categorySlug: row.category_slug, slug: String(translated.slug ?? row.sku.toLowerCase()), title: String(translated.name ?? row.sku),
        description: String(translated.description ?? ""), supplierCostMinor: row.supplier_cost_minor == null ? null : Number(row.supplier_cost_minor),
        baseCurrency: row.base_currency, priceOverrideMinor: row.price_override_minor == null ? null : Number(row.price_override_minor),
        productionDaysMin: row.production_days_min, productionDaysMax: row.production_days_max, approvedImage: row.approved_image_path,
        gallery: row.approved_image_path ? [row.approved_image_path] : [], personalized: row.personalized,
        options: ((row.product_options ?? []) as Array<Record<string, unknown>>).sort((a, b) => Number(a.sort_order) - Number(b.sort_order)).map((option) => ({
          code: String(option.code), label: String(option.label), type: String(option.type) as "single" | "multiple" | "number" | "text",
          required: Boolean(option.required), values: ((option.values ?? []) as string[]).filter((value) => !/^(same|choose|\d+)$/i.test(value.trim())),
        })).filter((option) => option.values.length > 0 || option.type === "text" || option.type === "number"),
      };
    });

    return {
      settings: {
        defaultLocale: settingsMap.default_locale ?? fallback.settings.defaultLocale,
        fallbackLocale: settingsMap.fallback_locale ?? fallback.settings.fallbackLocale,
        defaultMarket: settingsMap.default_market ?? fallback.settings.defaultMarket,
        defaultCurrency: settingsMap.default_currency ?? fallback.settings.defaultCurrency,
        grossMarginPercent: Number(settingsMap.gross_margin_percent ?? fallback.settings.grossMarginPercent),
        supportEmail: settingsMap.support_email ?? fallback.settings.supportEmail,
        launchReady: settingsMap.launch_ready === true || settingsMap.launch_ready === "true",
      },
      locale: activeLocale, locales, currency: activeCurrency, currencies, market: activeMarket, markets, shippingZones,
      closedDates: (closedResult.data ?? []).map((row) => row.closed_on), translations,
      legalDocuments: (legalResult.data ?? []).map((row) => ({
        id: row.id, documentType: row.document_type, locale: row.locale, version: row.version, status: row.status, titleKey: row.title_key,
        effectiveAt: row.effective_at, body: row.body, contentHash: row.content_hash, approvedAt: row.approved_at,
      })),
      products, catalogueCount: products.length, source: "supabase",
    };
  } catch {
    return fallback;
  }
}

export async function getProductBySlug(locale: string, slug: string, currency?: string, market?: string) {
  const bootstrap = await getPublicStoreBootstrap(locale, currency, market);
  return { bootstrap, product: bootstrap.products.find((item) => item.slug === slug && item.status === "published") ?? null };
}

export async function getPublicStoreBootstrap(locale?: string, currency?: string, market?: string) {
  const bootstrap = await getStoreBootstrap(locale, currency, market);
  return {
    ...bootstrap,
    settings: { ...bootstrap.settings, grossMarginPercent: 0 },
    legalDocuments: bootstrap.legalDocuments.filter((document) => document.status === "published" || !bootstrap.settings.launchReady),
    products: bootstrap.products.filter((product) => product.status === "published").map((product) => ({
      ...product,
      supplierSku: "",
      supplierCostMinor: null,
      priceOverrideMinor: null,
      sourceUrl: undefined,
      customerPriceMinor: customerUnitPrice(product, bootstrap.market, bootstrap.currency, bootstrap.settings.grossMarginPercent).gross.amountMinor,
    })),
  };
}
