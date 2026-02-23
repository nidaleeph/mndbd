import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canCreateDraftARFOrPRF } from "@/lib/permissions";
import type { RoleSlug } from "@/lib/permissions";
import { arfSchema } from "@/schemas/arf";
import { getAdminUserIds, getMinistryMemberIds } from "@/lib/notificationRecipients";
import { createNotificationsForUserIds } from "@/services/notificationService";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = (session as { roleSlug?: RoleSlug }).roleSlug ?? "user";
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  if (!canCreateDraftARFOrPRF(roleSlug)) {
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
  const ministryId = parsed.data.ministryId;
  const wantsPending = body.status === "pending" || body.createAsDraft === false;
  const status =
    wantsPending && (roleSlug === "ministry_head" || roleSlug === "admin") ? "pending" : "draft";
  if (roleSlug === "user") {
    if (wantsPending) {
      return NextResponse.json(
        { error: "Only ministry heads can submit for approval" },
        { status: 403 }
      );
    }
    if (!ministryIds.includes(ministryId)) {
      return NextResponse.json(
        { error: "You can only create ARFs for your ministries" },
        { status: 403 }
      );
    }
  } else if (roleSlug === "ministry_head") {
    if (!ministryIds.includes(ministryId)) {
      return NextResponse.json(
        { error: "You can only create ARFs for your ministries" },
        { status: 403 }
      );
    }
  }
  const arf = await prisma.aRF.create({
    data: {
      ministryId: parsed.data.ministryId,
      eventName: parsed.data.eventName,
      requestedDate: parsed.data.requestedDate,
      what: parsed.data.what,
      when: parsed.data.when,
      where: parsed.data.where,
      why: parsed.data.why,
      justification: parsed.data.justification,
      status,
      createdById: session.userId,
      updatedAt: new Date(),
    },
    include: { ministry: { select: { name: true } } },
  });

  // Notify admin + ministry members (exclude creator)
  const [adminIds, ministryMemberIds] = await Promise.all([
    getAdminUserIds(),
    getMinistryMemberIds(arf.ministryId),
  ]);
  const recipientIds = [...new Set([...adminIds, ...ministryMemberIds])].filter(
    (uid) => uid !== session.userId
  );
  if (recipientIds.length > 0) {
    await createNotificationsForUserIds(recipientIds, {
      type: "arf_created",
      title: "New ARF created",
      body: `${arf.eventName} (${arf.ministry.name})`,
      link: `/dashboard/forms/arf/${arf.id}`,
      ministryId: arf.ministryId,
    }).catch(() => {});
  }

  return NextResponse.json(arf);
}
