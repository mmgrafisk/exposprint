import { AdminAuth } from "@/components/admin/admin-auth";
import { getStoreBootstrap } from "@/lib/store/data";
import { getVisitorCountry } from "@/lib/store/request";
import { getSupabasePublicConfig } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminResetPasswordPage() {
  const bootstrap = await getStoreBootstrap({ visitorCountry: await getVisitorCountry() });
  return <AdminAuth bootstrap={bootstrap} phase="reset" authConfig={getSupabasePublicConfig()} />;
}
