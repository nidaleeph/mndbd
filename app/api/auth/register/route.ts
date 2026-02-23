import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/schemas/user";

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
    // Prevent public signup as admin - only admins can create admin users
    const adminRole = await prisma.role.findUnique({ where: { slug: "admin" } });
    if (adminRole && parsed.data.roleId === adminRole.id) {
      return NextResponse.json({ message: "Invalid role." }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) {
      return NextResponse.json({ message: "Email already registered." }, { status: 400 });
    }
    const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        hashedPassword,
        roleId: parsed.data.roleId,
        ministryId: parsed.data.ministryId ?? null,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Register error:", e);
    return NextResponse.json({ message: "Registration failed." }, { status: 500 });
  }
}
