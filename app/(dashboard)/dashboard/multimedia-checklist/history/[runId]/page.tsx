import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewChecklistHistory, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";
import { RunDrillDown } from "@/features/checklist/RunDrillDown";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ runId: string }> };

export default async function RunDrillPage({ params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId)
    return <div className="p-page">Multimedia ministry not configured.</div>;

  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  if (!canViewChecklistHistory(roleSlug, session.ministryIds ?? [], multimediaMinistryId)) {
    redirect("/dashboard");
  }

  const { runId } = await params;

  const run = await prisma.checklistRun.findUnique({
    where: { id: runId },
    include: {
      startedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      template: {
        include: {
          categories: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
                select: {
                  id: true,
                  label: true,
                  archivedAt: true,
                  createdAt: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
      },
      checks: {
        include: { checkedBy: { select: { name: true } } },
      },
    },
  });

  if (!run || run.template.ministryId !== multimediaMinistryId) notFound();

  return (
    <RunDrillDown
      weekStart={run.weekStart.toISOString()}
      startedAt={run.startedAt.toISOString()}
      closedAt={run.closedAt?.toISOString() ?? null}
      startedBy={run.startedBy?.name ?? null}
      closedBy={run.closedBy?.name ?? null}
      categories={run.template.categories.map((cat) => {
        // For an open run: show every current item. For a closed run: show only items
        // that existed at/before the close time so post-close template additions don't
        // pollute the historical drill-down.
        const runClosedAt = run.closedAt;
        const visibleItems = cat.items.filter(
          (i) => runClosedAt === null || i.createdAt <= runClosedAt
        );
        return {
          id: cat.id,
          name: cat.name,
          items: visibleItems.map((item) => {
            const check = run.checks.find((c) => c.itemId === item.id);
            return {
              id: item.id,
              label: check?.labelSnapshot ?? item.label,
              categoryNameSnapshot: check?.categoryNameSnapshot ?? cat.name,
              checkedBy: check?.checkedBy.name ?? null,
              checkedAt: check?.checkedAt.toISOString() ?? null,
            };
          }),
        };
      })}
    />
  );
}
