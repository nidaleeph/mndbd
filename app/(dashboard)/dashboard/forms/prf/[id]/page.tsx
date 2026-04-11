import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import {
  canAccessForms,
  canApproveARFOrPRF,
  isMinistryMember,
  type PermissionSession,
} from "@/lib/permissions";
import { PageContainer, Card, Section, Badge, Button } from "@/components/ui";
import { FiDownload } from "react-icons/fi";
import { ApprovalHistoryTimeline } from "@/components/ApprovalHistoryTimeline";
import { FormDetailActions } from "@/features/shared/FormDetailActions";
import { formatManilaDate } from "@/lib/dates";

export default async function PRFDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.userId) notFound();
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };

  if (!canAccessForms(ps)) notFound();

  const prf = await prisma.pRF.findUnique({
    where: { id },
    include: { ministry: true, createdBy: { select: { name: true } } },
  });
  if (!prf) notFound();
  const sessionUserId = session.userId;
  if (prf.status === "draft") {
    if (!session.isAdmin && prf.createdById !== sessionUserId) notFound();
  } else if (!isMinistryMember(ps, prf.ministryId)) {
    notFound();
  }

  const history = await prisma.approvalHistory.findMany({
    where: { prfId: id },
    orderBy: { createdAt: "asc" },
    include: { performedBy: { select: { name: true } } },
  });

  // Drafts: only creator or admin can edit. Non-drafts: ministry head can edit.
  const canEdit =
    (prf.status === "draft" && (prf.createdById === sessionUserId || session.isAdmin)) ||
    (prf.status !== "draft" && canApproveARFOrPRF(ps, prf.ministryId));
  const canSubmitDraft =
    prf.status === "draft" && (prf.createdById === sessionUserId || session.isAdmin);
  const canApproveReject = prf.status === "pending" && canApproveARFOrPRF(ps, prf.ministryId);
  const statusActions: Array<"submit" | "approve" | "reject"> = canSubmitDraft
    ? ["submit"]
    : canApproveReject
      ? ["approve", "reject"]
      : [];

  return (
    <PageContainer
      title={prf.purpose.slice(0, 60) + (prf.purpose.length > 60 ? "…" : "")}
      description={`PRF · ${prf.ministry.name} · ${prf.status}`}
    >
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge
          variant={
            prf.status === "approved"
              ? "success"
              : prf.status === "rejected"
                ? "danger"
                : prf.status === "pending"
                  ? "warning"
                  : prf.status === "draft"
                    ? "info"
                    : "default"
          }
        >
          {prf.status}
        </Badge>
        <FormDetailActions
          entityType="prf"
          entityId={id}
          editHref={`/dashboard/forms/prf/${id}/edit`}
          canEdit={canEdit}
          canDelete={canEdit}
          canChangeStatus={statusActions.length > 0}
          statusActions={statusActions}
        />
        <a href={`/api/forms/prf/${id}/pdf`} download>
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
              <dd>{prf.ministry.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Request date</dt>
              <dd>{formatManilaDate(prf.requestDate)}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Amount requested</dt>
              <dd>
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(Number(prf.amountRequested))}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-[var(--color-text-muted)]">Purpose</dt>
              <dd>{prf.purpose}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-[var(--color-text-muted)]">Justification</dt>
              <dd>{prf.justification}</dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--color-text-muted)]">Created by</dt>
              <dd>{prf.createdBy.name}</dd>
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
