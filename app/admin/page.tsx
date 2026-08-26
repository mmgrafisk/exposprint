import { redirect } from "next/navigation";
import { AdminAuth } from "@/components/admin/admin-auth";
import { AdminConsole } from "@/components/admin/admin-console";
import { getStoreBootstrap } from "@/lib/store/data";
import { getVisitorCountry } from "@/lib/store/request";
import { getAdminAccessState } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const visitorCountry = await getVisitorCountry();
  const [access, bootstrap] = await Promise.all([
    getAdminAccessState(),
    getStoreBootstrap({ visitorCountry }),
  ]);
  if (access.state === "signed_out" || access.state === "forbidden" || access.state === "unavailable") redirect("/admin/login");
  if (access.state === "needs_mfa") return <AdminAuth bootstrap={bootstrap} phase="mfa" />;
  return <AdminConsole bootstrap={bootstrap} email={access.user.email ?? ""} />;
}
