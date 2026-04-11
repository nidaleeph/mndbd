import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { canAccessUsers, type PermissionSession } from "@/lib/permissions";
import { PageContainer, Card, Section, Button } from "@/components/ui";
import { FiEdit } from "react-icons/fi";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login?callbackUrl=/dashboard/users");

  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  if (!canAccessUsers(ps)) notFound();

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      userMinistries: {
        include: { ministry: { select: { id: true, name: true } } },
      },
    },
  });
  if (!user) notFound();

  if (!session.isAdmin) {
    const targetMinistryIds = new Set(user.userMinistries.map((um) => um.ministryId));
    const overlap = session.headOfMinistryIds.some((mid) => targetMinistryIds.has(mid));
    if (!overlap) notFound();
  }

  const ministryLabels = user.userMinistries.map(
    (um) => `${um.ministry.name}${um.role === "head" ? " (head)" : ""}`
  );

  return (
    <PageContainer title={user.name} description={user.email}>
      <div className="mb-4 flex justify-end">
        <Link href={`/dashboard/users/${id}/edit`}>
          <Button variant="outline" icon={<FiEdit className="size-4" />}>
            Edit
          </Button>
        </Link>
      </div>
      <Section>
        <Card>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Ministries</dt>
              <dd>{ministryLabels.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Admin</dt>
              <dd>{user.isAdmin ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Status</dt>
              <dd>{user.status}</dd>
            </div>
          </dl>
        </Card>
      </Section>
    </PageContainer>
  );
}
