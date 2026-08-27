"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle2, Pencil, Search, X } from "lucide-react";
import { StoreI18nProvider } from "@/components/store/i18n-provider";
import type { StoreBootstrap } from "@/lib/store/types";

type AdminData = {
  products: Array<Record<string, unknown>>;
  productTranslations: Array<Record<string, unknown>>;
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

function objectValue(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function addressValue(address: Record<string, unknown>, key: string) {
  return address[key] == null ? "" : String(address[key]);
}

function addressFromForm(form: FormData, prefix: string) {
  return {
    line1: String(form.get(`${prefix}Line1`) ?? "").trim(),
    line2: String(form.get(`${prefix}Line2`) ?? "").trim(),
    postalCode: String(form.get(`${prefix}PostalCode`) ?? "").trim(),
    city: String(form.get(`${prefix}City`) ?? "").trim(),
    countryCode: String(form.get(`${prefix}CountryCode`) ?? "").trim().toUpperCase(),
  };
}

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function addressComplete(address: Record<string, unknown>) {
  return ["line1", "postalCode", "city", "countryCode"].every((key) => hasText(address[key]));
}

function AdminConsoleInner({
  bootstrap,
  email,
  authConfig,
}: {
  bootstrap: StoreBootstrap;
  email: string;
  authConfig: { url: string; publishableKey: string } | null;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState("overview");
  const [locale, setLocale] = useState(bootstrap.locale.code);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  const [productSearch, setProductSearch] = useState("");
  const [productStatus, setProductStatus] = useState("all");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productLocale, setProductLocale] = useState(bootstrap.locale.code);

  async function load() {
    const response = await fetch("/api/admin/data", { cache: "no-store" });
    if (!response.ok) {
      setMessageKind("error");
      return setMessage(String(t("admin.saveError")));
    }
    setData((await response.json()) as AdminData);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(handle);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!message || messageKind !== "success") return;
    const handle = window.setTimeout(() => setMessage(""), 2800);
    return () => window.clearTimeout(handle);
  }, [message, messageKind]);

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
    if (!response.ok) {
      setMessageKind("error");
      setMessage(String(t("admin.saveError")));
      return false;
    }
    setMessageKind("success");
    setMessage(String(t("admin.saved")));
    await load();
    return true;
  }

  async function signOut() {
    if (authConfig) {
      await createBrowserClient(authConfig.url, authConfig.publishableKey).auth.signOut({ scope: "global" });
    }
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

  const productTranslationMap = useMemo(() => new Map(
    (data?.productTranslations ?? []).map((entry) => [
      `${entry.product_id}:${entry.locale}`,
      entry,
    ]),
  ), [data]);

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    const query = productSearch.trim().toLocaleLowerCase(bootstrap.locale.intlLocale);
    return data.products.filter((product) => {
      if (productStatus !== "all" && product.status !== productStatus) return false;
      if (!query) return true;
      const translation = productTranslationMap.get(`${product.id}:${bootstrap.locale.code}`)
        ?? productTranslationMap.get(`${product.id}:${bootstrap.settings.fallbackLocale}`);
      return [product.sku, product.category_slug, translation?.name]
        .some((value) => String(value ?? "").toLocaleLowerCase(bootstrap.locale.intlLocale).includes(query));
    });
  }, [bootstrap.locale.code, bootstrap.locale.intlLocale, bootstrap.settings.fallbackLocale, data, productSearch, productStatus, productTranslationMap]);

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
    "company",
    "products",
    "translations",
    "markets",
    "shipping",
    "legal",
    "orders",
  ];
  const launchReady =
    data.settings.find((item) => item.key === "launch_ready")?.value === true;
  const business = data.business ?? {};
  const physicalAddress = objectValue(business.physical_address);
  const returnAddress = objectValue(business.return_address);
  const businessComplete = ["company_name", "vat_number", "email", "phone"].every((key) => hasText(business[key]))
    && addressComplete(physicalAddress)
    && addressComplete(returnAddress)
    && Boolean(business.approved_at);
  const requiredLegalCodes = new Set(data.requiredLegal.map((item) => String(item.code)));
  const approvedLegalCodes = new Set(data.legal
    .filter((item) => item.locale === "da" && item.status === "published" && item.approved_at)
    .map((item) => String(item.document_type)));
  const approvedLegalCount = [...requiredLegalCodes].filter((code) => approvedLegalCodes.has(code)).length;
  const translationsComplete = coverage
    .filter((item) => data.locales.some((localeItem) => localeItem.code === item.code && localeItem.enabled))
    .every((item) => item.complete === item.required);
  const launchCanEnable = businessComplete
    && approvedLegalCount === requiredLegalCodes.size
    && translationsComplete;
  return (
    <main className="admin-page">
      <div className="admin-workspace">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand">
            <span className="wordmark light">{bootstrap.settings.brandName}</span>
            <span>{t("admin.title")}</span>
          </div>
          <nav className="admin-nav" aria-label={String(t("admin.title"))}>
            {tabs.map((item) => (
              <button
                key={item}
                className={tab === item ? "active" : ""}
                onClick={() => {
                  setTab(item);
                  setMessage("");
                  setEditingProductId(null);
                }}
              >
                <span aria-hidden="true" />
                {t(`admin.${item}`)}
              </button>
            ))}
          </nav>
          <div className="admin-sidebar-footer">
            <span>{email}</span>
            <button className="text-button" onClick={signOut}>
              {t("admin.signOut")}
            </button>
          </div>
        </aside>
        <div className="admin-main">
          <div className="admin-shell">
        <div className="admin-heading">
          <div>
            <h1 className="admin-control-title">{t("admin.title")}</h1>
            <p>{t("admin.subtitle")}</p>
          </div>
          <div className={`launch-status ${launchReady ? "ready" : "blocked"}`}>
            <strong>
              {launchReady ? t("admin.launchReady") : t("admin.launchBlocked")}
            </strong>
            <span>
              {launchReady ? t("admin.published") : t("admin.launchReason")}
            </span>
            {!launchReady && <ul className="launch-checklist">
              {!businessComplete && <li>{t("admin.launchBusinessMissing")}</li>}
              {approvedLegalCount < requiredLegalCodes.size && <li>{t("admin.launchLegalMissing", { complete: approvedLegalCount, required: requiredLegalCodes.size })}</li>}
              {!translationsComplete && <li>{t("admin.launchTranslationsMissing")}</li>}
            </ul>}
          </div>
        </div>
        {message && (
          <div
            className={`admin-toast ${messageKind}`}
            role={messageKind === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {messageKind === "success"
              ? <CheckCircle2 aria-hidden="true" />
              : <AlertCircle aria-hidden="true" />}
            <span>{message}</span>
            <button
              className="admin-toast-dismiss"
              type="button"
              onClick={() => setMessage("")}
              aria-label={String(t("admin.dismiss"))}
            >
              <X aria-hidden="true" />
            </button>
          </div>
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

        {tab === "company" && (
          <section className="admin-panel company-admin-panel">
            <div className="admin-panel-head">
              <div>
                <h2>{t("admin.company")}</h2>
                <p>{t("admin.companyBody")}</p>
              </div>
            </div>
            <form className="company-admin-form" onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void save("business", "singleton", {
                companyName: String(form.get("companyName") ?? "").trim(),
                vatNumber: String(form.get("vatNumber") ?? "").trim(),
                email: String(form.get("email") ?? "").trim(),
                phone: String(form.get("phone") ?? "").trim(),
                physicalAddress: addressFromForm(form, "physical"),
                returnAddress: addressFromForm(form, "return"),
                approve: form.get("approve") === "on",
              });
            }}>
              <div className="company-admin-grid">
                <label><span>{t("admin.companyName")}</span><input name="companyName" defaultValue={String(business.company_name ?? "")} /></label>
                <label><span>{t("admin.vatNumber")}</span><input name="vatNumber" defaultValue={String(business.vat_number ?? "")} /></label>
                <label><span>{t("admin.email")}</span><input name="email" type="email" defaultValue={String(business.email ?? "")} /></label>
                <label><span>{t("admin.phone")}</span><input name="phone" defaultValue={String(business.phone ?? "")} /></label>
              </div>
              <div className="company-addresses">
                <fieldset>
                  <legend>{t("admin.physicalAddress")}</legend>
                  <label><span>{t("admin.addressLine1")}</span><input name="physicalLine1" defaultValue={addressValue(physicalAddress, "line1")} /></label>
                  <label><span>{t("admin.addressLine2")}</span><input name="physicalLine2" defaultValue={addressValue(physicalAddress, "line2")} /></label>
                  <div className="company-admin-grid">
                    <label><span>{t("admin.postalCode")}</span><input name="physicalPostalCode" defaultValue={addressValue(physicalAddress, "postalCode")} /></label>
                    <label><span>{t("admin.city")}</span><input name="physicalCity" defaultValue={addressValue(physicalAddress, "city")} /></label>
                    <label><span>{t("admin.countryCode")}</span><input name="physicalCountryCode" maxLength={2} defaultValue={addressValue(physicalAddress, "countryCode") || bootstrap.market.countryCode} /></label>
                  </div>
                </fieldset>
                <fieldset>
                  <legend>{t("admin.returnAddress")}</legend>
                  <label><span>{t("admin.addressLine1")}</span><input name="returnLine1" defaultValue={addressValue(returnAddress, "line1")} /></label>
                  <label><span>{t("admin.addressLine2")}</span><input name="returnLine2" defaultValue={addressValue(returnAddress, "line2")} /></label>
                  <div className="company-admin-grid">
                    <label><span>{t("admin.postalCode")}</span><input name="returnPostalCode" defaultValue={addressValue(returnAddress, "postalCode")} /></label>
                    <label><span>{t("admin.city")}</span><input name="returnCity" defaultValue={addressValue(returnAddress, "city")} /></label>
                    <label><span>{t("admin.countryCode")}</span><input name="returnCountryCode" maxLength={2} defaultValue={addressValue(returnAddress, "countryCode") || bootstrap.market.countryCode} /></label>
                  </div>
                </fieldset>
              </div>
              <label className="company-approval"><input name="approve" type="checkbox" defaultChecked={Boolean(business.approved_at)} />{t("admin.approveCompany")}</label>
              <button className="button">{t("admin.save")}</button>
            </form>
            <form className="admin-launch-control" onSubmit={(event) => {
              event.preventDefault();
              void save("launch", "launch_ready", { enabled: !launchReady });
            }}>
              <div><strong>{t("admin.launchChecks")}</strong><span>{launchCanEnable ? t("admin.launchChecksPassed") : t("admin.launchChecksBlocked")}</span></div>
              <button className="button button-primary" disabled={!launchReady && !launchCanEnable}>{launchReady ? t("admin.launchDisable") : t("admin.launchEnable")}</button>
            </form>
          </section>
        )}

        {tab === "products" && (
          <section className="admin-panel">
            <div className="admin-panel-head admin-product-head">
              <div>
                <h2>{t("admin.products")}</h2>
                <p>{t("admin.resultCount", { shown: filteredProducts.length, total: data.products.length })}</p>
              </div>
              <div className="admin-product-toolbar">
                <label className="admin-search">
                  <Search aria-hidden="true" />
                  <span className="sr-only">{t("admin.searchProducts")}</span>
                  <input type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder={String(t("admin.searchProducts"))} />
                </label>
                <label>
                  <span className="sr-only">{t("admin.status")}</span>
                  <select value={productStatus} onChange={(event) => setProductStatus(event.target.value)}>
                    <option value="all">{t("admin.allStatuses")}</option>
                    {productStatuses.map((status) => <option key={status} value={status}>{t(`admin.${status}`)}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-product-table">
                <thead>
                  <tr>
                    <th>{t("admin.sku")}</th>
                    <th>{t("admin.name")}</th>
                    <th>{t("admin.status")}</th>
                    <th>{t("admin.price")}</th>
                    <th>{t("admin.production")}</th>
                    <th><span className="sr-only">{t("admin.edit")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.flatMap((product) => {
                    const productId = String(product.id);
                    const activeTranslation = productTranslationMap.get(`${productId}:${productLocale}`) ?? {};
                    const displayTranslation = productTranslationMap.get(`${productId}:${bootstrap.locale.code}`)
                      ?? productTranslationMap.get(`${productId}:${bootstrap.settings.fallbackLocale}`)
                      ?? activeTranslation;
                    const isEditing = editingProductId === productId;
                    const rows = [
                      <tr key={productId}>
                        <td>{String(product.sku)}</td>
                        <td className="admin-product-name">{String(displayTranslation.name ?? product.sku)}</td>
                        <td>{t(`admin.${String(product.status)}`)}</td>
                        <td>{product.supplier_cost_minor == null ? "—" : String(product.supplier_cost_minor)}</td>
                        <td>{product.production_days_min == null ? "—" : `${product.production_days_min}–${product.production_days_max ?? product.production_days_min}`}</td>
                        <td><button className="button admin-edit-button" type="button" onClick={() => setEditingProductId(isEditing ? null : productId)}><Pencil aria-hidden="true" />{t("admin.edit")}</button></td>
                      </tr>,
                    ];
                    if (isEditing) rows.push(
                      <tr className="admin-product-editor-row" key={`${productId}-editor`}>
                        <td colSpan={6}>
                          <form
                            className="admin-product-editor"
                            key={`${productId}:${productLocale}`}
                            onSubmit={(event) => {
                              event.preventDefault();
                              const form = new FormData(event.currentTarget);
                              void save("productEditor", productId, {
                                status: form.get("status"),
                                categorySlug: String(form.get("categorySlug") ?? "").trim(),
                                supplierCostMinor: form.get("supplierCost") === "" ? null : Number(form.get("supplierCost")),
                                productionDaysMin: form.get("productionMin") === "" ? null : Number(form.get("productionMin")),
                                productionDaysMax: form.get("productionMax") === "" ? null : Number(form.get("productionMax")),
                                approvedImagePath: String(form.get("approvedImagePath") ?? "").trim() || null,
                                locale: productLocale,
                                name: String(form.get("name") ?? "").trim(),
                                slug: String(form.get("slug") ?? "").trim(),
                                description: String(form.get("description") ?? ""),
                                altText: String(form.get("altText") ?? ""),
                                seoTitle: String(form.get("seoTitle") ?? ""),
                                seoDescription: String(form.get("seoDescription") ?? ""),
                              }).then((saved) => { if (saved) setEditingProductId(null); });
                            }}
                          >
                            <div className="admin-product-editor-head">
                              <strong>{t("admin.productDetails")}</strong>
                              <label><span>{t("admin.locale")}</span><select value={productLocale} onChange={(event) => setProductLocale(event.target.value)}>{data.locales.map((item) => <option key={String(item.code)} value={String(item.code)}>{String(item.name)}</option>)}</select></label>
                            </div>
                            <div className="admin-product-editor-grid">
                              <label><span>{t("admin.status")}</span><select name="status" defaultValue={String(product.status)}>{productStatuses.map((status) => <option key={status} value={status}>{t(`admin.${status}`)}</option>)}</select></label>
                              <label><span>{t("admin.category")}</span><input name="categorySlug" required defaultValue={String(product.category_slug ?? "")} /></label>
                              <label><span>{t("admin.price")}</span><input name="supplierCost" type="number" min="0" step="1" defaultValue={product.supplier_cost_minor == null ? "" : Number(product.supplier_cost_minor)} /></label>
                              <label><span>{t("admin.production")}</span><div className="inline-fields"><input name="productionMin" type="number" min="0" defaultValue={product.production_days_min == null ? "" : Number(product.production_days_min)} /><input name="productionMax" type="number" min="0" defaultValue={product.production_days_max == null ? "" : Number(product.production_days_max)} /></div></label>
                              <label className="wide"><span>{t("admin.imagePath")}</span><input name="approvedImagePath" defaultValue={String(product.approved_image_path ?? "")} /></label>
                              <label><span>{t("admin.name")}</span><input name="name" required defaultValue={String(activeTranslation.name ?? "")} /></label>
                              <label><span>{t("admin.slug")}</span><input name="slug" required defaultValue={String(activeTranslation.slug ?? "")} /></label>
                              <label className="wide"><span>{t("admin.description")}</span><textarea name="description" defaultValue={String(activeTranslation.description ?? "")} /></label>
                              <label className="wide"><span>{t("admin.altText")}</span><input name="altText" defaultValue={String(activeTranslation.alt_text ?? "")} /></label>
                              <label><span>{t("admin.seoTitle")}</span><input name="seoTitle" defaultValue={String(activeTranslation.seo_title ?? "")} /></label>
                              <label><span>{t("admin.seoDescription")}</span><textarea name="seoDescription" defaultValue={String(activeTranslation.seo_description ?? "")} /></label>
                            </div>
                            <div className="admin-product-editor-actions"><button className="button" type="button" onClick={() => setEditingProductId(null)}>{t("admin.cancel")}</button><button className="button button-primary">{t("admin.save")}</button></div>
                          </form>
                        </td>
                      </tr>,
                    );
                    return rows;
                  })}
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
        </div>
      </div>
    </main>
  );
}

export function AdminConsole({
  bootstrap,
  email,
  authConfig,
}: {
  bootstrap: StoreBootstrap;
  email: string;
  authConfig: { url: string; publishableKey: string } | null;
}) {
  return (
    <StoreI18nProvider
      locale={bootstrap.locale.code}
      translations={bootstrap.translations}
    >
      <AdminConsoleInner bootstrap={bootstrap} email={email} authConfig={authConfig} />
    </StoreI18nProvider>
  );
}
