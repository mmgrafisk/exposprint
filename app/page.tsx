import { redirect } from "next/navigation";
import { getStoreBootstrap } from "@/lib/store/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const bootstrap = await getStoreBootstrap();
  redirect(`/${bootstrap.settings.defaultLocale}`);
}
