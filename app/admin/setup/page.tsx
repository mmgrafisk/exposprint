import { AdminAuth } from "@/components/admin/admin-auth";
import { getStoreBootstrap } from "@/lib/store/data";
import { getVisitorCountry } from "@/lib/store/request";

export const dynamic = "force-dynamic";

export default async function AdminSetupPage() {
  const bootstrap = await getStoreBootstrap({ visitorCountry: await getVisitorCountry() });
  return <AdminAuth bootstrap={bootstrap} phase="setup" />;
}
