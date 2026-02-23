import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canAccessUsers } from "@/lib/permissions";
import { PageContainer, Card } from "@/components/ui";
import { UserForm } from "@/features/users/UserForm";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] })?.ministryIds ?? [];

  if (!canAccessUsers(roleSlug)) {
    redirect("/dashboard/users");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: { ministry: true, role: true, userMinistries: { select: { ministryId: true } } },
  });
  if (!user) notFound();
  if (roleSlug === "ministry_head") {
    const userMinistryIds = [
      ...(user.ministryId ? [user.ministryId] : []),
      ...(user.userMinistries?.map((um) => um.ministryId) ?? []),
    ].filter((v, i, a) => a.indexOf(v) === i);
    const hasOverlap = userMinistryIds.some((mid) => ministryIds.includes(mid));
    if (!hasOverlap) notFound();
  }

  return (
    <PageContainer title={`Edit ${user.name}`} description="Update user details">
      <Card>
        <UserForm userId={id} />
      </Card>
    </PageContainer>
  );
}
