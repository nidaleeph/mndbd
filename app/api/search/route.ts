import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!q) {
    return NextResponse.json({
      users: [],
      ministries: [],
      arfs: [],
      prfs: [],
      lineups: [],
      songs: [],
    });
  }
  const [users, ministries, arfs, prfs, lineups, songs] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 10,
      select: { id: true, name: true, email: true },
    }),
    prisma.ministry.findMany({
      where: { name: { contains: q, mode: "insensitive" }, active: true },
      take: 10,
      select: { id: true, name: true },
    }),
    prisma.aRF.findMany({
      where: { eventName: { contains: q, mode: "insensitive" } },
      take: 10,
      select: { id: true, eventName: true },
    }),
    prisma.pRF.findMany({
      where: { purpose: { contains: q, mode: "insensitive" } },
      take: 10,
      select: { id: true, purpose: true },
    }),
    prisma.lineup.findMany({
      where: { eventName: { contains: q, mode: "insensitive" } },
      take: 10,
      select: { id: true, eventName: true },
    }),
    prisma.song.findMany({
      where: { title: { contains: q, mode: "insensitive" } },
      take: 10,
      include: { lineup: { select: { id: true } } },
    }),
  ]);
  return NextResponse.json({
    users,
    ministries,
    arfs,
    prfs,
    lineups,
    songs: songs.map((s) => ({ id: s.id, title: s.title, lineupId: s.lineup.id })),
  });
}
