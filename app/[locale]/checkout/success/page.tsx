import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { SiteShell } from "@/components/store/site-shell";
import { getPublicStoreBootstrap } from "@/lib/store/data";
import { getVisitorCountry } from "@/lib/store/request";
import { createTranslator } from "@/lib/i18n/config";

export default async function SuccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const bootstrap = await getPublicStoreBootstrap({ routeLocale: locale, visitorCountry: await getVisitorCountry() });
  if (bootstrap.locale.code !== locale) redirect(`/${bootstrap.locale.code}/checkout/success`);
  const t = await createTranslator(bootstrap.locale.code, bootstrap.translations);
  return <SiteShell bootstrap={bootstrap}><main className="success-page"><section>
    <CheckCircle2 aria-hidden />
    <span className="eyebrow">{t("checkout.successEyebrow")}</span>
    <h1>{t("checkout.successTitle")}</h1>
    <p>{t("checkout.successBody")}</p>
    <Link className="button button-primary" href={`/${locale}`}>{t("checkout.home")}</Link>
  </section></main></SiteShell>;
}
