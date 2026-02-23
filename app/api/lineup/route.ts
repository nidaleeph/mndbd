import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canCreateLineup, type RoleSlug } from "@/lib/permissions";
import { lineupSchema } from "@/schemas/lineup";

const MUSIC_SLUG = "music";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roleSlug = ((session as { roleSlug?: string }).roleSlug ?? "user") as RoleSlug;
  const ministryIds = (session as { ministryIds?: string[] }).ministryIds ?? [];
  const musicMinistry = await prisma.ministry.findUnique({
    where: { slug: MUSIC_SLUG },
  });
  if (!musicMinistry || !canCreateLineup(roleSlug, ministryIds, musicMinistry.id)) {
    return NextResponse.json(
      { error: "Only Music ministry members can create lineups" },
      { status: 403 }
    );
  }
  const body = await request.json();
  const parsed = lineupSchema.safeParse({
    ...body,
    date: body.date ? new Date(body.date) : undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Validation failed" },
      { status: 400 }
    );
  }
  const status = parsed.data.status === "Pending Approval" ? "Pending Approval" : "Draft";
  const lineup = await prisma.lineup.create({
    data: {
      eventName: parsed.data.eventName,
      date: parsed.data.date,
      ministryId: musicMinistry.id,
      status,
      createdById: session.userId,
      updatedAt: new Date(),
    },
  });
  const joyfulSongs = (parsed.data.joyfulSongs ?? []).map((s, i) => ({
    lineupId: lineup.id,
    section: "Joyful" as const,
    title: s.title,
    youtubeLink: s.youtubeLink || null,
    order: i,
  }));
  const solemnSongs = (parsed.data.solemnSongs ?? []).map((s, i) => ({
    lineupId: lineup.id,
    section: "Solemn" as const,
    title: s.title,
    youtubeLink: s.youtubeLink || null,
    order: i,
  }));
  if (joyfulSongs.length > 0 || solemnSongs.length > 0) {
    await prisma.song.createMany({
      data: [...joyfulSongs, ...solemnSongs],
    });
  }
  return NextResponse.json(lineup);
}
