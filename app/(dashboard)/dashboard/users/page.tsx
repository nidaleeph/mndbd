import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canAccessUsers } from "@/lib/permissions";
import { PageContainer, Card, Button } from "@/components/ui";
import Link from "next/link";
import { FiPlus } from "react-icons/fi";
import { UsersTableClient } from "@/features/users/UsersTableClient";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] })?.ministryIds ?? [];

  if (!canAccessUsers(roleSlug)) {
    return (
      <PageContainer title="Users">
        <p>You do not have access to this page.</p>
      </PageContainer>
    );
  }

  const where =
    roleSlug === "admin"
      ? {}
      : ministryIds.length > 0
        ? {
            OR: [
              { ministryId: { in: ministryIds } },
              { userMinistries: { some: { ministryId: { in: ministryIds } } } },
            ],
          }
        : { id: "none" };
  const users = await prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    include: { ministry: true, role: true, userMinistries: { include: { ministry: true } } },
  });

  return (
    <PageContainer title="Users" description="Manage users and roles">
      <div className="mb-4 flex justify-end">
        <Link href="/dashboard/users/new">
          <Button icon={<FiPlus className="size-4" />}>Add user</Button>
        </Link>
      </div>
      <Card>
        <UsersTableClient users={users} emptyMessage="No users found." />
      </Card>
    </PageContainer>
  );
}
