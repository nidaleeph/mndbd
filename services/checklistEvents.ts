/**
 * Thin wrapper around Pusher publishing for checklist events.
 *
 * Mutation handlers import these functions instead of calling getPusher() directly,
 * so the channel name and event names are single points of truth. Mirrors the
 * services/notificationService.ts pattern.
 */

import { getPusher } from "@/lib/pusher";
import { CHECKLIST_CHANNEL } from "@/lib/checklist";

export type TemplateChangedKind =
  | "category-added"
  | "category-updated"
  | "category-archived"
  | "item-added"
  | "item-updated"
  | "item-archived";

export type RunChangedKind = "started" | "closed";

export interface ItemCheckedPayload {
  itemId: string;
  checkedById: string;
  checkedByName: string;
  checkedAt: string; // ISO
}

export async function publishItemChecked(payload: ItemCheckedPayload): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  await pusher.trigger(CHECKLIST_CHANNEL, "item-checked", payload).catch(() => {});
}

export async function publishItemUnchecked(itemId: string): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  await pusher.trigger(CHECKLIST_CHANNEL, "item-unchecked", { itemId }).catch(() => {});
}

export async function publishTemplateChanged(
  kind: TemplateChangedKind,
  entityId: string
): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  await pusher.trigger(CHECKLIST_CHANNEL, "template-changed", { kind, entityId }).catch(() => {});
}

export async function publishRunChanged(kind: RunChangedKind, runId: string): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  await pusher.trigger(CHECKLIST_CHANNEL, "run-changed", { kind, runId }).catch(() => {});
}
