import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/schemas/user";
import { createNotificationsForUserIds } from "@/services/notificationService";
import { getAdminUserIds } from "@/lib/notificationRecipients";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse({
      ...body,
      confirmPassword: body.confirmPassword ?? body.password,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.errors[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) {
      return NextResponse.json({ message: "Email already registered." }, { status: 400 });
    }

    // Validate every ministry id exists
    const foundMinistries = await prisma.ministry.findMany({
      where: { id: { in: parsed.data.ministryIds } },
      select: { id: true },
    });
    if (foundMinistries.length !== parsed.data.ministryIds.length) {
      return NextResponse.json({ message: "Invalid ministry selection." }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        email: parsed.data.email,
        hashedPassword,
        isAdmin: false,
        status: "pending",
        updatedAt: new Date(),
        userMinistries: {
          create: parsed.data.ministryIds.map((mId) => ({
            ministryId: mId,
            role: "member" as const,
          })),
        },
      },
    });

    // Notify all admins
    const adminIds = await getAdminUserIds();
    if (adminIds.length > 0) {
      await createNotificationsForUserIds(adminIds, {
        type: "user_signup_pending",
        title: "New signup awaiting approval",
        body: `${user.name} has requested access`,
        link: "/dashboard/users?tab=pending",
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Register error:", e);
    return NextResponse.json({ message: "Registration failed." }, { status: 500 });
  }
}
