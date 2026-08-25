import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { SiteShell } from "@/components/store/site-shell";
import { getPublicStoreBootstrap } from "@/lib/store/data";

export default async function SuccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const bootstrap = await getPublicStoreBootstrap(locale, cookieStore.get("ep_currency")?.value, cookieStore.get("ep_market")?.value);
  if (bootstrap.locale.code !== locale) notFound();
  const t = (key: string) => bootstrap.translations[key] ?? key;
  return <SiteShell bootstrap={bootstrap}><main className="success-page"><section>
    <CheckCircle2 aria-hidden />
    <span className="eyebrow">{t("checkout.successEyebrow")}</span>
    <h1>{t("checkout.successTitle")}</h1>
    <p>{t("checkout.successBody")}</p>
    <Link className="button button-primary" href={`/${locale}`}>{t("checkout.home")}</Link>
  </section></main></SiteShell>;
}
