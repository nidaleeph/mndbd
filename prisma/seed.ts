/**
 * Seed script: run with `npx prisma db seed` (add "prisma": { "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts" } to package.json)
 * Or run manually: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
 *
 * Creates default Role and optionally an Admin user if none exist.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
