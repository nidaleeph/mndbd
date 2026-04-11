-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistCategory" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistRun" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "startedById" TEXT,
    "closedById" TEXT,

    CONSTRAINT "ChecklistRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCheck" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "checkedById" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "labelSnapshot" TEXT NOT NULL,
    "categoryNameSnapshot" TEXT NOT NULL,

    CONSTRAINT "ItemCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_ministryId_key" ON "ChecklistTemplate"("ministryId");

-- CreateIndex
CREATE INDEX "ChecklistCategory_templateId_sortOrder_idx" ON "ChecklistCategory"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "ChecklistItem_categoryId_sortOrder_idx" ON "ChecklistItem"("categoryId", "sortOrder");

-- CreateIndex
CREATE INDEX "ChecklistRun_templateId_closedAt_idx" ON "ChecklistRun"("templateId", "closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistRun_templateId_weekStart_key" ON "ChecklistRun"("templateId", "weekStart");

-- CreateIndex
CREATE INDEX "ItemCheck_itemId_idx" ON "ItemCheck"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCheck_runId_itemId_key" ON "ItemCheck"("runId", "itemId");

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistCategory" ADD CONSTRAINT "ChecklistCategory_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ChecklistCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRun" ADD CONSTRAINT "ChecklistRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRun" ADD CONSTRAINT "ChecklistRun_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistRun" ADD CONSTRAINT "ChecklistRun_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCheck" ADD CONSTRAINT "ItemCheck_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ChecklistRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCheck" ADD CONSTRAINT "ItemCheck_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCheck" ADD CONSTRAINT "ItemCheck_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
