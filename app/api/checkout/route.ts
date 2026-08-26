import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getStoreBootstrap } from "@/lib/store/data";
import { buildQuote } from "@/lib/store/quote";
import { adminSupabase } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { visitorCountryFromRequest } from "@/lib/store/request";
import { serverSupabase } from "@/lib/supabase/server";

const lineSchema = z.object({
  productId: z.string().min(1).max(100),
  quantity: z.number().int().min(1).max(100),
  configuration: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
  artworkPath: z.string().max(500).optional(),
  artworkSession: z.string().uuid().optional(),
}).refine((line) => Boolean(line.artworkPath) === Boolean(line.artworkSession), { message: "Artwork path and session must be supplied together" });

const checkoutSchema = z.object({
  destinationCountry: z.string().length(2).transform((value) => value.toUpperCase()),
  items: z.array(lineSchema).min(1).max(50),
});

export async function POST(request: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "CHECKOUT_NOT_CONFIGURED" }, { status: 503 });
  const db = adminSupabase();
  if (!db) return NextResponse.json({ error: "ORDER_DATABASE_NOT_CONFIGURED" }, { status: 503 });
  if (!await consumeRateLimit(request, "checkout_session", 30, 60 * 60)) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_CART" }, { status: 400 });

  const requested = parsed.data;
  const bootstrap = await getStoreBootstrap({
    visitorCountry: visitorCountryFromRequest(request),
    destinationCountry: requested.destinationCountry,
  });
  if (!bootstrap.markets.some((market) => market.countryCode === requested.destinationCountry && market.enabled)) {
    return NextResponse.json({ error: "DESTINATION_UNAVAILABLE" }, { status: 400 });
  }
  if (!bootstrap.settings.launchReady) return NextResponse.json({ error: "LAUNCH_LOCKED" }, { status: 503 });

  const { data: requiredLegal, error: requiredLegalError } = await db.from("required_legal_document_types").select("code").eq("required_at_checkout", true);
  if (requiredLegalError) return NextResponse.json({ error: "LEGAL_REQUIREMENTS_UNAVAILABLE" }, { status: 503 });
  const effectiveLegal = bootstrap.legalDocuments
    .filter((document) => document.locale === bootstrap.locale.code && document.status === "published" && document.approvedAt && (!document.effectiveAt || new Date(document.effectiveAt) <= new Date()))
    .sort((a, b) => b.version - a.version)
    .filter((document, index, rows) => rows.findIndex((candidate) => candidate.documentType === document.documentType) === index);
  const requiredCodes = (requiredLegal ?? []).map((row) => row.code);
  if (requiredCodes.some((code) => !effectiveLegal.some((document) => document.documentType === code))) return NextResponse.json({ error: "LEGAL_DOCUMENTS_INCOMPLETE" }, { status: 503 });

  let quote;
  try {
    quote = buildQuote(bootstrap, requested.items);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "QUOTE_FAILED" }, { status: 400 });
  }

  const requestedArtwork = requested.items.filter((item) => item.artworkPath && item.artworkSession);
  if (requestedArtwork.length) {
    const paths = requestedArtwork.map((item) => item.artworkPath as string);
    const { data: authorizations, error } = await db.from("artwork_uploads")
      .select("path,cart_session,status,expires_at")
      .in("path", paths);
    const now = Date.now();
    const valid = !error && requestedArtwork.every((item) => authorizations?.some((authorization) =>
      authorization.path === item.artworkPath &&
      authorization.cart_session === item.artworkSession &&
      authorization.status === "authorized" &&
      new Date(authorization.expires_at).getTime() > now &&
      item.artworkPath?.startsWith(`${item.artworkSession}/`)
    ));
    if (!valid) return NextResponse.json({ error: "ARTWORK_AUTHORIZATION_INVALID" }, { status: 400 });
  }

  let orderId: string | undefined;
  {
    const sessionClient = await serverSupabase();
    const { data: { user } } = sessionClient ? await sessionClient.auth.getUser() : { data: { user: null } };
    const { data: order, error } = await db.from("orders").insert({
      user_id: user?.id ?? null,
      status: "pending_payment",
      locale: quote.locale,
      market_code: quote.market,
      visitor_country: quote.visitorCountry,
      destination_country: quote.destinationCountry,
      currency: quote.currency,
      subtotal_minor: quote.subtotal.amountMinor,
      shipping_minor: quote.shipping.amount.amountMinor,
      tax_minor: quote.taxMinor,
      total_minor: quote.total.amountMinor,
      quote_snapshot: quote,
      legal_versions: quote.legalVersions,
      legal_snapshot: effectiveLegal.map((document) => ({ id: document.id, type: document.documentType, version: document.version, hash: document.contentHash, titleKey: document.titleKey, body: document.body, effectiveAt: document.effectiveAt })),
      accepted_terms_at: new Date().toISOString(),
    }).select("id").single();
    if (error || !order) return NextResponse.json({ error: "ORDER_PERSISTENCE_FAILED" }, { status: 503 });
    orderId = order.id;
    const { error: linesError } = await db.from("order_lines").insert(quote.lines.map((line, index) => ({
      order_id: orderId,
      product_id: line.productId,
      sku: line.sku,
      title_snapshot: line.title,
      quantity: line.quantity,
      unit_price_minor: line.unitPrice.amountMinor,
      tax_minor: line.taxMinor,
      line_total_minor: line.lineTotal.amountMinor,
      configuration: line.configuration,
      artwork_path: requested.items[index]?.artworkPath ?? null,
      delivery_snapshot: line.delivery,
    })));
    if (linesError) return NextResponse.json({ error: "ORDER_LINES_PERSISTENCE_FAILED" }, { status: 503 });
    const artworkPaths = requestedArtwork.map((item) => item.artworkPath as string);
    if (artworkPaths.length) {
      const { error: artworkError } = await db.from("artwork_uploads").update({ status: "attached", order_id: orderId }).in("path", artworkPaths).eq("status", "authorized");
      if (artworkError) return NextResponse.json({ error: "ARTWORK_ATTACHMENT_FAILED" }, { status: 503 });
    }
  }

  const stripe = new Stripe(key);
  const origin = new URL(request.url).origin;
  const allowedCountries = [requested.destinationCountry] as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    currency: quote.currency.toLowerCase(),
    automatic_tax: { enabled: false },
    tax_id_collection: { enabled: true },
    billing_address_collection: "required",
    shipping_address_collection: { allowed_countries: allowedCountries },
    line_items: quote.lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: quote.currency.toLowerCase(),
        unit_amount: line.unitPrice.amountMinor,
        tax_behavior: "inclusive",
        product_data: { name: line.title, metadata: { sku: line.sku, product_id: line.productId } },
      },
    })),
    shipping_options: [{
      shipping_rate_data: {
        display_name: bootstrap.translations["shipping.standard"] ?? bootstrap.translations["cart.shipping"] ?? "",
        type: "fixed_amount",
        fixed_amount: { amount: quote.shipping.amount.amountMinor, currency: quote.currency.toLowerCase() },
        delivery_estimate: {
          minimum: { unit: "business_day", value: Math.max(1, quote.shipping.delivery.totalDaysMin) },
          maximum: { unit: "business_day", value: Math.max(1, quote.shipping.delivery.totalDaysMax) },
        },
      },
    }],
    success_url: `${origin}/${quote.locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${quote.locale}/cart`,
    metadata: {
      order_id: orderId,
      locale: quote.locale,
      market: quote.market,
      visitor_country: quote.visitorCountry,
      destination_country: quote.destinationCountry,
      legal_versions: JSON.stringify(quote.legalVersions),
    },
  });

  if (orderId) await db.from("orders").update({ stripe_session_id: session.id }).eq("id", orderId);
  return NextResponse.json({ url: session.url, orderId });
}
