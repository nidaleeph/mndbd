import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessPrayers } from "@/lib/permissions";
import { PageContainer, Card } from "@/components/ui";
import { PrayerForm } from "@/features/prayer/PrayerForm";

export default async function NewPrayerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !canAccessPrayers()) {
    return (
      <PageContainer title="Prayers">
        <p>You do not have access to this page.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="New prayer" description="Request prayer or intercession">
      <Card>
        <PrayerForm />
      </Card>
    </PageContainer>
  );
}
