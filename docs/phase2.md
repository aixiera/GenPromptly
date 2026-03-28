# Phase 2 Patterns (Auth, Tenancy, RBAC)

## Core Rules
- Every tenant-owned query must include `orgId` (directly or via tenant helper).
- Never trust client `orgId`/`orgSlug`; always verify against server-side memberships.
- Run RBAC checks server-side only.
- For cross-tenant lookups, return `404` when the resource is not in the caller org.

## Auth Context
- Use `requireAuthContext(req)` for org-scoped API routes that depend on selected org.
- Use `requireAuthContextWithoutOrg(req)` for org-slug routes (`/api/orgs/[orgSlug]/...`) and resolve membership from `ctx.memberships`.
- Use `requireAuthenticatedUser()` for endpoints that do not require org context (e.g. create/switch org).

## Route Guard Pattern
```ts
const ctx = await requireAuthContext(req);
requirePermission(ctx, "optimize_prompt");
```

For org-slug routes:
```ts
const ctx = await requireAuthContextWithoutOrg(req);
const orgMembership = ctx.memberships.find((m) => m.org.slug === orgSlug);
if (!orgMembership) return notFound;
requirePermission({ ...ctx, role: orgMembership.role }, "invite_member");
```

## Tenant Query Helpers
- Use helpers from `src/lib/tenantData.ts`:
  - `listProjects(orgId)`
  - `getProjectById(orgId, projectId)`
  - `listPromptsByProject(orgId, projectId)`
  - `getPromptById(orgId, promptId)`
  - `getPromptWithVersions(orgId, promptId)`
  - `getPromptForOptimize(orgId, promptId)`

## Invite Security
- Invite links contain an opaque token.
- Store only the SHA-256 hash at rest (`hashOpaqueToken`) and match by hash.
- Acceptance requires authenticated Clerk user with verified primary email matching invite email.
- Invites are single-use (`PENDING` -> `ACCEPTED`) with expiry enforcement.

## Audit Logging
- Use `logAuditEvent(...)` for critical actions.
- Include `orgId`, `userId`, `action`, `resourceType`, `resourceId`, and minimal metadata.
- Include request context from `getRequestAuditContext(req)` when available.

## Performance Notes
- Prefer `prisma.$transaction([...])` for related read bundles.
- Keep indexes aligned to tenant filters (e.g. `orgId + createdAt`, `orgId + email + status`).
