import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { RoleSlug } from "@/lib/permissions";
import { canManageMinistry, canSeeDraftLineup } from "@/lib/permissions";
import { PageContainer, Card, Section, Badge } from "@/components/ui";
import { ApprovalHistoryTimeline } from "@/components/ApprovalHistoryTimeline";
import { FormDetailActions } from "@/features/shared/FormDetailActions";
import { LineupDetailClient } from "./LineupDetailClient";
import { LineupAssignmentsClient } from "@/features/lineup/LineupAssignmentsClient";

export default async function LineupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session as { userId?: string })?.userId ?? "";
  const userName = (session?.user as { name?: string })?.name ?? "";
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] })?.ministryIds ?? [];

  const musicMinistry = await prisma.ministry.findUnique({
    where: { slug: "music" },
  });
  if (!musicMinistry) notFound();

  const lineup = await prisma.lineup.findUnique({
    where: { id },
    include: {
      ministry: true,
      createdBy: { select: { name: true } },
      songs: { orderBy: [{ section: "asc" }, { order: "asc" }] },
      instrumentAssignments: {
        include: { instrument: true, user: { select: { id: true, name: true } } },
      },
      singerAssignments: {
        include: { singerRole: true, user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!lineup) notFound();
  if (lineup.ministryId !== musicMinistry.id) notFound();
  if (
    lineup.status === "Draft" &&
    !canSeeDraftLineup(roleSlug, lineup.createdById, lineup.ministryId, userId, ministryIds) &&
    !canManageMinistry(roleSlug, ministryIds, lineup.ministryId)
  ) {
    notFound();
  }

  const history = await prisma.approvalHistory.findMany({
    where: { lineupId: id },
    orderBy: { createdAt: "asc" },
    include: { performedBy: { select: { name: true } } },
  });

  const canEdit =
    canSeeDraftLineup(roleSlug, lineup.createdById, lineup.ministryId, userId, ministryIds) ||
    canManageMinistry(roleSlug, ministryIds, lineup.ministryId);
  const canApprove = canManageMinistry(roleSlug, ministryIds, lineup.ministryId);
  const statusActions: Array<"submit" | "approve"> =
    lineup.status === "Draft" && canEdit
      ? ["submit"]
      : lineup.status === "Pending Approval" && canApprove
        ? ["approve"]
        : [];

  const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY ?? "";
  const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "";

  return (
    <PageContainer
      title={lineup.eventName}
      description={`${lineup.ministry.name} · ${new Date(lineup.date).toLocaleDateString()} · ${lineup.status}`}
    >
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge
          variant={
            lineup.status === "Approved"
              ? "success"
              : lineup.status === "Pending Approval"
                ? "warning"
                : lineup.status === "Draft"
                  ? "info"
                  : "default"
          }
        >
          {lineup.status}
        </Badge>
        <FormDetailActions
          entityType="lineup"
          entityId={id}
          editHref={`/dashboard/lineup/${id}/edit`}
          canEdit={canEdit}
          canDelete={canEdit}
          canChangeStatus={statusActions.length > 0}
          statusActions={statusActions}
        />
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-6">
          <Section title="Details">
            <Card>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-[var(--color-text-muted)]">Ministry</dt>
                  <dd>{lineup.ministry.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--color-text-muted)]">Date</dt>
                  <dd>{new Date(lineup.date).toLocaleDateString()}</dd>
                </div>
                <div>
                  <dt className="text-sm text-[var(--color-text-muted)]">Created by</dt>
                  <dd>{lineup.createdBy.name}</dd>
                </div>
              </dl>
            </Card>
          </Section>
          <Section title="Songs">
            <Card>
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-medium text-[var(--color-text-muted)]">
                    Joyful
                  </h4>
                  <ul className="list-disc space-y-1 pl-5">
                    {lineup.songs
                      .filter((s) => s.section === "Joyful")
                      .map((s) => (
                        <li key={s.id}>
                          {s.youtubeLink ? (
                            <a
                              href={s.youtubeLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--color-primary)] hover:underline"
                            >
                              {s.title}
                            </a>
                          ) : (
                            s.title
                          )}
                        </li>
                      ))}
                    {lineup.songs.filter((s) => s.section === "Joyful").length === 0 && (
                      <li className="text-[var(--color-text-muted)]">None</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-medium text-[var(--color-text-muted)]">
                    Solemn
                  </h4>
                  <ul className="list-disc space-y-1 pl-5">
                    {lineup.songs
                      .filter((s) => s.section === "Solemn")
                      .map((s) => (
                        <li key={s.id}>
                          {s.youtubeLink ? (
                            <a
                              href={s.youtubeLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--color-primary)] hover:underline"
                            >
                              {s.title}
                            </a>
                          ) : (
                            s.title
                          )}
                        </li>
                      ))}
                    {lineup.songs.filter((s) => s.section === "Solemn").length === 0 && (
                      <li className="text-[var(--color-text-muted)]">None</li>
                    )}
                  </ul>
                </div>
              </div>
            </Card>
          </Section>
          {canEdit ? (
            <LineupAssignmentsClient
              lineupId={id}
              canEdit={canEdit}
              instrumentAssignments={lineup.instrumentAssignments}
              singerAssignments={lineup.singerAssignments}
              ministryId={lineup.ministryId}
            />
          ) : (
            <>
              <Section title="Instruments">
                <Card>
                  <ul className="space-y-2">
                    {lineup.instrumentAssignments.length === 0 ? (
                      <li className="text-[var(--color-text-muted)]">No assignments</li>
                    ) : (
                      lineup.instrumentAssignments.map((a) => (
                        <li key={a.instrumentId}>
                          <strong>{a.instrument.name}</strong>: {a.user.name}
                        </li>
                      ))
                    )}
                  </ul>
                </Card>
              </Section>
              <Section title="Singers">
                <Card>
                  <ul className="space-y-2">
                    {lineup.singerAssignments.length === 0 ? (
                      <li className="text-[var(--color-text-muted)]">No assignments</li>
                    ) : (
                      lineup.singerAssignments.map((a) => (
                        <li key={a.singerRoleId}>
                          <strong>{a.singerRole.name}</strong>: {a.user.name}
                        </li>
                      ))
                    )}
                  </ul>
                </Card>
              </Section>
            </>
          )}
          <Section title="Approval history">
            <ApprovalHistoryTimeline
              items={history.map((h) => ({
                action: h.action,
                performedByName: h.performedBy.name,
                comment: h.comment,
                createdAt: h.createdAt,
              }))}
            />
          </Section>
        </div>
        <div className="w-full shrink-0 lg:w-96">
          <LineupDetailClient
            lineupId={id}
            userId={userId}
            userName={userName}
            pusherKey={pusherKey}
            pusherCluster={pusherCluster}
          />
        </div>
      </div>
    </PageContainer>
  );
}
