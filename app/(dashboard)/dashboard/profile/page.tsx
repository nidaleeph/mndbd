import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { PageContainer } from "@/components/ui";
import { ProfileForm } from "@/features/profile/ProfileForm";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    redirect("/login?callbackUrl=/dashboard/profile");
  }

  return (
    <PageContainer
      title="My profile"
      description="Edit your personal details and view your roles and ministries"
    >
      <ProfileForm />
    </PageContainer>
  );
}
