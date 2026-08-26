import { notFound, redirect } from "next/navigation";
import { SiteShell } from "@/components/store/site-shell";
import { getPublicStoreBootstrap } from "@/lib/store/data";
import { getVisitorCountry } from "@/lib/store/request";
import { createTranslator } from "@/lib/i18n/config";

export default async function LegalPage({ params }: { params: Promise<{ locale: string; document: string }> }) {
  const { locale, document } = await params;
  const bootstrap = await getPublicStoreBootstrap({ routeLocale: locale, visitorCountry: await getVisitorCountry() });
  if (bootstrap.locale.code !== locale) redirect(`/${bootstrap.locale.code}/legal/${document}`);
  const version = bootstrap.legalDocuments
    .filter((item) => item.documentType === document)
    .sort((a, b) => Number(b.locale === locale) - Number(a.locale === locale) || b.version - a.version)[0];
  if (!version) notFound();
  const t = await createTranslator(bootstrap.locale.code, bootstrap.translations);
  const title = t(version.titleKey);
  return <SiteShell bootstrap={bootstrap}><main className="legal-page"><div className="shell legal-layout">
    <aside><span className="eyebrow">{t("footer.legal")}</span><strong>{t("legal.version")} {version.version}</strong><span>{version.status === "draft" ? t("legal.draft") : version.effectiveAt ?? ""}</span></aside>
    <article><h1>{title}</h1><div className="legal-body">{version.body.split("\n").map((paragraph, index) => paragraph ? <p key={index}>{paragraph}</p> : null)}</div></article>
  </div></main></SiteShell>;
}
