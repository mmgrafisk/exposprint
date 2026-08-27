import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, serverSupabase } from "@/lib/supabase/server";

const productValues = z.object({
  supplierCostMinor: z.number().int().nonnegative().nullable().optional(),
  productionDaysMin: z.number().int().nonnegative().nullable().optional(),
  productionDaysMax: z.number().int().nonnegative().nullable().optional(),
  status: z.enum(["draft", "hidden", "published", "archived"]).optional(),
});
const productEditorValues = productValues.extend({
  categorySlug: z.string().min(1).max(160),
  approvedImagePath: z.string().max(1000).nullable(),
  locale: z.string().min(2).max(20),
  name: z.string().min(1).max(300),
  slug: z.string().min(1).max(300),
  description: z.string().max(20000),
  altText: z.string().max(500),
  seoTitle: z.string().max(300),
  seoDescription: z.string().max(1000),
});
const translationValues = z.object({ value: z.string().max(20000) });
const marketValues = z.object({
  defaultLocale: z.string().min(2).max(20).optional(),
  defaultCurrency: z.string().length(3).optional(),
  vatRate: z.number().min(0).max(100).optional(),
  shippingZone: z.string().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
});
const shippingValues = z.object({
  transitDaysMin: z.number().int().nonnegative().optional(),
  transitDaysMax: z.number().int().nonnegative().optional(),
  priceMinorDkk: z.number().int().nonnegative().optional(),
  enabled: z.boolean().optional(),
});
const legalValues = z.object({
  body: z.string().max(200000).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  effectiveAt: z.string().datetime().nullable().optional(),
  approve: z.boolean().optional(),
});
const orderValues = z.object({
  status: z.enum(["pending_payment", "payment_processing", "paid", "artwork_review", "production", "shipped", "completed", "cancelled", "payment_expired"]).optional(),
  adivinReference: z.string().max(120).nullable().optional(),
  trackingNumber: z.string().max(200).nullable().optional(),
});
const localeValues = z.object({
  code: z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/),
  name: z.string().min(1).max(100),
  hreflang: z.string().min(2).max(40),
  intlLocale: z.string().min(2).max(40),
});
const currencyValues = z.object({
  code: z.string().regex(/^[A-Z]{3}$/),
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(10),
  decimals: z.number().int().min(0).max(4),
  rateFromDkk: z.number().positive(),
  roundingIncrement: z.number().positive(),
});
const enabledValues = z.object({ enabled: z.boolean() });
const legalCreateValues = z.object({
  documentType: z.string().min(1).max(80),
  locale: z.string().min(2).max(20),
  body: z.string().min(1).max(200000),
  effectiveAt: z.string().datetime().nullable().optional(),
});
const addressValues = z.object({
  line1: z.string().max(240),
  line2: z.string().max(240),
  postalCode: z.string().max(40),
  city: z.string().max(120),
  countryCode: z.string().regex(/^$|^[A-Z]{2}$/),
});
const businessValues = z.object({
  companyName: z.string().max(200),
  vatNumber: z.string().max(80),
  physicalAddress: addressValues,
  email: z.union([z.literal(""), z.string().email().max(320)]),
  phone: z.string().max(80),
  returnAddress: addressValues,
  approve: z.boolean(),
});
const launchValues = z.object({ enabled: z.boolean() });

