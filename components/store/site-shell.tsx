"use client";

import Link from "next/link";
import Image from "next/image";
import { Handbag, UserCircle, X } from "lucide-react";
import { formatMoney } from "@/lib/store/pricing";
import type { StoreBootstrap } from "@/lib/store/types";
import { StoreProvider, useStore } from "./store-context";
import { CookieConsent } from "./cookie-consent";

function Header() {
  const { bootstrap, cart, setCartOpen, t } = useStore();
  return <>
    <div className="topline">{t("topline")}</div>
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="wordmark" href={`/${bootstrap.locale.code}`}>{bootstrap.settings.brandName}</Link>
        <nav className="primary-nav" aria-label={t("nav.products")}>
          <Link href={`/${bootstrap.locale.code}#products`}>{t("nav.products")}</Link>
          <Link href={`/${bootstrap.locale.code}#process`}>{t("nav.process")}</Link>
          <Link href={`/${bootstrap.locale.code}#resources`}>{t("nav.resources")}</Link>
        </nav>
        <div className="header-actions">
          <Link className="icon-link" href={`/${bootstrap.locale.code}/account`} aria-label={t("nav.account")}><UserCircle size={21} /></Link>
          <button className="cart-button" onClick={() => setCartOpen(true)} aria-label={t("nav.cart")}><Handbag size={18} /><span>{cart.length}</span></button>
        </div>
      </div>
    </header>
  </>;
}

function CartDrawer() {
  const { bootstrap, cart, cartOpen, setCartOpen, removeFromCart, quote, t } = useStore();
  if (!cartOpen) return null;
  const productFor = (id: string) => bootstrap.products.find((product) => product.id === id);
  return <>
    <button className="drawer-backdrop" onClick={() => setCartOpen(false)} aria-label={t("cart.remove")} />
    <aside className="drawer" role="dialog" aria-modal="true" aria-label={t("cart.title")}>
      <div className="drawer-head"><h2>{t("cart.title")}</h2><button className="icon-link" onClick={() => setCartOpen(false)} aria-label={t("cart.close")}><X /></button></div>
      <div className="drawer-content">
        {!cart.length && <p className="muted-copy">{t("cart.empty")}</p>}
        {cart.map((item, index) => {
          const product = productFor(item.productId);
          const line = quote?.lines[index];
          if (!product) return null;
          return <div className="drawer-item" key={`${item.productId}-${item.addedAt}`}>
            {product.approvedImage && <Image src={product.approvedImage} alt={product.title} width={78} height={78} unoptimized />}
            <div><strong>{product.title}</strong><span>{t("cart.quantity")}: {item.quantity}</span><button className="text-button" onClick={() => removeFromCart(index)}>{t("cart.remove")}</button></div>
            {line && <strong>{formatMoney(line.lineTotal, bootstrap.locale.intlLocale, bootstrap.currency.decimals)}</strong>}
          </div>;
        })}
      </div>
      {quote && <div className="drawer-summary">
        <div><span>{t("cart.subtotal")}</span><strong>{formatMoney(quote.subtotal, bootstrap.locale.intlLocale, bootstrap.currency.decimals)}</strong></div>
        <div><span>{t("cart.shipping")}</span><strong>{quote.shipping.isFree ? t("cart.free") : formatMoney(quote.shipping.amount, bootstrap.locale.intlLocale, bootstrap.currency.decimals)}</strong></div>
        <div className="drawer-grand-total"><span>{t("cart.total")}</span><strong>{formatMoney(quote.total, bootstrap.locale.intlLocale, bootstrap.currency.decimals)}</strong></div>
        <span className="delivery-note">{t("cart.delivery")}: {quote.shipping.delivery.totalDaysMin}–{quote.shipping.delivery.totalDaysMax} {t("catalog.businessDays")}</span>
        <Link className="button button-primary button-full" onClick={() => setCartOpen(false)} href={`/${bootstrap.locale.code}/cart`}>{t("cart.view")}</Link>
      </div>}
    </aside>
  </>;
}

function Footer() {
  const { bootstrap, t } = useStore();
  const legalTypes = Array.from(new Set(bootstrap.legalDocuments.map((document) => document.documentType)));
  return <footer className="site-footer">
    <div className="shell footer-grid">
      <div><Link className="wordmark light" href={`/${bootstrap.locale.code}`}>{bootstrap.settings.brandName}</Link><p>{t("footer.tagline")}</p></div>
      <div><h3>{t("footer.shop")}</h3><Link href={`/${bootstrap.locale.code}#products`}>{t("nav.products")}</Link><Link href={`/${bootstrap.locale.code}#resources`}>{t("footer.downloads")}</Link></div>
      <div><h3>{t("footer.help")}</h3><a href={`mailto:${bootstrap.settings.supportEmail}`}>{t("footer.contact")}</a><Link href={`/${bootstrap.locale.code}/account`}>{t("nav.account")}</Link></div>
      <div><h3>{t("footer.legal")}</h3>{legalTypes.map((type) => <Link key={type} href={`/${bootstrap.locale.code}/legal/${type}`}>{t(`legal.${type}`)}</Link>)}</div>
    </div>
    <div className="shell footer-bottom"><span>{t("footer.copyright", { year: new Date().getFullYear(), brand: bootstrap.settings.brandName })}</span><span>{t("footer.prices")}</span></div>
  </footer>;
}

function ShellContents({ children }: { children: React.ReactNode }) {
  return <><Header />{children}<Footer /><CartDrawer /><CookieConsent /></>;
}

export function SiteShell({ bootstrap, children }: { bootstrap: StoreBootstrap; children: React.ReactNode }) {
  return <StoreProvider bootstrap={bootstrap}><ShellContents>{children}</ShellContents></StoreProvider>;
}
