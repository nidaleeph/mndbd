import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { PageContainer, Card } from "@/components/ui";
import { PRFForm } from "@/features/prf/PRFForm";

export default async function NewPRFPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  if (!session.isAdmin && session.ministryIds.length === 0) {
    redirect("/dashboard/forms/prf");
  }
  const canApprove = session.isAdmin || session.headOfMinistryIds.length > 0;
  return (
    <PageContainer title="New Purchase Request Form" description="Submit a new PRF">
      <Card>
        <PRFForm canApprove={canApprove} />
      </Card>
    </PageContainer>
  );
}
