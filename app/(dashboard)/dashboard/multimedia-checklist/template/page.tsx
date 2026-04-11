import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditChecklistTemplate, type RoleSlug } from "@/lib/permissions";
import { getMultimediaMinistryId } from "@/lib/checklist";
import { TemplateEditor } from "@/features/checklist/TemplateEditor";

export const dynamic = "force-dynamic";

export default async function TemplateEditorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login?callbackUrl=/dashboard/multimedia-checklist/template");

  const multimediaMinistryId = await getMultimediaMinistryId();
  if (!multimediaMinistryId) {
    return <div className="p-page">Multimedia ministry not configured.</div>;
  }

  const roleSlug = (session.roleSlug ?? "user") as RoleSlug;
  const ministryIds = session.ministryIds ?? [];
  if (!canEditChecklistTemplate(roleSlug, ministryIds, multimediaMinistryId)) {
    redirect("/dashboard/multimedia-checklist");
  }

  const template = await prisma.checklistTemplate.findUnique({
    where: { ministryId: multimediaMinistryId },
    include: {
      categories: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: { archivedAt: null },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  if (!template) {
    return <div className="p-page">No template exists. Run the seed script.</div>;
  }

  return (
    <TemplateEditor
      initialCategories={template.categories.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        items: c.items.map((i) => ({ id: i.id, label: i.label, sortOrder: i.sortOrder })),
      }))}
    />
  );
}
