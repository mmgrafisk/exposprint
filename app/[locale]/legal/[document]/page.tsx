import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/store/site-shell";
import { getPublicStoreBootstrap } from "@/lib/store/data";

export default async function LegalPage({ params }: { params: Promise<{ locale: string; document: string }> }) {
  const { locale, document } = await params;
  const cookieStore = await cookies();
  const bootstrap = await getPublicStoreBootstrap(locale, cookieStore.get("ep_currency")?.value, cookieStore.get("ep_market")?.value);
  if (bootstrap.locale.code !== locale) notFound();
  const version = bootstrap.legalDocuments
    .filter((item) => item.documentType === document)
    .sort((a, b) => Number(b.locale === locale) - Number(a.locale === locale) || b.version - a.version)[0];
  if (!version) notFound();
  const title = bootstrap.translations[version.titleKey] ?? version.titleKey;
  return <SiteShell bootstrap={bootstrap}><main className="legal-page"><div className="shell legal-layout">
    <aside><span className="eyebrow">{bootstrap.translations["footer.legal"]}</span><strong>{bootstrap.translations["legal.version"]} {version.version}</strong><span>{version.status === "draft" ? bootstrap.translations["legal.draft"] : version.effectiveAt ?? ""}</span></aside>
    <article><h1>{title}</h1><div className="legal-body">{version.body.split("\n").map((paragraph, index) => paragraph ? <p key={index}>{paragraph}</p> : null)}</div></article>
  </div></main></SiteShell>;
}
