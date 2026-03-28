import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "../../lib/auth/server";
import { listMembershipsForUser, updateLastActiveOrg } from "../../lib/auth/orgContext";

export default async function AppRootPage() {
  const user = await requireAuthenticatedUser();
  const memberships = await listMembershipsForUser(user.id);

  if (memberships.length === 0) {
    redirect("/app/select-org");
  }

  const preferred =
    memberships.find((entry) => entry.orgId === user.lastActiveOrgId) ??
    (memberships.length === 1 ? memberships[0] : null);

  if (!preferred) {
    redirect("/app/select-org");
  }

  if (user.lastActiveOrgId !== preferred.orgId) {
    await updateLastActiveOrg(user.id, preferred.orgId);
  }

  redirect(`/app/${encodeURIComponent(preferred.orgSlug)}/dashboard`);
}
