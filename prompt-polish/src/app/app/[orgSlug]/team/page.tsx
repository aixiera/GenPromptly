import prisma from "../../../../lib/db";
import { TeamManagementPanel } from "../../../../components/TeamManagementPanel";
import { requireOrgPageContext } from "../../../../lib/auth/orgContext";
import { hasPermission, requirePermission } from "../../../../lib/rbac";

type TeamPageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function TeamPage({ params }: TeamPageProps) {
  const { orgSlug } = await params;
  const context = await requireOrgPageContext(orgSlug);
  requirePermission(
    {
      role: context.membership.role,
      orgId: context.membership.orgId,
      userId: context.user.id,
    },
    "view_project"
  );

  const [members, invites] = await Promise.all([
    prisma.membership.findMany({
      where: {
        orgId: context.membership.orgId,
      },
      orderBy: [{ role: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.invite.findMany({
      where: {
        orgId: context.membership.orgId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
      },
      take: 120,
    }),
  ]);

  return (
    <TeamManagementPanel
      orgSlug={context.membership.orgSlug}
      currentUserId={context.user.id}
      currentRole={context.membership.role}
      members={members.map((member) => ({
        ...member,
        createdAt: member.createdAt.toISOString(),
      }))}
      invites={invites.map((invite) => ({
        ...invite,
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt.toISOString(),
        acceptedAt: invite.acceptedAt?.toISOString() ?? null,
        revokedAt: invite.revokedAt?.toISOString() ?? null,
      }))}
      canInvite={hasPermission(context.membership.role, "invite_member")}
      canChangeRole={hasPermission(context.membership.role, "change_role")}
      canRemoveMember={hasPermission(context.membership.role, "remove_member")}
    />
  );
}
