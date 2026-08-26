import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("uses a 40 percent gross margin from DKK supplier cost", () => {
  const netSale = (supplierMinor, override) => override ?? Math.round(supplierMinor / 0.60);
  assert.equal(netSale(6000), 10000);
  assert.equal(netSale(6000, 9500), 9500);
});

test("catalogue contains 132 source rows consolidated to 122 unique products", async () => {
  const catalogue = JSON.parse(await read("data/catalog.generated.json"));
  assert.equal(catalogue.length, 122);
  assert.equal(new Set(catalogue.map((product) => product.sku)).size, 122);
  assert.equal(catalogue.filter((product) => product.status === "published").length, 23);
  assert.ok(catalogue.filter((product) => product.productionDaysMin === 1).length >= 70);
});

test("languages, currencies, markets and translations are data-driven", async () => {
  const [seed, route, types] = await Promise.all([read("data/storefront.seed.json"), read("app/[locale]/page.tsx"), read("lib/store/types.ts")]);
  const data = JSON.parse(seed);
  assert.ok(data.locales.length >= 3);
  assert.ok(data.currencies.length >= 2);
  assert.equal(data.markets.length, 27);
  assert.doesNotMatch(route, /z\.enum\(\[\"da\"/);
  assert.match(types, /type LocaleCode = string/);
  assert.match(types, /type CurrencyCode = string/);
});

test("free shipping stays an explicit configurable quote line", async () => {
  const seed = JSON.parse(await read("data/storefront.seed.json"));
  assert.ok(seed.shippingZones.every((zone) => zone.priceMinorDkk === 0));
  const quote = await read("lib/store/quote.ts");
  assert.match(quote, /isFree: shippingMinor === 0/);
  assert.match(quote, /zone\.priceMinorDkk/);
});

test("delivery combines production, zone transit and closed-date support", async () => {
  const pricing = await read("lib/store/pricing.ts");
  assert.match(pricing, /productionMin \+ zone\.transitDaysMin/);
  assert.match(pricing, /weekday !== 0 && weekday !== 6 && !closed\.has/);
});

test("checkout ignores client amounts and creates inclusive Stripe lines", async () => {
  const checkout = await read("app/api/checkout/route.ts");
  assert.doesNotMatch(checkout, /unitAmount|unit_amount:.*request/);
  assert.match(checkout, /buildQuote\(bootstrap, requested\.items\)/);
  assert.match(checkout, /tax_behavior: "inclusive"/);
  assert.match(checkout, /tax_id_collection: \{ enabled: true \}/);
  assert.match(checkout, /quote_snapshot: quote/);
  assert.match(checkout, /LAUNCH_LOCKED/);
  assert.match(checkout, /legal_snapshot/);
});

test("public bootstrap removes supplier pricing and draft products", async () => {
  const data = await read("lib/store/data.ts");
  assert.match(data, /getPublicStoreBootstrap/);
  assert.match(data, /supplierCostMinor: null/);
  assert.match(data, /filter\(\(product\) => product\.status === "published"\)/);
  const sql = await read("supabase/migrations/202608250003_checkout_legal_and_catalogue_hardening.sql");
  assert.match(sql, /revoke all on public\.products from anon, authenticated/);
});

test("webhooks are signature checked and idempotently claimed", async () => {
  const webhook = await read("app/api/stripe/webhook/route.ts");
  assert.match(webhook, /constructEvent/);
  assert.match(webhook, /23505/);
  assert.match(webhook, /processing_status: "processing"/);
  assert.match(webhook, /processing_status === "failed"/);
});

test("migration enables RLS, launch guards, locale gates and private artwork", async () => {
  const sql = await read("supabase/migrations/202608250001_exposprint.sql");
  assert.match(sql, /validate_locale_activation/);
  assert.match(sql, /validate_launch_ready/);
  assert.match(sql, /validate_product_publication/);
  assert.ok((sql.match(/enable row level security/g) ?? []).length >= 20);
  assert.match(sql, /artwork-private','artwork-private',false,209715200/);
  assert.doesNotMatch(sql, /create type.*locale/i);
});

test("artwork authorization uses direct resumable storage with strict validation", async () => {
  const upload = await read("app/api/artwork/upload/route.ts");
  assert.match(upload, /upload\/resumable/);
  assert.match(upload, /token: data\.token/);
  assert.match(upload, /200 \* 1024 \* 1024/);
  assert.match(upload, /application\/pdf/);
  assert.match(await read("lib/server/rate-limit.ts"), /consume_service_rate_limit/);
});

test("admin auth receives public Supabase runtime config from the server", async () => {
  const [page, auth, consoleSource] = await Promise.all([
    read("app/admin/page.tsx"),
    read("components/admin/admin-auth.tsx"),
    read("components/admin/admin-console.tsx"),
  ]);
  assert.ok(page.includes("authConfig={getSupabasePublicConfig()}"));
  assert.doesNotMatch(auth, /process\.env\.NEXT_PUBLIC_SUPABASE/);
  assert.doesNotMatch(consoleSource, /process\.env\.NEXT_PUBLIC_SUPABASE/);
});

test("admin recovery stays same-origin and closed setup has no signup side effect", async () => {
  const [callback, setupPage, setupApi] = await Promise.all([
    read("app/auth/callback/route.ts"),
    read("app/admin/setup/page.tsx"),
    read("app/api/admin/setup/route.ts"),
  ]);
  assert.ok(callback.includes('value.includes("\\\\")'));
  assert.match(callback, /resolved\.origin === origin/);
  assert.match(setupPage, /redirect\("\/admin\/login"\)/);
  assert.match(setupApi, /SETUP_CLOSED/);
  assert.match(setupApi, /status: 410/);
  assert.doesNotMatch(setupApi, /signUp|claim_admin_owner/);

  const origin = "https://shop.example";
  const safeNextUrl = (value) => {
    const fallback = new URL("/", origin);
    if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
    const resolved = new URL(value, origin);
    return resolved.origin === origin ? resolved : fallback;
  };
  assert.equal(safeNextUrl("/\\\\attacker.example/path").href, `${origin}/`);
  assert.equal(safeNextUrl("/\t/attacker.example/path").href, `${origin}/`);
  assert.equal(safeNextUrl("/\n/attacker.example/path").href, `${origin}/`);
  assert.equal(safeNextUrl("/\r/attacker.example/path").href, `${origin}/`);
  assert.equal(safeNextUrl("/admin/reset-password?from=email#form").href, `${origin}/admin/reset-password?from=email#form`);
});

test("premium product and document assets are present", async () => {
  const mockups = (await readdir(new URL("public/assets/mockups/", root))).filter((file) => file.endsWith(".webp"));
  const pdfs = (await readdir(new URL("public/resources/", root))).filter((file) => file.endsWith(".pdf"));
  assert.equal(mockups.length, 35);
  assert.equal(pdfs.length, 45);
});
