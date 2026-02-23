/**
 * Pusher server instance for triggering events (notifications, chat).
 * Use only on the server (API routes / server actions).
 */

import Pusher from "pusher";

const pusher =
  process.env.PUSHER_APP_ID && process.env.PUSHER_SECRET && process.env.PUSHER_CLUSTER
    ? new Pusher({
        appId: process.env.PUSHER_APP_ID,
        key: process.env.PUSHER_KEY ?? "",
        secret: process.env.PUSHER_SECRET,
        cluster: process.env.PUSHER_CLUSTER,
        useTLS: true,
      })
    : null;

export function getPusher(): Pusher | null {
  return pusher;
}

export function getPusherChannelName(type: "notifications" | "chat", id: string): string {
  return `${type}-${id}`;
}
