/**
 * GET /api/auth/google/callback
 *
 * Handles the OAuth callback from Google. Exchanges the authorization code
 * for tokens, fetches the user's profile, finds or creates the user in the
 * database, establishes a session, and redirects to the dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSiteEnv, isAdminEmail } from "@/lib/env";
import { sqlQuery, sqlExecute } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  verified_email?: boolean;
}

export async function GET(request: NextRequest) {
  const env = getSiteEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: "Google login is not configured" }, { status: 404 });
  }

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/login/?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/login/?error=missing_code", request.url)
    );
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`;

  // Step 1: Exchange authorization code for access token.
  const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResp.ok) {
    const text = await tokenResp.text();
    console.error("Google token exchange failed:", text);
    return NextResponse.redirect(
      new URL("/login/?error=token_exchange_failed", request.url)
    );
  }

  const tokenData = (await tokenResp.json()) as GoogleTokenResponse;

  // Step 2: Fetch user profile with the access token.
  const userResp = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userResp.ok) {
    console.error("Google userinfo failed:", await userResp.text());
    return NextResponse.redirect(
      new URL("/login/?error=userinfo_failed", request.url)
    );
  }

  const userInfo = (await userResp.json()) as GoogleUserInfo;

  if (!userInfo.email) {
    return NextResponse.redirect(
      new URL("/login/?error=no_email", request.url)
    );
  }

  // Step 3: Find or create the user. Email is the account identity — an email
  // that already signed up via OTP must resolve to the same account here,
  // otherwise the INSERT below would violate eg_users.email UNIQUE.
  try {
    const normalizedEmail = userInfo.email.toLowerCase().trim();

    const rows = await sqlQuery<{
      id: string;
      disabled: number;
    }>(
      `SELECT id, disabled FROM eg_users WHERE lower(email) = ?`,
      [normalizedEmail]
    );

    let userId: string;

    if (rows.length > 0) {
      if (rows[0].disabled === 1) {
        return NextResponse.redirect(
          new URL("/login/?error=account_disabled", request.url)
        );
      }
      userId = rows[0].id;
      // Only fill in missing profile fields; provider/provider_id keep the initial signup method.
      // Account identity is determined solely by email and is not part of the lookup.
      await sqlExecute(
        `UPDATE eg_users
         SET name = COALESCE(name, ?), avatar_url = COALESCE(avatar_url, ?)
         WHERE id = ?`,
        [userInfo.name ?? null, userInfo.picture ?? null, userId]
      );
    } else {
      userId = crypto.randomUUID();
      const nowSeconds = Math.floor(Date.now() / 1000);
      const isAdmin = isAdminEmail(normalizedEmail) ? 1 : 0;
      await sqlExecute(
        `INSERT INTO eg_users (id, email, name, avatar_url, provider, provider_id, is_admin, plan, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'custom', ?)`,
        [userId, normalizedEmail, userInfo.name ?? null, userInfo.picture ?? null, "google", userInfo.id, isAdmin, nowSeconds]
      );
    }

    // Step 4: Create session and redirect to dashboard.
    const session = await createSession(env.SESSION_SECRET, userId);
    await setSessionCookie(session);
    return NextResponse.redirect(new URL("/dashboard/", request.url));
  } catch (err) {
    console.error("OAuth login error:", err);
    return NextResponse.redirect(
      new URL("/login/?error=login_failed", request.url)
    );
  }
}
