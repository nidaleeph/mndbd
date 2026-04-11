import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessUsers, type PermissionSession } from "@/lib/permissions";
import { PageContainer } from "@/components/ui";
import { UserEditClient } from "@/features/users/UserEditClient";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login?callbackUrl=/dashboard/users");

  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  if (!canAccessUsers(ps)) redirect("/dashboard");

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      userMinistries: {
        include: { ministry: { select: { id: true, name: true } } },
      },
    },
  });
  if (!user) notFound();

  // Ministry-head scoping: verify the editor can access this user
  if (!session.isAdmin) {
    const targetMinistryIds = new Set(user.userMinistries.map((um) => um.ministryId));
    const overlap = session.headOfMinistryIds.some((mid) => targetMinistryIds.has(mid));
    if (!overlap) redirect("/dashboard/users");
  }

  const allMinistries = await prisma.ministry.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <PageContainer title={`Edit ${user.name}`} description="Update user details">
      <UserEditClient
        initial={{
          id: user.id,
          name: user.name,
          email: user.email,
          address: user.address,
          age: user.age,
          birthday: user.birthday?.toISOString().split("T")[0] ?? null,
          isAdmin: user.isAdmin,
          status: user.status,
          ministries: user.userMinistries.map((um) => ({
            ministryId: um.ministry.id,
            ministryName: um.ministry.name,
            role: um.role,
          })),
        }}
        allMinistries={allMinistries}
        editorIsAdmin={session.isAdmin}
        editorHeadOfMinistryIds={session.headOfMinistryIds}
      />
    </PageContainer>
  );
}
