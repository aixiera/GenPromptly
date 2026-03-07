import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { InviteStatus } from "@prisma/client";
import { AcceptInviteButton } from "../../components/AcceptInviteButton";
import prisma from "../../lib/db";
import { hashOpaqueToken } from "../../lib/auth/crypto";

type InvitePageProps = {
  searchParams: Promise<{ token?: string }>;
};

function getStatusLabel(status: InviteStatus, isExpired: boolean): string {
  if (isExpired) {
    return "EXPIRED";
  }
  return status;
}

export default async function InvitePage({ searchParams }: InvitePageProps) {
  const query = await searchParams;
  const token = query.token?.trim() ?? "";
  const tokenHash = hashOpaqueToken(token);
  const identity = await auth();

  if (!token) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
        <section className="panel" style={{ width: "100%", maxWidth: "680px" }}>
          <h2>Invite Not Found</h2>
          <p className="muted">Missing invite token.</p>
        </section>
      </main>
    );
  }

  const invite = await prisma.invite.findFirst({
    where: {
      OR: [{ token: tokenHash }, { token }],
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!invite) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
        <section className="panel" style={{ width: "100%", maxWidth: "680px" }}>
          <h2>Invite Not Found</h2>
          <p className="muted">This invite token is invalid.</p>
        </section>
      </main>
    );
  }

  const expired = invite.expiresAt <= new Date();
  const canAccept = invite.status === "PENDING" && !expired;
  const redirectUrl = `/invite?token=${encodeURIComponent(token)}`;

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px" }}>
      <section className="panel" style={{ width: "100%", maxWidth: "760px" }}>
        <h2>Workspace Invite</h2>
        <p className="muted" style={{ marginBottom: "12px" }}>
          Review the invite details before joining this GenPromptly workspace.
        </p>
        <table>
          <tbody>
            <tr>
              <th>Workspace</th>
              <td>{invite.org.name}</td>
            </tr>
            <tr>
              <th>Role</th>
              <td>{invite.role}</td>
            </tr>
            <tr>
              <th>Invited Email</th>
              <td>{invite.email}</td>
            </tr>
            <tr>
              <th>Status</th>
              <td>{getStatusLabel(invite.status, expired)}</td>
            </tr>
            <tr>
              <th>Expires</th>
              <td>{new Date(invite.expiresAt).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        {!canAccept ? (
          <p className="muted" style={{ marginTop: "14px" }}>
            This invite can no longer be accepted.
          </p>
        ) : identity.userId ? (
          <AcceptInviteButton token={token} />
        ) : (
          <div style={{ marginTop: "14px" }}>
            <p className="muted">Sign in with the invited email to accept this invite.</p>
            <Link
              href={`/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`}
              className="btn primary"
              style={{ textDecoration: "none" }}
            >
              Sign In to Accept
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
