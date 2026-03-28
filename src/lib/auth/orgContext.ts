import type { OrganizationRole } from "@prisma/client";
import { NotFoundError } from "../api/httpError";
import prisma from "../db";
import { requireAuthenticatedUser, type AuthenticatedAppUser } from "./server";

export type UserOrganizationMembership = {
  membershipId: string;
  role: OrganizationRole;
  orgId: string;
  orgSlug: string;
  orgName: string;
  createdAt: Date;
};

export type OrgPageContext = {
  user: AuthenticatedAppUser;
  membership: UserOrganizationMembership;
  memberships: UserOrganizationMembership[];
};

export async function listMembershipsForUser(userId: string): Promise<UserOrganizationMembership[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: {
      id: true,
      role: true,
      createdAt: true,
      org: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return memberships.map((entry) => ({
    membershipId: entry.id,
    role: entry.role,
    orgId: entry.org.id,
    orgSlug: entry.org.slug,
    orgName: entry.org.name,
    createdAt: entry.createdAt,
  }));
}

export async function updateLastActiveOrg(userId: string, orgId: string): Promise<void> {
  await prisma.user
    .update({
      where: { id: userId },
      data: {
        lastActiveOrgId: orgId,
      },
    })
    .catch(() => undefined);
}

export async function requireOrgPageContext(orgSlug: string): Promise<OrgPageContext> {
  const user = await requireAuthenticatedUser();
  const memberships = await listMembershipsForUser(user.id);
  const membership = memberships.find((entry) => entry.orgSlug === orgSlug) ?? null;

  if (!membership) {
    throw new NotFoundError("Organization not found");
  }

  if (user.lastActiveOrgId !== membership.orgId) {
    await updateLastActiveOrg(user.id, membership.orgId);
  }

  return {
    user,
    membership,
    memberships,
  };
}