const patchSchema = z.discriminatedUnion("resource", [
  z.object({ resource: z.literal("product"), id: z.string().uuid(), values: productValues }),
  z.object({ resource: z.literal("productEditor"), id: z.string().uuid(), values: productEditorValues }),
  z.object({ resource: z.literal("translation"), id: z.string().min(5).max(500), values: translationValues }),
  z.object({ resource: z.literal("market"), id: z.string().length(2), values: marketValues }),
  z.object({ resource: z.literal("shipping"), id: z.string().min(1).max(80), values: shippingValues }),
  z.object({ resource: z.literal("legal"), id: z.string().uuid(), values: legalValues }),
  z.object({ resource: z.literal("order"), id: z.string().uuid(), values: orderValues }),
  z.object({ resource: z.literal("locale"), id: z.string().max(20), values: localeValues }),
  z.object({ resource: z.literal("currency"), id: z.string().max(3), values: currencyValues }),
  z.object({ resource: z.literal("localeStatus"), id: z.string().max(20), values: enabledValues }),
  z.object({ resource: z.literal("currencyStatus"), id: z.string().max(3), values: enabledValues }),
  z.object({ resource: z.literal("legalCreate"), id: z.string().max(80), values: legalCreateValues }),
  z.object({ resource: z.literal("business"), id: z.literal("singleton"), values: businessValues }),
  z.object({ resource: z.literal("launch"), id: z.literal("launch_ready"), values: launchValues }),
]);

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const db = await serverSupabase();
  if (!db) return NextResponse.json({ error: "ADMIN_DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const results = await Promise.all([
    db.rpc("admin_product_rows"),
    db.from("product_translations").select("product_id,locale,name,slug,description,alt_text,seo_title,seo_description").order("locale").order("name"),
    db.from("translation_entries").select("locale,namespace,key,value,status,updated_at").order("locale").order("namespace").order("key"),
    db.from("required_translation_keys").select("namespace,key,area"),
    db.from("locales").select("*").order("sort_order"),
    db.from("currencies").select("*").order("code"),
    db.from("markets").select("*").order("country_code"),
    db.from("shipping_zones").select("*").order("code"),
    db.from("legal_documents").select("id,document_type,locale,version,status,body,effective_at,approved_at,content_hash").order("locale").order("document_type").order("version", { ascending: false }),
    db.from("orders").select("id,order_number,status,currency,total_minor,customer_email,visitor_country,destination_country,adivin_reference,tracking_number,created_at").order("created_at", { ascending: false }).limit(250),
    db.from("business_profile").select("*").maybeSingle(),
    db.from("shop_settings").select("key,value,updated_at").order("key"),
    db.from("required_legal_document_types").select("code,required_at_checkout,sort_order").order("sort_order"),
  ]);
  const error = results.map((result) => result.error).find(Boolean);
  if (error) return NextResponse.json({ error: "ADMIN_DATA_UNAVAILABLE" }, { status: 503 });
  const [products, productTranslations, translations, requiredTranslations, locales, currencies, markets, shipping, legal, orders, business, settings, requiredLegal] = results;
  return NextResponse.json({
    products: products.data ?? [], productTranslations: productTranslations.data ?? [], translations: translations.data ?? [], requiredTranslations: requiredTranslations.data ?? [],
    locales: locales.data ?? [], currencies: currencies.data ?? [], markets: markets.data ?? [], shipping: shipping.data ?? [],
    legal: legal.data ?? [], orders: orders.data ?? [], business: business.data ?? null, settings: settings.data ?? [], requiredLegal: requiredLegal.data ?? [],
  }, { headers: { "cache-control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const actor = await requireAdmin();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_ADMIN_UPDATE" }, { status: 400 });
  const db = await serverSupabase();
  if (!db) return NextResponse.json({ error: "ADMIN_DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const { resource, id, values } = parsed.data;
  let error: { message: string } | null = null;
  let before: unknown = null;
  let after: unknown = null;

  if (resource === "product" || resource === "productEditor") {
    const previous = await db.rpc("admin_product_rows", { target_product_id: id }).maybeSingle(); before = previous.data;
    const update = {
      ...(values.supplierCostMinor !== undefined ? { supplier_cost_minor: values.supplierCostMinor } : {}),
      ...(values.productionDaysMin !== undefined ? { production_days_min: values.productionDaysMin } : {}),
      ...(values.productionDaysMax !== undefined ? { production_days_max: values.productionDaysMax } : {}),
      ...(values.status !== undefined ? { status: values.status } : {}),
      ...(resource === "productEditor" ? {
        category_slug: values.categorySlug,
        approved_image_path: values.approvedImagePath,
      } : {}),
      updated_at: new Date().toISOString(),
    };
    const result = await db.from("products").update(update).eq("id", id); error = result.error;
    if (!error && resource === "productEditor") {
      const translation = await db.from("product_translations").upsert({
        product_id: id,
        locale: values.locale,
        name: values.name,
        slug: values.slug,
        description: values.description,
        alt_text: values.altText,
        seo_title: values.seoTitle,
        seo_description: values.seoDescription,
      }, { onConflict: "product_id,locale" });
      error = translation.error;
    }
    if (!error) {
      const current = await db.rpc("admin_product_rows", { target_product_id: id }).maybeSingle();
      error = current.error;
      after = current.data;
    }
  } else if (resource === "translation") {
    const [locale, namespace, ...keyParts] = id.split(":");
    const key = keyParts.join(":");
    const previous = await db.from("translation_entries").select("*").match({ locale, namespace, key }).maybeSingle(); before = previous.data;
    const result = await db.from("translation_entries").upsert({ locale, namespace, key, value: values.value, status: "published", updated_by: actor.id, updated_at: new Date().toISOString() }, { onConflict: "locale,namespace,key" }).select().single(); error = result.error; after = result.data;
  } else if (resource === "market") {
    const previous = await db.from("markets").select("*").eq("country_code", id).single(); before = previous.data;
    const update = {
      ...(values.defaultLocale !== undefined ? { default_locale: values.defaultLocale } : {}),
      ...(values.defaultCurrency !== undefined ? { default_currency: values.defaultCurrency } : {}),
      ...(values.vatRate !== undefined ? { vat_rate: values.vatRate } : {}),
      ...(values.shippingZone !== undefined ? { shipping_zone_code: values.shippingZone } : {}),
      ...(values.enabled !== undefined ? { enabled: values.enabled } : {}),
      updated_at: new Date().toISOString(),
    };
    const result = await db.from("markets").update(update).eq("country_code", id).select().single(); error = result.error; after = result.data;
  } else if (resource === "shipping") {
    const previous = await db.from("shipping_zones").select("*").eq("code", id).single(); before = previous.data;
    const update = {
      ...(values.transitDaysMin !== undefined ? { transit_days_min: values.transitDaysMin } : {}),
      ...(values.transitDaysMax !== undefined ? { transit_days_max: values.transitDaysMax } : {}),
      ...(values.priceMinorDkk !== undefined ? { price_minor_dkk: values.priceMinorDkk } : {}),
      ...(values.enabled !== undefined ? { enabled: values.enabled } : {}),
      updated_at: new Date().toISOString(),
    };
    const result = await db.from("shipping_zones").update(update).eq("code", id).select().single(); error = result.error; after = result.data;
  } else if (resource === "legal") {
    const previous = await db.from("legal_documents").select("*").eq("id", id).single(); before = previous.data;
    const update = {
      ...(values.body !== undefined ? { body: values.body } : {}),
      ...(values.status !== undefined ? { status: values.status } : {}),
      ...(values.effectiveAt !== undefined ? { effective_at: values.effectiveAt } : {}),
      ...(values.approve ? { approved_at: new Date().toISOString(), approved_by: actor.id } : {}),
    };
    const result = await db.from("legal_documents").update(update).eq("id", id).select().single(); error = result.error; after = result.data;
  } else if (resource === "order") {
    const previous = await db.from("orders").select("*").eq("id", id).single(); before = previous.data;
    const update = {
      ...(values.status !== undefined ? { status: values.status } : {}),
      ...(values.adivinReference !== undefined ? { adivin_reference: values.adivinReference } : {}),
      ...(values.trackingNumber !== undefined ? { tracking_number: values.trackingNumber } : {}),
      updated_at: new Date().toISOString(),
    };
    const result = await db.from("orders").update(update).eq("id", id).select().single(); error = result.error; after = result.data;
    if (!error && values.status) await db.from("order_status_history").insert({ order_id: id, status: values.status, created_by: actor.id });
  } else if (resource === "locale") {
    const result = await db.from("locales").insert({ code: values.code, name: values.name, hreflang: values.hreflang, intl_locale: values.intlLocale, enabled: false, is_default: false, sort_order: 100 }).select().single(); error = result.error; after = result.data;
  } else if (resource === "currency") {
    const result = await db.from("currencies").insert({ code: values.code, name: values.name, symbol: values.symbol, decimals: values.decimals, rate_from_dkk: values.rateFromDkk, rounding_increment: values.roundingIncrement, enabled: false, is_default: false, rate_source: "manual", rate_updated_at: new Date().toISOString(), manual_override: true }).select().single(); error = result.error; after = result.data;
  } else if (resource === "localeStatus") {
    const previous = await db.from("locales").select("*").eq("code", id).single(); before = previous.data;
    const result = await db.from("locales").update({ enabled: values.enabled }).eq("code", id).select().single(); error = result.error; after = result.data;
  } else if (resource === "currencyStatus") {
    const previous = await db.from("currencies").select("*").eq("code", id).single(); before = previous.data;
    const result = await db.from("currencies").update({ enabled: values.enabled }).eq("code", id).select().single(); error = result.error; after = result.data;
  } else if (resource === "legalCreate") {
    const latest = await db.from("legal_documents").select("version").match({ document_type: values.documentType, locale: values.locale }).order("version", { ascending: false }).limit(1).maybeSingle();
    if (latest.error) error = latest.error;
    else {
      const result = await db.from("legal_documents").insert({
        document_type: values.documentType,
        locale: values.locale,
        version: Number(latest.data?.version ?? 0) + 1,
        status: "draft",
        title_key: `legal.${values.documentType}`,
        body: values.body,
        effective_at: values.effectiveAt ?? null,
      }).select().single();
      error = result.error; after = result.data;
    }
  } else if (resource === "business") {
    const previous = await db.from("business_profile").select("*").eq("id", true).maybeSingle(); before = previous.data;
    const result = await db.from("business_profile").upsert({
      id: true,
      company_name: values.companyName,
      vat_number: values.vatNumber,
      physical_address: values.physicalAddress,
      email: values.email,
      phone: values.phone,
      return_address: values.returnAddress,
      approved_at: values.approve ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" }).select().single();
    error = result.error; after = result.data;
  } else if (resource === "launch") {
    const previous = await db.from("shop_settings").select("*").eq("key", id).maybeSingle(); before = previous.data;
    const result = await db.from("shop_settings").upsert({
      key: id,
      value: values.enabled,
      updated_by: actor.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" }).select().single();
    error = result.error; after = result.data;
  }

  if (error) return NextResponse.json({ error: "ADMIN_UPDATE_FAILED" }, { status: 409 });
  await db.from("audit_log").insert({ actor_id: actor.id, action: `${resource}_updated`, entity_type: resource, entity_id: id, before_value: before, after_value: after });
  return NextResponse.json({ ok: true, data: after }, { headers: { "cache-control": "private, no-store" } });
}
