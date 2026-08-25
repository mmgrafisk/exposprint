import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required");
const db = createClient(url, key, { auth: { persistSession: false } });
const seed = JSON.parse(await readFile(new URL("../data/storefront.seed.json", import.meta.url), "utf8"));
const catalogue = JSON.parse(await readFile(new URL("../data/catalog.generated.json", import.meta.url), "utf8"));
const fail = (label, error) => { if (error) throw new Error(`${label}: ${error.message}`); };

let result = await db.from("locales").upsert(seed.locales.map((item) => ({ code: item.code, name: item.name, hreflang: item.hreflang, intl_locale: item.intlLocale, enabled: false, is_default: item.isDefault, sort_order: item.sortOrder })), { onConflict: "code" });
fail("locales", result.error);
result = await db.from("currencies").upsert(seed.currencies.map((item) => ({ code: item.code, name: item.name, symbol: item.symbol, decimals: item.decimals, rate_from_dkk: item.rateFromDkk, rounding_increment: item.roundingIncrement, enabled: item.enabled, is_default: item.isDefault, rate_source: item.source, rate_updated_at: item.updatedAt })), { onConflict: "code" });
fail("currencies", result.error);
result = await db.from("shipping_zones").upsert(seed.shippingZones.map((item) => ({ code: item.code, name: item.name, transit_days_min: item.transitDaysMin, transit_days_max: item.transitDaysMax, price_minor_dkk: item.priceMinorDkk, enabled: item.enabled })), { onConflict: "code" });
fail("shipping zones", result.error);
result = await db.from("shipping_methods").upsert({ code: "standard", name: "Standard", carrier: "Adivin", enabled: true, sort_order: 10 }, { onConflict: "code" }).select("id").single();
fail("shipping method", result.error);
const methodId = result.data.id;
result = await db.from("shipping_rates").delete().eq("method_id", methodId);
fail("clear shipping rates", result.error);
result = await db.from("shipping_rates").insert(seed.shippingZones.map((item) => ({ zone_code: item.code, method_id: methodId, price_minor_dkk: item.priceMinorDkk, enabled: item.enabled })));
fail("shipping rates", result.error);
result = await db.from("markets").upsert(seed.markets.map((item) => ({ country_code: item.countryCode, default_locale: item.defaultLocale, default_currency: item.defaultCurrency, vat_rate: item.vatRate, vat_zone: "EU", shipping_zone_code: item.shippingZone, enabled: item.enabled })), { onConflict: "country_code" });
fail("markets", result.error);

const settings = { default_locale: seed.settings.defaultLocale, fallback_locale: seed.settings.fallbackLocale, default_market: seed.settings.defaultMarket, default_currency: seed.settings.defaultCurrency, gross_margin_percent: seed.settings.grossMarginPercent, support_email: seed.settings.supportEmail, launch_ready: false };
result = await db.from("shop_settings").upsert(Object.entries(settings).map(([settingKey, value]) => ({ key: settingKey, value })), { onConflict: "key" });
fail("settings", result.error);

const entries = [];
for (const [locale, bundle] of Object.entries(seed.translations)) {
  for (const [compound, value] of Object.entries(bundle)) {
    const dot = compound.indexOf(".");
    entries.push({ locale, namespace: dot < 0 ? "storefront" : compound.slice(0, dot), key: dot < 0 ? compound : compound.slice(dot + 1), value });
  }
  entries.push({ locale, namespace: "email", key: "orderSubject", value: locale === "da" ? "Din ExposPrint-ordre" : locale === "de" ? "Ihre ExposPrint-Bestellung" : "Your ExposPrint order" });
}
for (let index = 0; index < entries.length; index += 500) {
  result = await db.from("translation_entries").upsert(entries.slice(index, index + 500), { onConflict: "locale,namespace,key" });
  fail("translations", result.error);
}

result = await db.from("legal_documents").upsert(seed.legalDocuments.map((item) => ({ document_type: item.documentType, locale: item.locale, version: item.version, status: "published", title_key: item.titleKey, body: item.body, effective_at: null, approved_at: null })), { onConflict: "document_type,locale,version" });
fail("legal documents", result.error);
result = await db.from("locales").upsert(seed.locales.map((item) => ({ code: item.code, name: item.name, hreflang: item.hreflang, intl_locale: item.intlLocale, enabled: item.enabled, is_default: item.isDefault, sort_order: item.sortOrder })), { onConflict: "code" });
fail("activate locales", result.error);

const productRows = catalogue.map((item) => ({ sku: item.sku, supplier_sku: item.supplierSku || null, category_slug: item.categorySlug, status: "draft", supplier_cost_minor: item.supplierCostMinor, base_currency: item.baseCurrency, price_override_minor: item.priceOverrideMinor ?? null, production_days_min: item.productionDaysMin, production_days_max: item.productionDaysMax, approved_image_path: item.approvedImage, gallery: Array.isArray(item.gallery) ? item.gallery : item.approvedImage ? [item.approvedImage] : [], personalized: item.personalized, source_url: item.sourceUrl ?? null }));
for (let index = 0; index < productRows.length; index += 100) {
  result = await db.from("products").upsert(productRows.slice(index, index + 100), { onConflict: "sku" });
  fail("products", result.error);
}
result = await db.from("products").select("id,sku");
fail("product ids", result.error);
const ids = new Map(result.data.map((item) => [item.sku, item.id]));
const translations = catalogue.map((item) => ({ product_id: ids.get(item.sku), locale: seed.settings.fallbackLocale, name: item.title, slug: item.slug, description: item.description, alt_text: item.title }));
result = await db.from("product_translations").upsert(translations, { onConflict: "product_id,locale" });
fail("product translations", result.error);
const productIds = [...ids.values()];
for (let index = 0; index < productIds.length; index += 100) {
  result = await db.from("product_options").delete().in("product_id", productIds.slice(index, index + 100));
  fail("clear product options", result.error);
}
const options = catalogue.flatMap((item) => item.options.map((option, index) => ({ product_id: ids.get(item.sku), code: option.code, label: option.label, type: option.type, required: option.required, values: option.values, sort_order: index * 10 })));
for (let index = 0; index < options.length; index += 500) {
  result = await db.from("product_options").insert(options.slice(index, index + 500));
  fail("product options", result.error);
}
for (const item of catalogue) {
  if (item.status === "published") {
    result = await db.from("products").update({ status: "published" }).eq("sku", item.sku);
    fail(`publish ${item.sku}`, result.error);
  }
}
console.log(JSON.stringify({ locales: seed.locales.length, currencies: seed.currencies.length, markets: seed.markets.length, sourceRows: 132, uniqueProducts: catalogue.length, published: catalogue.filter((item) => item.status === "published").length }));
