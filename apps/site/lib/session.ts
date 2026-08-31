import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "eg_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Create a session JWT bound to a specific user.
 * The userId is embedded in the `sub` claim so downstream actions know who is logged in.
 */
export async function createSession(secret: string, userId: string): Promise<string> {
  const encoder = new TextEncoder();
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE_SECONDS} sec`)
    .sign(encoder.encode(secret));
}

/**
 * Verify a session JWT and return the userId from the `sub` claim.
 * Returns null if the token is invalid or expired.
 */
export async function verifySession(
  token: string,
  secret: string
): Promise<string | null> {
  try {
    const encoder = new TextEncoder();
    const { payload } = await jwtVerify(token, encoder.encode(secret), {
      algorithms: ["HS256"],
    });
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}
