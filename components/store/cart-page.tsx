"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LoaderCircle, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/store/pricing";
import { useStore } from "./store-context";

export function CartPage() {
  const { bootstrap, cart, quote, removeFromCart, t } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const productFor = (id: string) => bootstrap.products.find((product) => product.id === id);
  async function checkout() {
    if (!quote) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locale: bootstrap.locale.code, currency: bootstrap.currency.code, market: bootstrap.market.countryCode, items: cart.map(({ productId, quantity, configuration, artwork }) => ({ productId, quantity, configuration, artworkPath: artwork?.path, artworkSession: artwork?.cartSession })) }) });
      const body = await response.json() as { url?: string };
      if (!response.ok || !body.url) throw new Error("CHECKOUT_FAILED");
      location.href = body.url;
    } catch { setError(t("checkout.error")); setLoading(false); }
  }
  return <main className="cart-page"><div className="shell"><span className="eyebrow">ExposPrint</span><h1>{t("cart.title")}</h1>{!cart.length ? <div className="empty-cart"><p>{t("cart.empty")}</p><Link className="button button-primary" href={`/${bootstrap.locale.code}#products`}>{t("hero.shop")}<ArrowRight size={17} /></Link></div> : <div className="cart-layout"><section className="cart-lines">{cart.map((item, index) => { const product = productFor(item.productId); const line = quote?.lines[index]; if (!product) return null; return <article key={`${item.productId}-${item.addedAt}`}>{product.approvedImage && <Image src={product.approvedImage} alt="" width={180} height={180} unoptimized />}<div><span className="card-category">{product.category}</span><h2>{product.title}</h2><p>{t("cart.quantity")}: {item.quantity}</p>{Object.values(item.configuration ?? {}).map((value) => <small key={String(value)}>{Array.isArray(value) ? value.join(", ") : value}</small>)}</div><div className="cart-line-price">{line && <strong>{formatMoney(line.lineTotal, bootstrap.locale.intlLocale, bootstrap.currency.decimals)}</strong>}<button className="icon-link" onClick={() => removeFromCart(index)} aria-label={t("cart.remove")}><Trash2 /></button></div></article>; })}</section>{quote && <aside className="order-summary"><h2>{t("cart.total")}</h2><div><span>{t("cart.subtotal")}</span><strong>{formatMoney(quote.subtotal, bootstrap.locale.intlLocale, bootstrap.currency.decimals)}</strong></div><div><span>{t("cart.shipping")}</span><strong>{quote.shipping.isFree ? t("cart.free") : formatMoney(quote.shipping.amount, bootstrap.locale.intlLocale, bootstrap.currency.decimals)}</strong></div><div className="summary-total"><span>{t("cart.total")}</span><strong>{formatMoney(quote.total, bootstrap.locale.intlLocale, bootstrap.currency.decimals)}</strong></div><p>{t("cart.delivery")}: {quote.shipping.delivery.totalDaysMin}–{quote.shipping.delivery.totalDaysMax} {t("catalog.businessDays")}</p><p className="terms-note">{t("cart.terms")} <Link href={`/${bootstrap.locale.code}/legal/terms`}>{t("legal.terms")}</Link></p>{error && <p className="error-message" role="alert">{error}</p>}<button className="button button-primary button-full" onClick={checkout} disabled={loading}>{loading ? <LoaderCircle className="spin" /> : null}{t("cart.checkout")}</button></aside>}</div>}</div></main>;
}
