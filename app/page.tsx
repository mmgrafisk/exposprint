import { redirect } from "next/navigation";
import { getStoreBootstrap } from "@/lib/store/data";
import { getVisitorCountry } from "@/lib/store/request";

export const dynamic = "force-dynamic";

export default async function Home() {
  const bootstrap = await getStoreBootstrap({ visitorCountry: await getVisitorCountry() });
  redirect(`/${bootstrap.locale.code}`);
}
