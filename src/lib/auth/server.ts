import { Prisma, type OrganizationRole } from "@prisma/client";
import { auth, clerkClient } from "@clerk/nextjs/server";
import prisma from "../db";
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from "../api/httpError";
import { reserveOrganizationSlug } from "./organization";

type MembershipRecord = {
  id: string;
  orgId: string;
  role: OrganizationRole;
  org: {
    id: string;
    name: string;
    slug: string;
  };
};

export type AuthMembership = MembershipRecord;

export type AuthContext = {
  userId: string;
  clerkUserId: string;
  email: string;
  name: string | null;
  orgId: string;
  orgSlug: string;
  role: OrganizationRole;
  membershipId: string;
  memberships: AuthMembership[];
  actorKey: string;
};

export type AuthenticatedAppUser = {
  id: string;
  clerkUserId: string;
  email: string;
  name: string | null;
  lastActiveOrgId: string | null;
};

type ResolveAuthOptions = {
  requireOrg?: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function fallbackEmailForClerkUser(clerkUserId: string): string {
  const safeId = clerkUserId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120) || "unknown";
  return `clerk-${safeId}@local.genpromptly`;
}

function readStringClaim(claims: unknown, key: string): string | null {
  if (!claims || typeof claims !== "object") {
    return null;
  }

  const value = (claims as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readEmailFromClaims(claims: unknown): string | null {
  const directEmail =
    readStringClaim(claims, "email") ??
    readStringClaim(claims, "email_address") ??
    readStringClaim(claims, "primary_email_address");

  if (!directEmail) {
    return null;
  }

  return normalizeEmail(directEmail);
}

function readNameFromClaims(claims: unknown): string | null {
  const directName =
    readStringClaim(claims, "name") ??
    readStringClaim(claims, "full_name") ??
    readStringClaim(claims, "preferred_username");

  if (directName) {
    return directName;
  }

  const firstName = readStringClaim(claims, "first_name");
  const lastName = readStringClaim(claims, "last_name");
  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return combinedName || null;
}

function toDefaultWorkspaceName(user: { name: string | null; email: string }): string {
  const trimmedName = user.name?.trim();
  if (trimmedName) {
    return `${trimmedName}'s Workspace`;
  }

  const emailPrefix = user.email.split("@")[0]?.trim() || "Personal";
  const safePrefix = emailPrefix.replace(/[^a-zA-Z0-9]+/g, " ").trim() || "Personal";
  return `${safePrefix} Workspace`;
}

function readOrgSlugFromPath(req: Request): string | null {
  try {
    const pathname = new URL(req.url).pathname;
    const match = pathname.match(/^\/app\/([^/]+)/i);
    if (!match) {
      return null;
    }

    const slug = decodeURIComponent(match[1] ?? "").trim().toLowerCase();
    if (!slug || slug === "select-org") {
      return null;
    }

    return slug;
  } catch {
    return null;
  }
}

function readHeaderOrgId(req: Request): string | null {
  const raw = req.headers.get("x-org-id")?.trim();
  return raw || null;
}

function readHeaderOrgSlug(req: Request): string | null {
  const raw = req.headers.get("x-org-slug")?.trim().toLowerCase();
  return raw || null;
}

async function ensureAppUser(clerkUserId: string, sessionClaims?: unknown): Promise<{
  id: string;
  clerkUserId: string;
  email: string;
  name: string | null;
  lastActiveOrgId: string | null;
}> {
  const selectAppUser = {
    id: true,
    clerkUserId: true,
    email: true,
    name: true,
    lastActiveOrgId: true,
  } as const;

  const existingByClerkId = await prisma.user.findUnique({
    where: { clerkUserId },
    select: selectAppUser,
  });

  if (existingByClerkId) {
    return existingByClerkId;
  }

  const claimEmail = readEmailFromClaims(sessionClaims);
  const claimName = readNameFromClaims(sessionClaims);

  let resolvedEmail = claimEmail;
  let resolvedName = claimName;

  if (!resolvedEmail) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(clerkUserId);
      const primaryEmailId = clerkUser.primaryEmailAddressId;
      const primaryEmail = clerkUser.emailAddresses.find((entry) => entry.id === primaryEmailId);
      const fallbackEmail = clerkUser.emailAddresses[0];
      resolvedEmail = normalizeEmail(primaryEmail?.emailAddress ?? fallbackEmail?.emailAddress ?? "");

      if (!resolvedName) {
        const firstName = clerkUser.firstName?.trim() ?? "";
        const lastName = clerkUser.lastName?.trim() ?? "";
        const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();
        resolvedName = combinedName || clerkUser.username?.trim() || null;
      }
    } catch (error: unknown) {
      console.warn("Falling back to synthetic Clerk identity profile", {
        clerkUserId,
        reason: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  const email = resolvedEmail || fallbackEmailForClerkUser(clerkUserId);
  const displayName = resolvedName || null;

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
    select: selectAppUser,
  });

  if (existingByEmail) {
    return prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        clerkUserId,
        email,
        name: displayName,
      },
      select: selectAppUser,
    });
  }

  try {
    return await prisma.user.create({
      data: {
        clerkUserId,
        email,
        name: displayName,
      },
      select: selectAppUser,
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const recovered =
        (await prisma.user.findUnique({
          where: { clerkUserId },
          select: selectAppUser,
        })) ??
        (await prisma.user.findUnique({
          where: { email },
          select: selectAppUser,
        }));

      if (recovered) {
        return prisma.user.update({
          where: { id: recovered.id },
          data: {
            clerkUserId,
            email,
            name: displayName,
          },
          select: selectAppUser,
        });
      }
    }

    throw error;
  }
}

