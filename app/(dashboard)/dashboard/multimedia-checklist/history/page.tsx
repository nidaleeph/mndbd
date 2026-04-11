import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canViewChecklistHistory, type PermissionSession } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";
import { HistoryTabs } from "@/features/checklist/HistoryTabs";

export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login?callbackUrl=/dashboard/multimedia-checklist/history");

  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return <div className="p-page">Multimedia ministry not configured.</div>;
  }
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  if (!canViewChecklistHistory(ps, multimediaMinistryId)) {
    redirect("/dashboard");
  }

  const { tab } = await searchParams;
  const active = tab === "trends" || tab === "reliability" || tab === "people" ? tab : "runs";

  return <HistoryTabs activeTab={active} />;
}
