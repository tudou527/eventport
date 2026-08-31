/**
 * GET /api/auth/me
 *
 * Returns the signed-in user's public info, or `{ user: null }`.
 * Never redirects or throws — the public site header calls this
 * client-side to detect login state without breaking static
 * prerendering of the landing and agent pages.
 */

import { NextResponse } from "next/server";

import { getUser } from "@/lib/admin";
import { getSessionCookie, verifySession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = await getSessionCookie();
    const secret = process.env.SESSION_SECRET;
    if (!token || !secret) {
      return NextResponse.json({ user: null });
    }

    const userId = await verifySession(token, secret);
    if (!userId) {
      return NextResponse.json({ user: null });
    }

    const user = await getUser(userId);
    if (!user || user.disabled) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: { email: user.email, name: user.name },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