async function ensureUserHasWorkspace(user: {
  id: string;
  email: string;
  name: string | null;
  lastActiveOrgId: string | null;
}): Promise<string> {
  const existingMembership = await prisma.membership.findFirst({
    where: {
      userId: user.id,
    },
    select: {
      orgId: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existingMembership) {
    if (!user.lastActiveOrgId) {
      await prisma.user
        .update({
          where: { id: user.id },
          data: {
            lastActiveOrgId: existingMembership.orgId,
          },
        })
        .catch(() => undefined);
    }
    return existingMembership.orgId;
  }

  const workspaceName = toDefaultWorkspaceName(user);
  const slug = await reserveOrganizationSlug(workspaceName);

  const workspace = await prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: {
        userId: user.id,
      },
      select: {
        orgId: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (membership) {
      return { orgId: membership.orgId };
    }

    const organization = await tx.organization.create({
      data: {
        name: workspaceName,
        slug,
      },
      select: {
        id: true,
      },
    });

    await tx.membership.create({
      data: {
        orgId: organization.id,
        userId: user.id,
        role: "OWNER",
      },
      select: {
        id: true,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: {
        lastActiveOrgId: organization.id,
      },
      select: {
        id: true,
      },
    });

    return { orgId: organization.id };
  });

  return workspace.orgId;
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedAppUser> {
  const identity = await auth();
  if (!identity.userId) {
    throw new UnauthorizedError("Authentication required", undefined, "AUTH_REQUIRED");
  }

  const user = await ensureAppUser(identity.userId, identity.sessionClaims);
  const ensuredOrgId = await ensureUserHasWorkspace(user);
  if (user.lastActiveOrgId === ensuredOrgId) {
    return user;
  }

  return {
    ...user,
    lastActiveOrgId: ensuredOrgId,
  };
}

function chooseMembership(
  memberships: MembershipRecord[],
  requestedOrgSlug: string | null,
  requestedOrgId: string | null,
  fallbackOrgId: string | null
): MembershipRecord {
  if (memberships.length === 0) {
    throw new ForbiddenError("No organization membership found", undefined, "NO_ORG_MEMBERSHIP");
  }

  if (requestedOrgSlug) {
    const membership = memberships.find((entry) => entry.org.slug === requestedOrgSlug) ?? null;
    if (!membership) {
      console.warn("Auth org selection denied", {
        reason: "org_slug_not_accessible",
        requestedOrgSlug,
      });
      throw new NotFoundError("Organization not found", undefined, "ORG_NOT_FOUND");
    }
    return membership;
  }

  if (requestedOrgId) {
    const membership = memberships.find((entry) => entry.org.id === requestedOrgId) ?? null;
    if (!membership) {
      console.warn("Auth org selection denied", {
        reason: "org_id_not_accessible",
        requestedOrgId,
      });
      throw new NotFoundError("Organization not found", undefined, "ORG_NOT_FOUND");
    }
    return membership;
  }

  if (fallbackOrgId) {
    const membership = memberships.find((entry) => entry.org.id === fallbackOrgId) ?? null;
    if (membership) {
      return membership;
    }
  }

  if (memberships.length === 1) {
    return memberships[0];
  }

  throw new BadRequestError(
    "Organization selection is required",
    {
      code: "ORG_SELECTION_REQUIRED",
      memberships: memberships.map((entry) => ({
        orgId: entry.org.id,
        orgSlug: entry.org.slug,
        role: entry.role,
      })),
    },
    "ORG_SELECTION_REQUIRED"
  );
}

export async function resolveAuthContext(
  req: Request,
  options?: ResolveAuthOptions
): Promise<AuthContext | null> {
  const identity = await auth();
  if (!identity.userId) {
    throw new UnauthorizedError("Authentication required", undefined, "AUTH_REQUIRED");
  }

  const user = await ensureAppUser(identity.userId, identity.sessionClaims);
  const ensuredOrgId = await ensureUserHasWorkspace(user);
  const fallbackOrgId = user.lastActiveOrgId ?? ensuredOrgId;
  const memberships = await prisma.membership.findMany({
    where: {
      userId: user.id,
    },
    select: {
      id: true,
      orgId: true,
      role: true,
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (options?.requireOrg === false) {
    if (memberships.length === 0) {
      return null;
    }

    const preferredByLastOrg =
      memberships.find((entry) => entry.org.id === fallbackOrgId) ?? null;
    const membership = preferredByLastOrg ?? memberships[0];

    return {
      userId: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      name: user.name,
      orgId: membership.org.id,
      orgSlug: membership.org.slug,
      role: membership.role,
      membershipId: membership.id,
      memberships,
      actorKey: `user:${user.id}`,
    };
  }

  const membership = chooseMembership(
    memberships,
    readOrgSlugFromPath(req) ?? readHeaderOrgSlug(req),
    readHeaderOrgId(req),
    fallbackOrgId
  );

  if (fallbackOrgId !== membership.org.id) {
    await prisma.user
      .update({
        where: { id: user.id },
        data: {
          lastActiveOrgId: membership.org.id,
        },
      })
      .catch(() => undefined);
  }

  return {
    userId: user.id,
    clerkUserId: user.clerkUserId,
    email: user.email,
    name: user.name,
    orgId: membership.org.id,
    orgSlug: membership.org.slug,
    role: membership.role,
    membershipId: membership.id,
    memberships,
    actorKey: `user:${user.id}`,
  };
}

export async function requireAuthContext(req: Request): Promise<AuthContext> {
  const ctx = await resolveAuthContext(req);
  if (!ctx) {
    throw new UnauthorizedError("Authentication required", undefined, "AUTH_REQUIRED");
  }

  return ctx;
}

export async function requireAuthContextWithoutOrg(req: Request): Promise<AuthContext> {
  const ctx = await resolveAuthContext(req, { requireOrg: false });
  if (!ctx) {
    throw new UnauthorizedError("Authentication required", undefined, "AUTH_REQUIRED");
  }

  return ctx;
}

export async function tryResolveAuthContext(req: Request): Promise<AuthContext | null> {
  try {
    return await resolveAuthContext(req);
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError) {
      return null;
    }
    throw error;
  }
}

export function getOrgMembership(ctx: AuthContext, orgId: string): AuthMembership {
  const membership = ctx.memberships.find((entry) => entry.org.id === orgId) ?? null;
  if (!membership) {
    throw new ForbiddenError("Organization not accessible", { orgId }, "ORG_NOT_ACCESSIBLE");
  }

  return membership;
}

export async function resolveOrgSlug(orgSlug: string): Promise<{ id: string; slug: string; name: string } | null> {
  return prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });
}

export async function listUserOrganizations(clerkUserId: string): Promise<Array<{
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: OrganizationRole;
}>> {
  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: {
      id: true,
    },
  });

  if (!user) {
    return [];
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    select: {
      role: true,
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
    orgId: entry.org.id,
    orgSlug: entry.org.slug,
    orgName: entry.org.name,
    role: entry.role,
  }));
}
