/**
 * Shared TypeScript types. Re-exports the next-auth Session type so callers
 * can import it from a stable path. Permission shapes live in `lib/permissions`.
 */

import type { Session } from "next-auth";

export type { Session };
