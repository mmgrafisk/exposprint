"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useTranslation } from "react-i18next";
import { StoreI18nProvider } from "@/components/store/i18n-provider";
import type { StoreBootstrap } from "@/lib/store/types";

type AdminData = {
  products: Array<Record<string, unknown>>;
  translations: Array<Record<string, unknown>>;
  requiredTranslations: Array<Record<string, unknown>>;
  locales: Array<Record<string, unknown>>;
  currencies: Array<Record<string, unknown>>;
  markets: Array<Record<string, unknown>>;
  shipping: Array<Record<string, unknown>>;
  legal: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  business: Record<string, unknown> | null;
  settings: Array<Record<string, unknown>>;
  requiredLegal: Array<Record<string, unknown>>;
};

const productStatuses = ["draft", "hidden", "published", "archived"];
const orderStatuses = [
  "pending_payment",
  "payment_processing",
  "paid",
  "artwork_review",
  "production",
  "shipped",
  "completed",
  "cancelled",
  "payment_expired",
];

function AdminConsoleInner({
  bootstrap,
  email,
}: {
  bootstrap: StoreBootstrap;
  email: string;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState("overview");
  const [locale, setLocale] = useState(bootstrap.locale.code);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/data", { cache: "no-store" });
    if (!response.ok) return setMessage(String(t("admin.saveError")));
    setData((await response.json()) as AdminData);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(
    resource: string,
    id: string,
    values: Record<string, unknown>,
  ) {
    setMessage("");
    const response = await fetch("/api/admin/data", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource, id, values }),
    });
    if (!response.ok) return setMessage(String(t("admin.saveError")));
    setMessage(String(t("admin.saved")));
    await load();
  }

  async function signOut() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (url && key)
      await createBrowserClient(url, key).auth.signOut({ scope: "global" });
    location.href = "/admin/login";
  }

  const coverage = useMemo(() => {
    if (!data) return [];
    return data.locales.map((item) => {
      const code = String(item.code);
      const translated = new Set(
        data.translations
          .filter((entry) => entry.locale === code)
          .map((entry) => `${entry.namespace}.${entry.key}`),
      );
      const required = data.requiredTranslations.length;
      const complete = data.requiredTranslations.filter((entry) =>
        translated.has(`${entry.namespace}.${entry.key}`),
      ).length;
      return {
        code,
        complete,
        required,
        percent: required ? Math.round((complete / required) * 100) : 100,
      };
    });
  }, [data]);

  const visibleTranslations = useMemo(() => {
    if (!data) return [];
    const existing = data.translations.filter((entry) => entry.locale === locale);
    const byKey = new Map(existing.map((entry) => [`${entry.namespace}.${entry.key}`, entry]));
    for (const required of data.requiredTranslations) {
      const identifier = `${required.namespace}.${required.key}`;
      if (!byKey.has(identifier)) byKey.set(identifier, {
        locale,
        namespace: required.namespace,
        key: required.key,
        value: "",
        status: "missing",
      });
    }
    return [...byKey.values()].sort((a, b) => `${a.namespace}.${a.key}`.localeCompare(`${b.namespace}.${b.key}`));
  }, [data, locale]);

  if (!data)
    return (
      <main className="admin-page">
        <div className="shell admin-shell">
          <p>{t("admin.loading")}</p>
          {message && <p className="error-message">{message}</p>}
        </div>
      </main>
    );

  const tabs = [
    "overview",
    "products",
    "translations",
    "markets",
    "shipping",
    "legal",
    "orders",
  ];
  const launchReady =
    data.settings.find((item) => item.key === "launch_ready")?.value === true;
  return (
    <main className="admin-page">
      <div className="topline admin-topline">
        <span>{email}</span>
        <button className="text-button" onClick={signOut}>
          {t("admin.signOut")}
        </button>
      </div>
      <div className="shell admin-shell">
        <div className="admin-heading">
          <div>
            <span className="eyebrow">{bootstrap.settings.brandName}</span>
            <h1>{t("admin.title")}</h1>
            <p>{t("admin.subtitle")}</p>
          </div>
          <div className={`launch-status ${launchReady ? "ready" : "blocked"}`}>
            <strong>
              {launchReady ? t("admin.launchReady") : t("admin.launchBlocked")}
            </strong>
            <span>
              {launchReady ? t("admin.published") : t("admin.launchReason")}
            </span>
          </div>
        </div>
        <nav className="admin-tabs" aria-label={String(t("admin.title"))}>
          {tabs.map((item) => (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              onClick={() => setTab(item)}
            >
              {t(`admin.${item}`)}
            </button>
          ))}
        </nav>
        {message && (
          <p className="admin-message" role="status">
            {message}
          </p>
        )}

        {tab === "overview" && (
          <section className="admin-grid">
            <article>
              <span>
                {
                  data.products.filter((item) => item.status === "published")
                    .length
                }{" "}
                / {data.products.length}
              </span>
              <h2>{t("admin.catalog")}</h2>
              <p>{t("admin.catalogBody")}</p>
            </article>
            <article>
              <span>
                {data.locales.length} · {data.currencies.length} ·{" "}
                {data.markets.length}
              </span>
              <h2>{t("admin.markets")}</h2>
              <p>{t("admin.marketsBody")}</p>
            </article>
            <article>
              <span>{data.shipping.length}</span>
              <h2>{t("admin.shipping")}</h2>
              <p>{t("admin.shippingBody")}</p>
            </article>
            <article>
              <span>{data.legal.length}</span>
              <h2>{t("admin.legal")}</h2>
              <p>{t("admin.legalBody")}</p>
            </article>
            <article>
              <span>{data.orders.length}</span>
              <h2>{t("admin.orders")}</h2>
              <p>{t("admin.ordersBody")}</p>
            </article>
            <article>
              <span>
                {coverage
                  .map((item) => `${item.code.toUpperCase()} ${item.percent}%`)
                  .join(" · ")}
              </span>
              <h2>{t("admin.translationCoverage")}</h2>
              <p>
                {coverage
                  .map((item) => `${item.complete}/${item.required}`)
                  .join(" · ")}
              </p>
            </article>
          </section>
        )}

        {tab === "products" && (
          <section className="admin-panel">
            <h2>{t("admin.products")}</h2>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                  <th>{t("admin.sku")}</th>
                    <th>{t("admin.status")}</th>
                    <th>{t("admin.price")}</th>
                    <th>{t("admin.production")}</th>
                    <th>
                      <span className="sr-only">{t("admin.save")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((product) => (
                    <tr key={String(product.id)}>
                      <td>{String(product.sku)}</td>
                      <td>
                        <select
                          form={`product-${product.id}`}
                          name="status"
                          defaultValue={String(product.status)}
                        >
                          {productStatuses.map((status) => (
                            <option key={status} value={status}>
                              {t(`admin.${status}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          form={`product-${product.id}`}
                          name="supplierCost"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={
                            product.supplier_cost_minor == null
                              ? ""
                              : Number(product.supplier_cost_minor)
                          }
                        />
                      </td>
                      <td>
                        <div className="inline-fields">
                          <input
                            form={`product-${product.id}`}
                            name="productionMin"
                            type="number"
                            min="0"
                            defaultValue={
                              product.production_days_min == null
                                ? ""
                                : Number(product.production_days_min)
                            }
                          />
                          <input
                            form={`product-${product.id}`}
                            name="productionMax"
                            type="number"
                            min="0"
                            defaultValue={
                              product.production_days_max == null
                                ? ""
                                : Number(product.production_days_max)
                            }
                          />
                        </div>
                      </td>
                      <td>
                        <form
                          id={`product-${product.id}`}
                          onSubmit={(event) => {
                            event.preventDefault();
                            const form = new FormData(event.currentTarget);
                            void save("product", String(product.id), {
                              status: form.get("status"),
                              supplierCostMinor:
                                form.get("supplierCost") === ""
                                  ? null
                                  : Number(form.get("supplierCost")),
                              productionDaysMin:
                                form.get("productionMin") === ""
                                  ? null
                                  : Number(form.get("productionMin")),
                              productionDaysMax:
                                form.get("productionMax") === ""
                                  ? null
                                  : Number(form.get("productionMax")),
                            });
                          }}
                        >
                          <button className="button">{t("admin.save")}</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "translations" && (
          <section className="admin-panel">
            <div className="admin-panel-head">
              <h2>{t("admin.translations")}</h2>
              <select
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
                aria-label={String(t("admin.locale"))}
              >
                {data.locales.map((item) => (
                  <option key={String(item.code)} value={String(item.code)}>
                    {String(item.name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-translation-list">
              {visibleTranslations.map((entry) => (
                <form
                  key={`${entry.locale}:${entry.namespace}:${entry.key}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void save(
                      "translation",
                      `${entry.locale}:${entry.namespace}:${entry.key}`,
                      { value: form.get("value") },
                    );
                  }}
                >
                  <label>
                    <span>
                      {String(entry.namespace)}.{String(entry.key)}
                    </span>
                    <textarea name="value" defaultValue={String(entry.value)} />
                  </label>
                  <button className="button">{t("admin.save")}</button>
                </form>
              ))}
            </div>
            <div className="admin-create-grid">
              <div>
                <h3>{t("admin.locale")}</h3>
                {data.locales.map((item) => (
                  <form key={String(item.code)} onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void save("localeStatus", String(item.code), { enabled: form.get("enabled") === "on" });
                  }}>
                    <label><input name="enabled" type="checkbox" defaultChecked={Boolean(item.enabled)} />{String(item.name)} · {t("admin.enabled")}</label>
                    <button className="button">{t("admin.save")}</button>
                  </form>
                ))}
              </div>
              <div>
                <h3>{t("admin.currency")}</h3>
                {data.currencies.map((item) => (
                  <form key={String(item.code)} onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void save("currencyStatus", String(item.code), { enabled: form.get("enabled") === "on" });
                  }}>
                    <label><input name="enabled" type="checkbox" defaultChecked={Boolean(item.enabled)} />{String(item.code)} · {t("admin.enabled")}</label>
                    <button className="button">{t("admin.save")}</button>
                  </form>
                ))}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const code = String(form.get("code"));
                  void save("locale", code, {
                    code,
                    name: form.get("name"),
                    hreflang: form.get("hreflang"),
                    intlLocale: form.get("intlLocale"),
                  });
                }}
              >
                <h3>{t("admin.addLocale")}</h3>
                <input
                  name="code"
                  required
                  placeholder={String(t("admin.localeCode"))}
                />
                <input
                  name="name"
                  required
                  placeholder={String(t("admin.localeName"))}
                />
                <input
                  name="hreflang"
                  required
                  placeholder={String(t("admin.hreflang"))}
                />
                <input
                  name="intlLocale"
                  required
                  placeholder={String(t("admin.intlLocale"))}
                />
                <button className="button">{t("admin.add")}</button>
              </form>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const code = String(form.get("code")).toUpperCase();
                  void save("currency", code, {
                    code,
                    name: form.get("name"),
                    symbol: form.get("symbol"),
                    decimals: Number(form.get("decimals")),
                    rateFromDkk: Number(form.get("rate")),
                    roundingIncrement: Number(form.get("rounding")),
                  });
                }}
              >
                <h3>{t("admin.addCurrency")}</h3>
                <input
                  name="code"
                  required
                  placeholder={String(t("admin.currencyCode"))}
                />
                <input
                  name="name"
                  required
                  placeholder={String(t("admin.currencyName"))}
                />
                <input
                  name="symbol"
                  required
                  placeholder={String(t("admin.currencySymbol"))}
                />
                <input
                  name="decimals"
                  type="number"
                  min="0"
                  max="4"
                  defaultValue="2"
                  required
                />
                <input
                  name="rate"
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  required
                  placeholder={String(t("admin.exchangeRate"))}
                />
                <input
                  name="rounding"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue="0.01"
                  required
                />
                <button className="button">{t("admin.add")}</button>
              </form>
            </div>
          </section>
        )}

        {tab === "markets" && (
          <section className="admin-panel">
            <h2>{t("admin.markets")}</h2>
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("admin.country")}</th>
                    <th>{t("admin.locale")}</th>
                    <th>{t("admin.currency")}</th>
                    <th>{t("admin.vat")}</th>
                    <th>{t("admin.shipping")}</th>
                    <th>{t("admin.enabled")}</th>
                    <th>
                      <span className="sr-only">{t("admin.save")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.markets.map((market) => (
                    <tr key={String(market.country_code)}>
                      <td>{String(market.country_code)}</td>
                      <td>
                        <select
                          form={`market-${market.country_code}`}
                          name="locale"
                          defaultValue={String(market.default_locale)}
                        >
                          {data.locales.map((item) => (
                            <option
                              key={String(item.code)}
                              value={String(item.code)}
                            >
                              {String(item.name)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          form={`market-${market.country_code}`}
                          name="currency"
                          defaultValue={String(market.default_currency)}
                        >
                          {data.currencies.map((item) => (
                            <option
                              key={String(item.code)}
                              value={String(item.code)}
                            >
                              {String(item.code)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          form={`market-${market.country_code}`}
                          name="vat"
                          type="number"
                          min="0"
                          max="100"
                          step="0.001"
                          defaultValue={Number(market.vat_rate)}
                        />
                      </td>
                      <td>
                        <select
                          form={`market-${market.country_code}`}
                          name="zone"
                          defaultValue={String(market.shipping_zone_code)}
                        >
                          {data.shipping.map((item) => (
                            <option
                              key={String(item.code)}
                              value={String(item.code)}
                            >
                              {String(item.name)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          form={`market-${market.country_code}`}
                          name="enabled"
                          type="checkbox"
                          defaultChecked={Boolean(market.enabled)}
                        />
                      </td>
                      <td>
                        <form
                          id={`market-${market.country_code}`}
                          onSubmit={(event) => {
                            event.preventDefault();
                            const form = new FormData(event.currentTarget);
                            void save("market", String(market.country_code), {
                              defaultLocale: form.get("locale"),
                              defaultCurrency: form.get("currency"),
                              vatRate: Number(form.get("vat")),
                              shippingZone: form.get("zone"),
                              enabled: form.get("enabled") === "on",
                            });
                          }}
                        >
                          <button className="button">{t("admin.save")}</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "shipping" && (
          <section className="admin-panel">
            <h2>{t("admin.shipping")}</h2>
            <div className="admin-card-list">
              {data.shipping.map((zone) => (
                <form
                  key={String(zone.code)}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void save("shipping", String(zone.code), {
                      transitDaysMin: Number(form.get("min")),
                      transitDaysMax: Number(form.get("max")),
                      priceMinorDkk: Number(form.get("price")),
                      enabled: form.get("enabled") === "on",
                    });
                  }}
                >
                  <h3>{String(zone.name)}</h3>
                  <label>
                    <span>{t("admin.deliveryMin")}</span>
                    <input
                      name="min"
                      type="number"
                      min="0"
                      defaultValue={Number(zone.transit_days_min)}
                    />
                  </label>
                  <label>
                    <span>{t("admin.deliveryMax")}</span>
                    <input
                      name="max"
                      type="number"
                      min="0"
                      defaultValue={Number(zone.transit_days_max)}
                    />
                  </label>
                  <label>
                    <span>{t("admin.shippingPrice")}</span>
                    <input
                      name="price"
                      type="number"
                      min="0"
                      defaultValue={Number(zone.price_minor_dkk)}
                    />
                  </label>
                  <label>
                    <input
                      name="enabled"
                      type="checkbox"
                      defaultChecked={Boolean(zone.enabled)}
                    />
                    {t("admin.enabled")}
                  </label>
                  <button className="button">{t("admin.save")}</button>
                </form>
              ))}
            </div>
          </section>
        )}

        {tab === "legal" && (
          <section className="admin-panel">
            <h2>{t("admin.legal")}</h2>
            <form className="admin-create-legal" onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void save("legalCreate", `${form.get("locale")}:${form.get("documentType")}`, {
                locale: form.get("locale"),
                documentType: form.get("documentType"),
                body: form.get("body"),
                effectiveAt: form.get("effectiveAt") ? new Date(String(form.get("effectiveAt"))).toISOString() : null,
              });
            }}>
              <h3>{t("admin.add")} · {t("admin.document")}</h3>
              <label><span>{t("admin.locale")}</span><select name="locale">{data.locales.map((item) => <option key={String(item.code)} value={String(item.code)}>{String(item.name)}</option>)}</select></label>
              <label><span>{t("admin.document")}</span><select name="documentType">{data.requiredLegal.map((item) => <option key={String(item.code)} value={String(item.code)}>{t(`legal.${item.code}`)}</option>)}</select></label>
              <label><span>{t("legal.updated")}</span><input name="effectiveAt" type="datetime-local" /></label>
              <label><span>{t("admin.document")}</span><textarea name="body" required /></label>
              <button className="button">{t("admin.add")}</button>
            </form>
            <div className="admin-card-list legal-admin-list">
              {data.legal.map((document) => (
                <form
                  key={String(document.id)}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void save("legal", String(document.id), {
                      body: form.get("body"),
                      status: form.get("status"),
                      approve: form.get("approve") === "on",
                    });
                  }}
                >
                  <div>
                    <span className="eyebrow">
                      {String(document.locale).toUpperCase()} ·{" "}
                      {t(`legal.${document.document_type}`)}
                    </span>
                    <h3>
                      {t("admin.version")} {String(document.version)}
                    </h3>
                  </div>
                  <textarea name="body" defaultValue={String(document.body)} />
                  <select name="status" defaultValue={String(document.status)}>
                    {["draft", "published", "archived"].map((status) => (
                      <option key={status} value={status}>
                        {t(`admin.${status}`)}
                      </option>
                    ))}
                  </select>
                  <label>
                    <input name="approve" type="checkbox" />
                    {t("admin.approve")}
                  </label>
                  <button className="button">{t("admin.save")}</button>
                </form>
              ))}
            </div>
          </section>
        )}

        {tab === "orders" && (
          <section className="admin-panel">
            <h2>{t("admin.orders")}</h2>
            {!data.orders.length ? (
              <p>{t("admin.noData")}</p>
            ) : (
              <div className="admin-card-list">
                {data.orders.map((order) => (
                  <form
                    key={String(order.id)}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      void save("order", String(order.id), {
                        status: form.get("status"),
                        adivinReference: form.get("adivin") || null,
                        trackingNumber: form.get("tracking") || null,
                      });
                    }}
                  >
                    <div>
                      <span className="eyebrow">
                        {t("admin.order")} {String(order.order_number)}
                      </span>
                      <h3>{String(order.customer_email ?? "")}</h3>
                      <p>
                        {String(order.destination_country ?? "")} ·{" "}
                        {new Intl.NumberFormat(bootstrap.locale.intlLocale, {
                          style: "currency",
                          currency: String(order.currency),
                        }).format(Number(order.total_minor) / 100)}
                      </p>
                    </div>
                    <select name="status" defaultValue={String(order.status)}>
                      {orderStatuses.map((status) => (
                        <option key={status} value={status}>
                          {t(`orderStatus.${status}`)}
                        </option>
                      ))}
                    </select>
                    <label>
                      <span>{t("admin.adivin")}</span>
                      <input
                        name="adivin"
                        defaultValue={String(order.adivin_reference ?? "")}
                      />
                    </label>
                    <label>
                      <span>{t("admin.tracking")}</span>
                      <input
                        name="tracking"
                        defaultValue={String(order.tracking_number ?? "")}
                      />
                    </label>
                    <button className="button">{t("admin.save")}</button>
                  </form>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

export function AdminConsole({
  bootstrap,
  email,
}: {
  bootstrap: StoreBootstrap;
  email: string;
}) {
  return (
    <StoreI18nProvider
      locale={bootstrap.locale.code}
      translations={bootstrap.translations}
    >
      <AdminConsoleInner bootstrap={bootstrap} email={email} />
    </StoreI18nProvider>
  );
}
