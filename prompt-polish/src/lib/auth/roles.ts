import type { OrganizationRole } from "@prisma/client";

const ROLE_WEIGHT: Record<OrganizationRole, number> = {
  MEMBER: 10,
  ADMIN: 20,
  OWNER: 30,
};

export function hasRequiredRole(current: OrganizationRole, required: OrganizationRole): boolean {
  return ROLE_WEIGHT[current] >= ROLE_WEIGHT[required];
}

export function pickHigherRole(left: OrganizationRole, right: OrganizationRole): OrganizationRole {
  return ROLE_WEIGHT[left] >= ROLE_WEIGHT[right] ? left : right;
}

export function canManageMembers(role: OrganizationRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canAssignRole(actorRole: OrganizationRole, targetRole: OrganizationRole): boolean {
  if (actorRole === "OWNER") {
    return true;
  }

  if (actorRole === "ADMIN") {
    return targetRole === "MEMBER";
  }

  return false;
}

export function canManageRoleTransition(
  actorRole: OrganizationRole,
  currentTargetRole: OrganizationRole,
  nextTargetRole: OrganizationRole
): boolean {
  if (actorRole === "OWNER") {
    return true;
  }

  if (actorRole === "ADMIN") {
    return currentTargetRole !== "OWNER" && nextTargetRole === "MEMBER";
  }

  return false;
}

export function canRemoveRole(actorRole: OrganizationRole, currentTargetRole: OrganizationRole): boolean {
  if (actorRole === "OWNER") {
    return true;
  }

  if (actorRole === "ADMIN") {
    return currentTargetRole !== "OWNER";
  }

  return false;
}
