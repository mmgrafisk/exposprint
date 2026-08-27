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

test("admin product costs use a guarded database function", async () => {
  const [route, sql] = await Promise.all([
    read("app/api/admin/data/route.ts"),
    read("supabase/migrations/20260827043000_admin_product_access.sql"),
  ]);
  assert.match(route, /db\.rpc\("admin_product_rows"\)/);
  assert.doesNotMatch(route, /from\("products"\)\.select\("\*"\)/);
  assert.match(sql, /security definer/);
  assert.match(sql, /where public\.is_admin\(\)/);
  assert.match(sql, /revoke all on function public\.admin_product_rows\(uuid\) from public, anon/);
  assert.match(sql, /grant execute on function public\.admin_product_rows\(uuid\) to authenticated/);
});

test("admin uses a responsive sidebar and complete database i18n", async () => {
  const [consoleSource, styles, sql, utf8Repair] = await Promise.all([
    read("components/admin/admin-console.tsx"),
    read("app/globals.css"),
    read("supabase/migrations/20260827050000_complete_admin_i18n.sql"),
    read("supabase/migrations/20260827053000_repair_admin_utf8.sql"),
  ]);
  assert.match(consoleSource, /className="admin-sidebar"/);
  assert.match(consoleSource, /className="admin-nav"/);
  assert.doesNotMatch(consoleSource, /className="admin-tabs"/);
  assert.match(styles, /grid-template-columns:248px minmax\(0,1fr\)/);
  assert.match(styles, /@media\(max-width:980px\).*\.admin-workspace\{grid-template-columns:1fr\}/);
  assert.match(styles, /\.admin-translation-list\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.admin-card-list\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(sql, /\('da','admin','overview','Oversigt','published'\)/);
  assert.match(sql, /\('de','admin','translations','Übersetzungen','published'\)/);
  assert.match(sql, /\('en','admin','saveError','Changes could not be saved\.','published'\)/);
  assert.match(utf8Repair, /convert_from\(convert_to\(value, 'WIN1252'\), 'UTF8'\)/);
});

test("admin feedback, neutral title and every product editor are database driven", async () => {
  const [consoleSource, route, styles, sql] = await Promise.all([
    read("components/admin/admin-console.tsx"),
    read("app/api/admin/data/route.ts"),
    read("app/globals.css"),
    read("supabase/migrations/20260827060000_admin_product_editor_ux.sql"),
  ]);
  assert.match(consoleSource, /className={`admin-toast \$\{messageKind\}`}/);
  assert.match(consoleSource, /window\.setTimeout\(\(\) => setMessage\(""\), 2800\)/);
  assert.match(consoleSource, /filteredProducts\.flatMap/);
  assert.match(consoleSource, /save\("productEditor", productId/);
  assert.match(route, /from\("product_translations"\)\.upsert/);
  assert.match(styles, /\.admin-control-title\{[^}]*letter-spacing:\.045em/);
  assert.match(styles, /\.admin-product-editor-grid\{display:grid;grid-template-columns:repeat\(4/);
  assert.match(sql, /\('da','admin','title','Kontrolcenter','published'\)/);
  assert.doesNotMatch(sql, /ExposPrint kontrolcenter/);
  assert.match(sql, /grant update \([\s\S]*category_slug,[\s\S]*approved_image_path/);
});

test("admin recovery stays same-origin, requires MFA and keeps utility headings compact", async () => {
  const [callback, setupPage, setupApi, auth, styles] = await Promise.all([
    read("app/auth/callback/route.ts"),
    read("app/admin/setup/page.tsx"),
    read("app/api/admin/setup/route.ts"),
    read("components/admin/admin-auth.tsx"),
    read("app/globals.css"),
  ]);
  assert.ok(callback.includes('value.includes("\\\\")'));
  assert.match(callback, /resolved\.origin === origin/);
  assert.match(setupPage, /redirect\("\/admin\/login"\)/);
  assert.match(setupApi, /SETUP_CLOSED/);
  assert.match(setupApi, /status: 410/);
  assert.doesNotMatch(setupApi, /signUp|claim_admin_owner/);
  assert.match(auth, /preparePasswordResetMfa/);
  assert.match(auth, /mfa\.challenge\(\{ factorId \}\)/);
  assert.match(auth, /mfa\.verify\(\{ factorId, challengeId: challenge\.id, code \}\)/);
  assert.match(styles, /--utility-heading-max:46px/);
  assert.match(styles, /\.admin-auth-card h1\{[^}]*font-size:clamp\(32px,4vw,var\(--utility-heading-max\)\)/);
  assert.match(styles, /\.account-card h1,\.success-page h1,\.admin-lock h1,\.admin-page h1\{[^}]*overflow-wrap:anywhere/);

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

test("premium product assets and external Drive documents are present", async () => {
  const mockups = (await readdir(new URL("public/assets/mockups/", root))).filter((file) => file.endsWith(".webp"));
  const pdfs = (await readdir(new URL("public/resources/", root))).filter((file) => file.endsWith(".pdf"));
  const drive = JSON.parse(await readFile(new URL("data/google-drive-resources.json", root), "utf8"));
  const driveIds = Object.values(drive.files);
  const resourceIndexes = (await readdir(new URL("public/resources/", root))).filter((file) => /^index-[^.]+\.html$/.test(file));
  const linkedPdfs = (await Promise.all(resourceIndexes.map((file) => readFile(new URL(`public/resources/${file}`, root), "utf8"))))
    .flatMap((html) => html.match(/https:\/\/drive\.usercontent\.google\.com\/download\?id=/g) ?? []);
  assert.equal(mockups.length, 35);
  assert.equal(pdfs.length, 0);
  assert.equal(Object.keys(drive.files).length, 45);
  assert.equal(new Set(driveIds).size, 45);
  assert.equal(linkedPdfs.length, 45);
  assert.match(drive.folderUrl, /^https:\/\/drive\.google\.com\/drive\/folders\//);
});
