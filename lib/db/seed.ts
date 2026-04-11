/**
 * Database seed: roles, ministries, instruments, singer roles, permissions, and default admin user.
 * Run with: npm run db:seed (uses tsx lib/db/seed.ts)
 *
 * Admin user is created only if no user with that email exists.
 * Set ADMIN_EMAIL and ADMIN_PASSWORD in .env to override defaults.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = "admin@mndbd.com";
const DEFAULT_ADMIN_PASSWORD = "Admin123!";
const DEFAULT_ADMIN_NAME = "Admin";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

async function main() {
  const now = new Date();

  // --- Roles ---
  const roles = [
    { name: "Admin", slug: "admin" },
    { name: "Ministry Head", slug: "ministry_head" },
    { name: "User", slug: "user" },
  ];
  for (const r of roles) {
    await prisma.role.upsert({
      where: { slug: r.slug },
      create: r,
      update: {},
    });
  }
  console.log("Roles seeded.");

  // --- Ministries ---
  const ministries = [
    { name: "Music", description: "Worship and music ministry" },
    { name: "Parakletos", description: "Prayer ministry" },
    { name: "Youth", description: "Youth ministry" },
    { name: "Yaps", description: "Young adult professional" },
    { name: "Kaloob", description: "Dancers" },
    { name: "JSS", description: "Junior Sunday School" },
    { name: "Couples", description: "Couples ministry" },
    { name: "Kaagapay", description: "Men security and other" },
    { name: "SAM", description: "Senior Adult Ministry" },
    { name: "Multimedia", description: "Audio, video, and streaming" },
    { name: "Ushering", description: "Ushering ministry" },
    { name: "Presiding", description: "Presiding ministry" },
  ];
  for (const m of ministries) {
    const slug = slugify(m.name);
    await prisma.ministry.upsert({
      where: { slug },
      create: {
        name: m.name,
        slug,
        description: m.description,
        updatedAt: now,
      },
      update: { description: m.description, updatedAt: now },
    });
  }
  console.log("Ministries seeded.");

  // --- Instruments (no unique slug; upsert by name) ---
  const instrumentNames = [
    "Piano",
    "Synthesizer",
    "Drums",
    "Percussion",
    "Violin",
    "Saxophone",
    "Lead Guitar",
    "Rhythm Guitar",
    "Bass",
  ];
  for (const name of instrumentNames) {
    const existing = await prisma.instrument.findFirst({ where: { name } });
    if (!existing) {
      await prisma.instrument.create({ data: { name } });
    }
  }
  console.log("Instruments seeded.");

  // --- Singer roles ---
  const singerRoleNames = [
    "Main Singer",
    "Backup 1",
    "Backup 2",
    "Tenor",
    "Alto",
    "Soprano",
    "Bass",
  ];
  for (const name of singerRoleNames) {
    const existing = await prisma.singerRole.findFirst({ where: { name } });
    if (!existing) {
      await prisma.singerRole.create({ data: { name } });
    }
  }
  console.log("Singer roles seeded.");

  // --- Permissions (optional: basic CRUD for admin) ---
  const permissions = [
    { name: "Manage ministries", resource: "ministry", action: "manage" },
    { name: "Manage users", resource: "user", action: "manage" },
    { name: "Manage roles", resource: "role", action: "manage" },
    { name: "Approve ARF", resource: "arf", action: "approve" },
    { name: "Approve PRF", resource: "prf", action: "approve" },
    { name: "Approve lineup", resource: "lineup", action: "approve" },
    { name: "Manage settings", resource: "settings", action: "manage" },
  ];
  const adminRole = await prisma.role.findUnique({ where: { slug: "admin" } });
  if (adminRole) {
    for (const p of permissions) {
      const existing = await prisma.permission.findFirst({
        where: { resource: p.resource, action: p.action },
      });
      let perm = existing;
      if (!existing) {
        perm = await prisma.permission.create({
          data: { name: p.name, resource: p.resource, action: p.action },
        });
      }
      if (perm) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id },
          },
          create: { roleId: adminRole.id, permissionId: perm.id },
          update: {},
        });
      }
    }
    console.log("Permissions seeded and linked to Admin role.");
  }

  // --- Admin user ---
  const adminRoleForUser = await prisma.role.findUnique({
    where: { slug: "admin" },
  });
  if (!adminRoleForUser) {
    throw new Error("Admin role not found after seed");
  }

  const adminEmail = process.env.ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME ?? DEFAULT_ADMIN_NAME;

  const existingUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  if (existingUser) {
    console.log(`Admin user already exists: ${adminEmail}`);
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        hashedPassword,
        roleId: adminRoleForUser.id,
        updatedAt: now,
      },
    });
    console.log(`Admin user created: ${adminEmail}`);
    console.log(`  (Change password after first login or set ADMIN_PASSWORD in .env)`);
  }

  // --- Multimedia checklist starter template ---
  const multimediaMinistry = await prisma.ministry.findUnique({
    where: { slug: "multimedia" },
  });
  if (multimediaMinistry) {
    const template = await prisma.checklistTemplate.upsert({
      where: { ministryId: multimediaMinistry.id },
      create: { ministryId: multimediaMinistry.id, updatedAt: now },
      update: { updatedAt: now },
    });

    const starterCategories: Array<{ name: string; items: string[] }> = [
      {
        name: "PC1 — Full Setup",
        items: [
          "Check all PowerPoint",
          "Verify EZ Lyrics — all correct",
          "Open vMix for NDI connections",
          "Check all monitors are on",
        ],
      },
      {
        name: "PC2 — Camera & Stream",
        items: [
          "Back cam connected",
          "OBS connection established",
          "Front cam connection",
          "Gimbal connection",
        ],
      },
      {
        name: "Sound Mixer",
        items: ["Pulpit mic working", "PC1 output to mixer", "PC2 receiving audio from mixer"],
      },
    ];

    for (let c = 0; c < starterCategories.length; c++) {
      const cat = starterCategories[c];
      const existing = await prisma.checklistCategory.findFirst({
        where: { templateId: template.id, name: cat.name },
      });
      const category =
        existing ??
        (await prisma.checklistCategory.create({
          data: {
            templateId: template.id,
            name: cat.name,
            sortOrder: c,
            updatedAt: now,
          },
        }));

      for (let i = 0; i < cat.items.length; i++) {
        const label = cat.items[i];
        const existingItem = await prisma.checklistItem.findFirst({
          where: { categoryId: category.id, label },
        });
        if (!existingItem) {
          await prisma.checklistItem.create({
            data: {
              categoryId: category.id,
              label,
              sortOrder: i,
              updatedAt: now,
            },
          });
        }
      }
    }
    console.log("Multimedia checklist starter template seeded.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
