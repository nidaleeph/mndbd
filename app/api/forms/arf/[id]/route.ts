import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { RoleSlug } from "@/lib/permissions";
import { canManageMinistry } from "@/lib/permissions";
import { arfSchema } from "@/schemas/arf";
import { getAdminUserIds, getMinistryMemberIds } from "@/lib/notificationRecipients";
import { createNotificationsForUserIds } from "@/services/notificationService";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const arf = await prisma.aRF.findUnique({
    where: { id },
    include: { ministry: true },
  });
  if (!arf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  if (arf.status === "draft") {
    if (roleSlug === "ministry_head") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (roleSlug === "user" && arf.createdById !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (roleSlug === "user" && !ministryIds.includes(arf.ministryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    ...arf,
    requestedDate: arf.requestedDate.toISOString(),
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
  const existing = await prisma.aRF.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canEditDraft = roleSlug === "admin" || existing.createdById === session.userId;
  const canEditNonDraft = canManageMinistry(roleSlug, ministryIds, existing.ministryId);
  const canEdit = existing.status === "draft" ? canEditDraft : canEditNonDraft;
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json();
  const parsed = arfSchema.safeParse({
    ...body,
    requestedDate: body.requestedDate ? new Date(body.requestedDate) : undefined,
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
  const arf = await prisma.aRF.update({
    where: { id },
    data: {
      ministryId: parsed.data.ministryId,
      eventName: parsed.data.eventName,
      requestedDate: parsed.data.requestedDate,
      what: parsed.data.what,
      when: parsed.data.when,
      where: parsed.data.where,
      why: parsed.data.why,
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
      getMinistryMemberIds(arf.ministryId),
    ]);
    const recipientIds = [...new Set([...adminIds, ...ministryMemberIds])].filter(
      (uid) => uid !== session.userId
    );
    if (recipientIds.length > 0) {
      await createNotificationsForUserIds(recipientIds, {
        type: "arf_status_changed",
        title: "ARF status updated",
        body: `${arf.eventName} is now ${statusToUse}`,
        link: `/dashboard/forms/arf/${id}`,
        ministryId: arf.ministryId,
      }).catch(() => {});
    }
  }

  return NextResponse.json(arf);
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
  const existing = await prisma.aRF.findUnique({ where: { id } });
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
  // draft->pending: submit. pending->approved/rejected: approve/reject
  if (existing.status === "pending" && ["approved", "rejected"].includes(newStatus)) {
    await prisma.approvalHistory.create({
      data: {
        requestType: "ARF",
        arfId: id,
        action: newStatus === "approved" ? "approved" : "rejected",
        performedById: session.userId,
        comment: body.comment ?? null,
      },
    });
  }
  const arf = await prisma.aRF.update({
    where: { id },
    data: { status: newStatus, updatedAt: new Date() },
    include: { ministry: { select: { name: true } } },
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
      type: "arf_status_changed",
      title: "ARF status updated",
      body: `${existing.eventName} is now ${newStatus}`,
      link: `/dashboard/forms/arf/${id}`,
      ministryId: existing.ministryId,
    }).catch(() => {});
  }

  return NextResponse.json(arf);
}

/** DELETE: Remove ARF. Respects canManageMinistry. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  const { id } = await params;
  const existing = await prisma.aRF.findUnique({ where: { id } });
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
  await prisma.aRF.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
