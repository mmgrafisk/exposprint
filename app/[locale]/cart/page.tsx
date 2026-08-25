import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/store/site-shell";
import { CartPage } from "@/components/store/cart-page";
import { getPublicStoreBootstrap } from "@/lib/store/data";

export const dynamic = "force-dynamic";

export default async function CartRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const bootstrap = await getPublicStoreBootstrap(locale, cookieStore.get("ep_currency")?.value, cookieStore.get("ep_market")?.value);
  if (bootstrap.locale.code !== locale) notFound();
  return <SiteShell bootstrap={bootstrap}><CartPage /></SiteShell>;
}
