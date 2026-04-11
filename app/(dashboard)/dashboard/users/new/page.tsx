import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessUsers, type PermissionSession } from "@/lib/permissions";
import { PageContainer } from "@/components/ui";
import { UserCreateClient } from "@/features/users/UserCreateClient";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login?callbackUrl=/dashboard/users/new");

  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  if (!canAccessUsers(ps)) redirect("/dashboard");
  // Only admins may create users directly.
  if (!session.isAdmin) redirect("/dashboard/users");

  const allMinistries = await prisma.ministry.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <PageContainer title="Add user" description="Create a new user">
      <UserCreateClient
        allMinistries={allMinistries}
        editorIsAdmin={session.isAdmin}
        editorHeadOfMinistryIds={session.headOfMinistryIds}
      />
    </PageContainer>
  );
}
