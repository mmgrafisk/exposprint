import { redirect } from "next/navigation";
import { SiteShell } from "@/components/store/site-shell";
import { Storefront } from "@/components/store/storefront";
import { getPublicStoreBootstrap } from "@/lib/store/data";
import { getVisitorCountry } from "@/lib/store/request";

export const dynamic = "force-dynamic";

export default async function LocalePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const bootstrap = await getPublicStoreBootstrap({ routeLocale: locale, visitorCountry: await getVisitorCountry() });
  if (bootstrap.locale.code !== locale) redirect(`/${bootstrap.locale.code}`);
  return <SiteShell bootstrap={bootstrap}><Storefront /></SiteShell>;
}
