/**
 * GET /api/auth/google
 *
 * Redirects the user to Google's OAuth 2.0 consent page.
 * The redirect_uri must match what's configured in Google Cloud Console.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSiteEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET(request: NextRequest) {
  const env = getSiteEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: "Google login is not configured" }, { status: 404 });
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
