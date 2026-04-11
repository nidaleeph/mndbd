import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canCreateARFOrPRF,
  canCreateDraftARFOrPRF,
  type PermissionSession,
} from "@/lib/permissions";
import { prfSchema } from "@/schemas/prf";
import { getAdminUserIds, getMinistryMemberIds } from "@/lib/notificationRecipients";
import { createNotificationsForUserIds } from "@/services/notificationService";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };
  const wantsPending = body.status === "pending" || body.createAsDraft === false;
  if (wantsPending) {
    if (!canCreateARFOrPRF(ps, parsed.data.ministryId)) {
      return NextResponse.json(
        { error: "Only ministry heads can submit for approval" },
        { status: 403 }
      );
    }
  } else {
    if (!canCreateDraftARFOrPRF(ps, parsed.data.ministryId)) {
      return NextResponse.json(
        { error: "You can only create PRFs for your ministries" },
        { status: 403 }
      );
    }
  }
  const status = wantsPending ? "pending" : "draft";
  const prf = await prisma.pRF.create({
    data: {
      ministryId: parsed.data.ministryId,
      requestDate: parsed.data.requestDate,
      amountRequested: parsed.data.amountRequested,
      purpose: parsed.data.purpose,
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
    getMinistryMemberIds(prf.ministryId),
  ]);
  const recipientIds = [...new Set([...adminIds, ...ministryMemberIds])].filter(
    (uid) => uid !== session.userId
  );
  if (recipientIds.length > 0) {
    await createNotificationsForUserIds(recipientIds, {
      type: "prf_created",
      title: "New PRF created",
      body: `${prf.purpose.slice(0, 50)}${prf.purpose.length > 50 ? "…" : ""} (${prf.ministry.name})`,
      link: `/dashboard/forms/prf/${prf.id}`,
      ministryId: prf.ministryId,
    }).catch(() => {});
  }

  return NextResponse.json(prf);
}
