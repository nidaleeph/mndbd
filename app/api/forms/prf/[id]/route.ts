import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canManageMinistry } from "@/lib/permissions";
import { prfSchema } from "@/schemas/prf";
import { getAdminUserIds, getMinistryMemberIds } from "@/lib/notificationRecipients";
import { createNotificationsForUserIds } from "@/services/notificationService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const prf = await prisma.pRF.findUnique({
    where: { id },
    include: { ministry: true },
  });
  if (!prf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  // Ministry heads must NOT see drafts (only creator and admin see drafts)
  if (prf.status === "draft" && roleSlug === "ministry_head") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Users: drafts only if creator; non-drafts only if in ministry
  if (roleSlug === "user") {
    if (prf.status === "draft" && prf.createdById !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (prf.status !== "draft" && !ministryIds.includes(prf.ministryId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  return NextResponse.json({
    ...prf,
    requestDate: prf.requestDate.toISOString(),
    amountRequested: Number(prf.amountRequested),
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  const { id } = await params;
  const existing = await prisma.pRF.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Drafts: only creator or admin can edit. Non-drafts: ministry head can edit.
  const canEditDraft =
    existing.status === "draft" &&
    (existing.createdById === session.userId || roleSlug === "admin");
  const canEditNonDraft =
    existing.status !== "draft" && canManageMinistry(roleSlug, ministryIds, existing.ministryId);
  if (!canEditDraft && !canEditNonDraft) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json();
  const parsed = prfSchema.safeParse({
    ...body,
    requestDate: body.requestDate ? new Date(body.requestDate) : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }
  if (roleSlug === "ministry_head" && parsed.data.ministryId !== existing.ministryId) {
    return NextResponse.json({ error: "Cannot change ministry" }, { status: 403 });
  }
  let statusToUse: "approved" | "rejected" | "draft" | "pending" = (parsed.data.status ??
    existing.status) as "approved" | "rejected" | "draft" | "pending";
  if (
    ["approved", "rejected"].includes(statusToUse) &&
    !canManageMinistry(roleSlug, ministryIds, existing.ministryId)
  ) {
    statusToUse = existing.status as "approved" | "rejected" | "draft" | "pending";
  }
  const prf = await prisma.pRF.update({
    where: { id },
    data: {
      ministryId: parsed.data.ministryId,
      requestDate: parsed.data.requestDate,
      amountRequested: parsed.data.amountRequested,
      purpose: parsed.data.purpose,
      justification: parsed.data.justification,
      status: statusToUse,
      updatedAt: new Date(),
    },
    include: { ministry: { select: { name: true } } },
  });

  // Notify on status change (exclude actor)
  if (statusToUse !== existing.status) {
    const [adminIds, ministryMemberIds] = await Promise.all([
      getAdminUserIds(),
      getMinistryMemberIds(prf.ministryId),
    ]);
    const recipientIds = [...new Set([...adminIds, ...ministryMemberIds])].filter(
      (uid) => uid !== session.userId
    );
    if (recipientIds.length > 0) {
      await createNotificationsForUserIds(recipientIds, {
        type: "prf_status_changed",
        title: "PRF status updated",
        body: `${existing.purpose.slice(0, 50)}${existing.purpose.length > 50 ? "…" : ""} is now ${statusToUse}`,
        link: `/dashboard/forms/prf/${id}`,
        ministryId: prf.ministryId,
      }).catch(() => {});
    }
  }

  return NextResponse.json(prf);
}

/** PATCH: Update status only (submit, approve, reject). Respects roles. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  const { id } = await params;
  const existing = await prisma.pRF.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await request.json();
  const newStatus = body.status as string | undefined;
  if (!newStatus || !["draft", "pending", "approved", "rejected"].includes(newStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  const canSubmitDraft =
    existing.status === "draft" &&
    newStatus === "pending" &&
    (existing.createdById === session.userId || roleSlug === "admin");
  const canApproveReject =
    existing.status === "pending" &&
    ["approved", "rejected"].includes(newStatus) &&
    canManageMinistry(roleSlug, ministryIds, existing.ministryId);
  if (!canSubmitDraft && !canApproveReject) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.status === "pending" && ["approved", "rejected"].includes(newStatus)) {
    await prisma.approvalHistory.create({
      data: {
        requestType: "PRF",
        prfId: id,
        action: newStatus === "approved" ? "approved" : "rejected",
        performedById: session.userId,
        comment: body.comment ?? null,
      },
    });
  }
  const prf = await prisma.pRF.update({
    where: { id },
    data: { status: newStatus, updatedAt: new Date() },
  });

  // Notify admin + ministry members on status change (exclude actor)
  const [adminIds, ministryMemberIds] = await Promise.all([
    getAdminUserIds(),
    getMinistryMemberIds(existing.ministryId),
  ]);
  const recipientIds = [...new Set([...adminIds, ...ministryMemberIds])].filter(
    (uid) => uid !== session.userId
  );
  if (recipientIds.length > 0) {
    await createNotificationsForUserIds(recipientIds, {
      type: "prf_status_changed",
      title: "PRF status updated",
      body: `${existing.purpose.slice(0, 50)}${existing.purpose.length > 50 ? "…" : ""} is now ${newStatus}`,
      link: `/dashboard/forms/prf/${id}`,
      ministryId: existing.ministryId,
    }).catch(() => {});
  }

  return NextResponse.json(prf);
}

/** DELETE: Remove PRF. Respects canManageMinistry. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  const { id } = await params;
  const existing = await prisma.pRF.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canDeleteDraft =
    existing.status === "draft" &&
    (existing.createdById === session.userId || roleSlug === "admin");
  const canDeleteNonDraft =
    existing.status !== "draft" && canManageMinistry(roleSlug, ministryIds, existing.ministryId);
  if (!canDeleteDraft && !canDeleteNonDraft) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await prisma.pRF.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
