import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessForms, isMinistryMember, type PermissionSession } from "@/lib/permissions";
import { jsPDF } from "jspdf";

/**
 * GET /api/forms/arf/[id]/pdf
 * Returns a PDF of the ARF for download.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ps: PermissionSession = {
    isAdmin: session.isAdmin,
    ministryIds: session.ministryIds,
    headOfMinistryIds: session.headOfMinistryIds,
  };

  if (!canAccessForms(ps)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const arf = await prisma.aRF.findUnique({
    where: { id },
    include: { ministry: true, createdBy: { select: { name: true } } },
  });
  if (!arf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isMinistryMember(ps, arf.ministryId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = new jsPDF();
  const margin = 20;
  let y = 20;

  doc.setFontSize(18);
  doc.text("Activity Request Form (ARF)", margin, y);
  y += 12;

  doc.setFontSize(10);
  const rows: [string, string][] = [
    ["Event Name", arf.eventName],
    ["Ministry", arf.ministry.name],
    ["Requested Date", new Date(arf.requestedDate).toLocaleDateString()],
    ["Status", arf.status],
    ["What", arf.what],
    ["When", arf.when],
    ["Where", arf.where],
    ["Why", arf.why],
    ["Justification", arf.justification],
    ["Created By", arf.createdBy.name],
  ];

  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, 160);
    doc.text(lines, margin + 50, y);
    y += lines.length * 6 + 4;
  }

  const pdfBuffer = doc.output("arraybuffer");
  const filename = `ARF-${arf.eventName.replace(/[^a-zA-Z0-9]/g, "-")}-${id.slice(-8)}.pdf`;

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
