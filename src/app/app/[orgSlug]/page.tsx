import { redirect } from "next/navigation";

type OrgIndexPageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default async function OrgIndexPage({ params }: OrgIndexPageProps) {
  const { orgSlug } = await params;
  redirect(`/app/${encodeURIComponent(orgSlug)}/dashboard`);
}
