-- CreateTable
CREATE TABLE "UserMinistry" (
    "userId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMinistry_pkey" PRIMARY KEY ("userId","ministryId")
);

-- Migrate existing ministryId to UserMinistry
INSERT INTO "UserMinistry" ("userId", "ministryId")
SELECT id, "ministryId" FROM "User" WHERE "ministryId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "UserMinistry" ADD CONSTRAINT "UserMinistry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMinistry" ADD CONSTRAINT "UserMinistry_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
