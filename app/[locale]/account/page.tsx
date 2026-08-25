import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { AccountPanel } from "@/components/store/account-panel";
import { SiteShell } from "@/components/store/site-shell";
import { getPublicStoreBootstrap } from "@/lib/store/data";

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const bootstrap = await getPublicStoreBootstrap(locale, cookieStore.get("ep_currency")?.value, cookieStore.get("ep_market")?.value);
  if (bootstrap.locale.code !== locale) notFound();
  return <SiteShell bootstrap={bootstrap}><AccountPanel /></SiteShell>;
}
