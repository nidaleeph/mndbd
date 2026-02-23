import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth is enforced in the dashboard layout via getServerSession (Node), not here.
 * Edge middleware was not seeing the session cookie after login, causing 307 to login.
 * Matcher is empty so middleware never runs - dashboard protection is layout-only.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Next.js middleware requires request param
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
