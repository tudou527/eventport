import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "eg_session";
const PROTECTED_PREFIX = "/dashboard";
const LOGIN_PATH = "/login/";

/** Returns true when the request carries a valid session cookie. */
async function hasValidSession(session: string | undefined) {
  const secret = process.env.SESSION_SECRET;
  if (!session || !secret) {
    return false;
  }
  try {
    await jwtVerify(session, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(COOKIE_NAME)?.value;

  // Already signed in: bounce away from the login page toward the console.
  if (pathname.startsWith(LOGIN_PATH) && (await hasValidSession(session))) {
    return NextResponse.redirect(new URL("/dashboard/", request.url));
  }

  if (!pathname.startsWith(PROTECTED_PREFIX)) {
    return NextResponse.next();
  }

  if (!(await hasValidSession(session))) {
    const response = NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login/:path*"],
};
