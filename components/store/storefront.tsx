"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileUp, PackageCheck, ShieldCheck } from "lucide-react";
import { customerUnitPrice, deliveryEstimate, formatMoney } from "@/lib/store/pricing";
import { useStore } from "./store-context";

export function Storefront() {
  const { bootstrap, t } = useStore();
  const [category, setCategory] = useState<string>("");
  const published = bootstrap.products.filter((product) => product.status === "published" && product.approvedImage);
  const categories = useMemo(() => Array.from(new Set(published.map((product) => product.category))).sort(), [published]);
  const shown = category ? published.filter((product) => product.category === category) : published;
  const zone = bootstrap.shippingZones.find((item) => item.code === bootstrap.market.shippingZone) ?? bootstrap.shippingZones[0];
  const heroProduct = published.find((product) => product.approvedImage?.endsWith("23.webp")) ?? published[0];
  const countryNames = useMemo(() => new Intl.DisplayNames([bootstrap.locale.intlLocale], { type: "region" }), [bootstrap.locale.intlLocale]);
  const setMarket = (value: string) => {
    document.cookie = `ep_market=${encodeURIComponent(value)};path=/;max-age=31536000;samesite=lax`;
    const selected = bootstrap.markets.find((market) => market.countryCode === value);
    if (selected && selected.defaultCurrency !== bootstrap.currency.code) {
      document.cookie = `ep_currency=${encodeURIComponent(selected.defaultCurrency)};path=/;max-age=31536000;samesite=lax`;
    }
    location.reload();
  };

  return <main>
    <section className="hero">
      <div className="shell hero-grid">
        <div className="hero-copy"><span className="eyebrow">{t("hero.eyebrow")}</span><h1>{t("hero.titleA")}<br /><em>{t("hero.titleB")}</em></h1><p>{t("hero.body")}</p><div className="cta-row"><a className="button button-primary" href="#products">{t("hero.shop")}<ArrowRight size={17} /></a><a className="button button-light" href={`mailto:${bootstrap.settings.supportEmail}`}>{t("hero.advice")}</a></div></div>
        <div className="hero-visual">{heroProduct?.approvedImage && <Image className="hero-product" src={heroProduct.approvedImage} alt={heroProduct.title} width={900} height={1100} priority unoptimized />}<div className="hero-meta"><span>{t("catalog.freeShipping")}</span><strong>{bootstrap.market.countryCode} · {bootstrap.currency.code}</strong></div></div>
      </div>
    </section>
    <section className="market-bar"><div className="shell market-bar-inner"><div><span>{t("market.label")}</span><strong>{countryNames.of(bootstrap.market.countryCode)}</strong></div><label className="market-select"><span className="sr-only">{t("market.label")}</span><select value={bootstrap.market.countryCode} onChange={(event) => setMarket(event.target.value)}>{bootstrap.markets.map((market) => <option key={market.countryCode} value={market.countryCode}>{countryNames.of(market.countryCode)}</option>)}</select></label></div></section>
    <section className="trust-band"><div className="shell trust-grid">
      <article><PackageCheck /><div><strong>{t("trust.shippingTitle")}</strong><span>{t("trust.shippingBody")}</span></div></article>
      <article><CheckCircle2 /><div><strong>{t("trust.proofTitle")}</strong><span>{t("trust.proofBody")}</span></div></article>
      <article><ShieldCheck /><div><strong>{t("trust.paymentTitle")}</strong><span>{t("trust.paymentBody")}</span></div></article>
      <article><FileUp /><div><strong>{t("trust.supportTitle")}</strong><span>{t("trust.supportBody")}</span></div></article>
    </div></section>
    <section className="section catalogue" id="products"><div className="shell">
      <div className="section-head"><div><span className="eyebrow">{t("catalog.eyebrow")}</span><h2>{t("catalog.title")}</h2></div><span className="catalogue-count">{published.length} / {bootstrap.catalogueCount}</span></div>
      <div className="filters"><button className={!category ? "chip active" : "chip"} onClick={() => setCategory("")}>{t("catalog.all")}</button>{categories.map((item) => <button key={item} className={category === item ? "chip active" : "chip"} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="product-grid">{shown.map((product) => {
        const price = customerUnitPrice(product, bootstrap.market, bootstrap.currency, bootstrap.settings.grossMarginPercent).gross;
        const delivery = deliveryEstimate(product, zone);
        return <article className="product-card" key={product.id}>
          <Link className="product-card-image" href={`/${bootstrap.locale.code}/products/${product.slug}`}>{product.approvedImage && <Image src={product.approvedImage} alt={product.title} width={800} height={800} unoptimized />}</Link>
          <div className="product-card-body"><span className="card-category">{product.category}</span><h3><Link href={`/${bootstrap.locale.code}/products/${product.slug}`}>{product.title}</Link></h3><div className="product-card-delivery"><span>{t("catalog.production")}: {delivery.productionDaysMin} {t("catalog.businessDays")}</span><span>{t("catalog.delivery")}: {delivery.totalDaysMin}–{delivery.totalDaysMax} {t("catalog.businessDays")}</span></div><div className="price-row"><div><span>{t("catalog.from")}</span><strong>{formatMoney(price, bootstrap.locale.intlLocale, bootstrap.currency.decimals)}</strong><small>{t("catalog.vatIncluded")}</small></div><Link className="round-link" href={`/${bootstrap.locale.code}/products/${product.slug}`} aria-label={`${t("catalog.details")}: ${product.title}`}><ArrowRight /></Link></div></div>
        </article>;
      })}</div>
      {!shown.length && <p className="empty-state">{t("catalog.empty")}</p>}
    </div></section>
    <section className="section process" id="process"><div className="shell process-grid"><div className="process-intro"><span className="eyebrow">{t("process.eyebrow")}</span><h2>{t("process.title")}</h2><p>{t("process.body")}</p></div><div className="process-steps"><article><b>01</b><div><strong>{t("process.step1Title")}</strong><span>{t("process.step1Body")}</span></div></article><article><b>02</b><div><strong>{t("process.step2Title")}</strong><span>{t("process.step2Body")}</span></div></article><article><b>03</b><div><strong>{t("process.step3Title")}</strong><span>{t("process.step3Body")}</span></div></article></div></div></section>
    <section className="section resources" id="resources"><div className="shell"><div className="section-head"><div><span className="eyebrow">{t("resources.eyebrow")}</span><h2>{t("resources.title")}</h2></div></div><div className="resource-grid"><article><span>01</span><h3>{t("resources.catalogueTitle")}</h3><p>{t("resources.catalogueBody")}</p><a className="button" href={`/resources/catalogue-${bootstrap.locale.code}.pdf`}>{t("resources.open")}<ArrowRight size={17} /></a></article><article><span>02</span><h3>{t("resources.technicalTitle")}</h3><p>{t("resources.technicalBody")}</p><a className="button" href={`/resources/index-${bootstrap.locale.code}.html`}>{t("resources.open")}<ArrowRight size={17} /></a></article></div></div></section>
  </main>;
}
