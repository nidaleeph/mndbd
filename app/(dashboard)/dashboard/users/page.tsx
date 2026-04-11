import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessUsers, type PermissionSession } from "@/lib/permissions";
import { PageContainer, Card, Button } from "@/components/ui";
import Link from "next/link";
import { FiPlus } from "react-icons/fi";
import { UsersTableClient } from "@/features/users/UsersTableClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login?callbackUrl=/dashboard/users");

  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  if (!canAccessUsers(ps)) redirect("/dashboard");

  const allMinistries = await prisma.ministry.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <PageContainer title="Users" description="Manage users and roles">
      {session.isAdmin ? (
        <div className="mb-4 flex justify-end">
          <Link href="/dashboard/users/new">
            <Button icon={<FiPlus className="size-4" />}>Add user</Button>
          </Link>
        </div>
      ) : null}
      <Card>
        <UsersTableClient viewerIsAdmin={session.isAdmin} allMinistries={allMinistries} />
      </Card>
    </PageContainer>
  );
}
