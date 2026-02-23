import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { RoleSlug } from "@/lib/permissions";
import { canAccessForms, canManageMinistry } from "@/lib/permissions";
import { PageContainer, Card, Section, Badge, Button, type BadgeVariant } from "@/components/ui";
import { FiDownload } from "react-icons/fi";
import { ApprovalHistoryTimeline } from "@/components/ApprovalHistoryTimeline";
import { FormDetailActions } from "@/features/shared/FormDetailActions";

export default async function ARFDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] })?.ministryIds ?? [];

  if (!canAccessForms(roleSlug)) {
    notFound();
  }

  const arf = await prisma.aRF.findUnique({
    where: { id },
    include: { ministry: true, createdBy: { select: { name: true } } },
  });
  if (!arf) notFound();
  const sessionUserId = (session as { userId?: string })?.userId;
  // Ministry heads must NOT see drafts
  if (arf.status === "draft" && roleSlug === "ministry_head") notFound();
  // Users: drafts only if creator; non-drafts only if in ministry
  if (roleSlug === "user") {
    if (arf.status === "draft" && arf.createdById !== sessionUserId) notFound();
    if (arf.status !== "draft" && !ministryIds.includes(arf.ministryId)) notFound();
  }

  const history = await prisma.approvalHistory.findMany({
    where: { arfId: id },
    orderBy: { createdAt: "asc" },
    include: { performedBy: { select: { name: true } } },
  });

  // Drafts: only creator or admin can edit. Non-drafts: ministry head can edit.
  const canEdit =
    (arf.status === "draft" && (arf.createdById === sessionUserId || roleSlug === "admin")) ||
    (arf.status !== "draft" && canManageMinistry(roleSlug, ministryIds, arf.ministryId));
  const canSubmitDraft =
    arf.status === "draft" && (arf.createdById === sessionUserId || roleSlug === "admin");
  const canApproveReject =
    arf.status === "pending" && canManageMinistry(roleSlug, ministryIds, arf.ministryId);
  const statusActions: Array<"submit" | "approve" | "reject"> = canSubmitDraft
    ? ["submit"]
    : canApproveReject
      ? ["approve", "reject"]
      : [];

  const badgeVariant: BadgeVariant =
    arf.status === "approved"
      ? "success"
      : arf.status === "rejected"
        ? "danger"
        : arf.status === "pending"
          ? "warning"
          : arf.status === "draft"
            ? "info"
            : "default";

  return (
    <PageContainer title={arf.eventName} description={`ARF · ${arf.ministry.name} · ${arf.status}`}>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={badgeVariant}>{arf.status}</Badge>
        <FormDetailActions
          entityType="arf"
          entityId={id}
          editHref={`/dashboard/forms/arf/${id}/edit`}
          canEdit={canEdit}
          canDelete={canEdit}
          canChangeStatus={statusActions.length > 0}
          statusActions={statusActions}
        />
        <a href={`/api/forms/arf/${id}/pdf`} download>
          <Button variant="outline" icon={<FiDownload className="size-4" />}>
            Download PDF
          </Button>
        </a>
      </div>
      <Section title="Details">
        <Card>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Ministry</dt>
              <dd>{arf.ministry.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Requested date</dt>
              <dd>{new Date(arf.requestedDate).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">What</dt>
              <dd>{arf.what}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">When</dt>
              <dd>{arf.when}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Where</dt>
              <dd>{arf.where}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Why</dt>
              <dd>{arf.why}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-[var(--color-text-muted)]">Justification</dt>
              <dd className="mt-1">{arf.justification}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Created by</dt>
              <dd>{arf.createdBy.name}</dd>
            </div>
          </dl>
        </Card>
      </Section>
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
    </PageContainer>
  );
}
