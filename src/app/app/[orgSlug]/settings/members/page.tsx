import { redirect } from "next/navigation";

type MembersRedirectPageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function MembersRedirectPage({ params }: MembersRedirectPageProps) {
  const { orgSlug } = await params;
  redirect(`/app/${encodeURIComponent(orgSlug)}/team`);
}
