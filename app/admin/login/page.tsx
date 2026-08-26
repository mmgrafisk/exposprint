import { redirect } from "next/navigation";
import { AdminAuth } from "@/components/admin/admin-auth";
import { getStoreBootstrap } from "@/lib/store/data";
import { getVisitorCountry } from "@/lib/store/request";
import { getAdminAccessState } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const [bootstrap, access] = await Promise.all([
    getStoreBootstrap({ visitorCountry: await getVisitorCountry() }),
    getAdminAccessState(),
  ]);
  if (access.state === "ready") redirect("/admin");
  return <AdminAuth bootstrap={bootstrap} phase={access.state === "needs_mfa" ? "mfa" : "login"} />;
}
