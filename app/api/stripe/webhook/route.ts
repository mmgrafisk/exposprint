import Stripe from "stripe";
import { adminSupabase } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) return new Response("Not configured", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const stripe = new Stripe(key);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  const db = adminSupabase();
  if (!db) return new Response("Database unavailable", { status: 503 });

  const { data: claimed, error: claimError } = await db.from("stripe_events").insert({
    event_id: event.id,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
    processing_status: "processing",
  }).select("event_id").single();
  let mayProcess = Boolean(claimed);
  if (claimError?.code === "23505") {
    const { data: existing } = await db.from("stripe_events").select("processing_status,updated_at").eq("event_id", event.id).single();
    if (existing?.processing_status === "processed") return new Response("Already processed", { status: 200 });
    const stale = existing?.updated_at && Date.now() - new Date(existing.updated_at).getTime() > 10 * 60 * 1000;
    if (existing?.processing_status === "failed" || stale) {
      const { error: reclaimError } = await db.from("stripe_events").update({ processing_status: "processing", processing_error: null, updated_at: new Date().toISOString() }).eq("event_id", event.id).neq("processing_status", "processed");
      if (reclaimError) return new Response("Retry claim failed", { status: 503 });
      mayProcess = true;
    } else return new Response("Event is processing", { status: 409 });
  }
  if (!mayProcess) return new Response("Persistence failed", { status: 500 });

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      if (!orderId || orderId === "unpersisted") throw new Error("Missing order reference");
      const { error } = await db.from("orders").update({
        status: session.payment_status === "paid" ? "paid" : "payment_processing",
        stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
        customer_email: session.customer_details?.email,
        shipping_address: session.shipping_details ?? null,
        billing_details: session.customer_details ?? null,
        paid_at: session.payment_status === "paid" ? new Date().toISOString() : null,
      }).eq("id", orderId).eq("stripe_session_id", session.id);
      if (error) throw error;
    }
    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.order_id) await db.from("orders").update({ status: "payment_expired" }).eq("id", session.metadata.order_id);
    }
    await db.from("stripe_events").update({ processing_status: "processed", processed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("event_id", event.id);
    return new Response("ok");
  } catch (error) {
    await db.from("stripe_events").update({ processing_status: "failed", processing_error: error instanceof Error ? error.message : "Unknown error", updated_at: new Date().toISOString() }).eq("event_id", event.id);
    return new Response("Processing failed", { status: 500 });
  }
}
