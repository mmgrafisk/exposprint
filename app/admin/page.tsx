import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/server";
import { getStoreBootstrap } from "@/lib/store/data";

export default async function AdminPage() {
  const [user, bootstrap] = await Promise.all([requireAdmin(), getStoreBootstrap()]);
  const t = (key: string) => bootstrap.translations[key] ?? key;
  if (!user) return <main className="admin-lock"><section>
    <span className="eyebrow">ExposPrint Admin</span><h1>{t("admin.lockedTitle")}</h1><p>{t("admin.lockedBody")}</p>
    <Link className="button button-primary" href={`/${bootstrap.locale.code}/account`}>{t("account.submit")}</Link>
  </section></main>;

  const published = bootstrap.products.filter((product) => product.status === "published").length;
  const cards = [
    ["admin.catalog", "admin.catalogBody", `${published} / ${bootstrap.catalogueCount}`],
    ["admin.markets", "admin.marketsBody", `${bootstrap.locales.length} · ${bootstrap.currencies.length} · ${bootstrap.markets.length}`],
    ["admin.shipping", "admin.shippingBody", `${bootstrap.shippingZones.length}`],
    ["admin.legal", "admin.legalBody", `${bootstrap.legalDocuments.length}`],
    ["admin.orders", "admin.ordersBody", "Stripe · Adivin"],
  ];
  return <main className="admin-page"><div className="topline">{user.email}</div><div className="shell admin-shell">
    <div className="admin-heading"><div><span className="eyebrow">ExposPrint Admin</span><h1>{t("admin.title")}</h1><p>{t("admin.subtitle")}</p></div><div className={`launch-status ${bootstrap.settings.launchReady ? "ready" : "blocked"}`}><strong>{t("admin.launchBlocked")}</strong><span>{t("admin.launchReason")}</span></div></div>
    <section className="admin-grid">{cards.map(([title, body, meta]) => <article key={title}><span>{meta}</span><h2>{t(title)}</h2><p>{t(body)}</p><button className="text-button" type="button">{t(title)}</button></article>)}</section>
  </div></main>;
}
