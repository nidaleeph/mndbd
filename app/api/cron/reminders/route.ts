import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/services/notificationService";
import { sendEmail } from "@/lib/sendgrid";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 15 * 60 * 1000); // 15 min window
  const reminders = await prisma.reminder.findMany({
    where: {
      sent: false,
      remindAt: { gte: now, lte: windowEnd },
    },
    include: { lineup: true },
  });
  for (const r of reminders) {
    if (r.userId) {
      const user = await prisma.user.findUnique({ where: { id: r.userId } });
      if (user) {
        const title = "Reminder";
        const body =
          r.lineupId && r.lineup
            ? `Upcoming: ${r.lineup.eventName} at ${r.lineup.date.toLocaleString()}`
            : "You have an upcoming event.";
        if (r.channel === "in_app" || r.channel === "email") {
          await createNotification({
            userId: r.userId,
            type: "reminder",
            title,
            body,
            link: r.lineupId ? `/dashboard/lineup/${r.lineupId}` : undefined,
          });
        }
        if (r.channel === "email" && user.email) {
          await sendEmail({
            to: user.email,
            subject: title,
            html: `<p>${body}</p>`,
          });
        }
      }
    }
    await prisma.reminder.update({
      where: { id: r.id },
      data: { sent: true },
    });
  }
  return NextResponse.json({ processed: reminders.length });
}
