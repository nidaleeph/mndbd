import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import type { RoleSlug } from "@/lib/permissions";
import { canAccessUsers } from "@/lib/permissions";
import { PageContainer, Card } from "@/components/ui";
import { UserForm } from "@/features/users/UserForm";

export default async function NewUserPage() {
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  if (!canAccessUsers(roleSlug)) {
    redirect("/dashboard/users");
  }
  return (
    <PageContainer title="Add user" description="Create a new user">
      <Card>
        <UserForm />
      </Card>
    </PageContainer>
  );
}
