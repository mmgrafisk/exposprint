import { redirect } from "next/navigation";
import { AccountPanel } from "@/components/store/account-panel";
import { SiteShell } from "@/components/store/site-shell";
import { getPublicStoreBootstrap } from "@/lib/store/data";
import { getVisitorCountry } from "@/lib/store/request";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const bootstrap = await getPublicStoreBootstrap({ routeLocale: locale, visitorCountry: await getVisitorCountry() });
  if (bootstrap.locale.code !== locale) redirect(`/${bootstrap.locale.code}/account`);
  return <SiteShell bootstrap={bootstrap}><AccountPanel /></SiteShell>;
}
