import type { OrganizationRole } from "@prisma/client";
import { ForbiddenError } from "./api/httpError";

export type Permission =
  | "manage_org"
  | "invite_member"
  | "remove_member"
  | "change_role"
  | "create_project"
  | "update_project"
  | "delete_project"
  | "view_project"
  | "create_prompt"
  | "update_prompt"
  | "delete_prompt"
  | "optimize_prompt"
  | "export_prompt"
  | "view_prompt"
  | "view_template"
  | "update_template"
  | "benchmark_template";

const ALL_PERMISSIONS: Permission[] = [
  "manage_org",
  "invite_member",
  "remove_member",
  "change_role",
  "create_project",
  "update_project",
  "delete_project",
  "view_project",
  "create_prompt",
  "update_prompt",
  "delete_prompt",
  "optimize_prompt",
  "export_prompt",
  "view_prompt",
  "view_template",
  "update_template",
  "benchmark_template",
];

const ADMIN_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (permission) => permission !== "manage_org"
);

const MEMBER_PERMISSIONS: Permission[] = [
  "create_project",
  "update_project",
  "view_project",
  "create_prompt",
  "update_prompt",
  "optimize_prompt",
  "export_prompt",
  "view_prompt",
  "view_template",
];

export const permissionMap: Record<OrganizationRole, Set<Permission>> = {
  OWNER: new Set(ALL_PERMISSIONS),
  ADMIN: new Set(ADMIN_PERMISSIONS),
  MEMBER: new Set(MEMBER_PERMISSIONS),
};

const roleRank: Record<OrganizationRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function hasPermission(role: OrganizationRole, permission: Permission): boolean {
  return permissionMap[role].has(permission);
}

export function requirePermission(
  context: { role: OrganizationRole; orgId: string; userId: string },
  permission: Permission
): void {
  if (!hasPermission(context.role, permission)) {
    console.warn("RBAC permission denied", {
      userId: context.userId,
      orgId: context.orgId,
      role: context.role,
      permission,
    });
    throw new ForbiddenError(
      "Insufficient permission for this action",
      {
        permission,
        role: context.role,
      },
      "INSUFFICIENT_PERMISSION"
    );
  }
}

export function requireRoleAtLeast(
  context: { role: OrganizationRole },
  minimumRole: OrganizationRole
): void {
  if (roleRank[context.role] < roleRank[minimumRole]) {
    throw new ForbiddenError(
      "Insufficient role for this action",
      {
        minimumRole,
        role: context.role,
      },
      "INSUFFICIENT_ROLE"
    );
  }
}
