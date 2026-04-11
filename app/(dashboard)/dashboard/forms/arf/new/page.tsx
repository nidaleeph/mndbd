import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { PageContainer, Card } from "@/components/ui";
import { ARFForm } from "@/features/arf/ARFForm";

export default async function NewARFPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  // Drafts are now scoped to ministry membership. User needs either admin
  // or membership in at least one ministry to create any ARF.
  if (!session.isAdmin && session.ministryIds.length === 0) {
    redirect("/dashboard/forms/arf");
  }
  // "Submit for approval" is available only to heads (or admin).
  const canApprove = session.isAdmin || session.headOfMinistryIds.length > 0;
  return (
    <PageContainer title="New Activity Request Form" description="Submit a new ARF">
      <Card>
        <ARFForm canApprove={canApprove} />
      </Card>
    </PageContainer>
  );
}
