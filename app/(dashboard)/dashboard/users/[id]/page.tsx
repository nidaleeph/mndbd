import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { RoleSlug } from "@/lib/permissions";
import { canAccessUsers } from "@/lib/permissions";
import { PageContainer, Card, Section, Button } from "@/components/ui";
import { FiEdit } from "react-icons/fi";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] })?.ministryIds ?? [];

  if (!canAccessUsers(roleSlug)) notFound();
  const user = await prisma.user.findUnique({
    where: { id },
    include: { ministry: true, role: true, userMinistries: { include: { ministry: true } } },
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
              <dd>
                {[
                  ...(user.ministry ? [user.ministry.name] : []),
                  ...(user.userMinistries?.map((um) => um.ministry.name).filter(Boolean) ?? []),
                ]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .join(", ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Role</dt>
              <dd>{user.role.name}</dd>
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
