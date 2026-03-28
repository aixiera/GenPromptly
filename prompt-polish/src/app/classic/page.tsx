import ClassicAppPageClient from "../../components/ClassicAppPageClient";
import { requireAuthenticatedUser } from "../../lib/auth/server";

export default async function ClassicPage() {
  await requireAuthenticatedUser();
  return <ClassicAppPageClient />;
}
