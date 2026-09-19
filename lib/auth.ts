import { SignJWT, jwtVerify } from "jose";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
export const COOKIE = "daymark_session";
export const TTL = 8 * 60 * 60;
function config() {
  const {
    AUTH_USERNAME: username,
    AUTH_PASSWORD: password,
    JWT_SECRET: secret,
  } = process.env;
  if (
    !username ||
    !password ||
    !secret ||
    secret.length < 32 ||
    secret.startsWith("replace-with")
  )
    throw new Error(
      "Configure AUTH_USERNAME, AUTH_PASSWORD and a random JWT_SECRET (32+ characters).",
    );
  return { username, password, secret };
}
export function validCredentials(username: string, password: string) {
  const c = config();
  const hash = (s: string) => createHash("sha256").update(s).digest();
  const userMatches = timingSafeEqual(hash(username), hash(c.username));
  const passwordMatches = timingSafeEqual(hash(password), hash(c.password));
  return userMatches && passwordMatches;
}
function version() {
  const c = config();
  return createHmac("sha256", c.secret)
    .update(JSON.stringify([c.username, c.password]))
    .digest("hex");
}
export async function issueToken() {
  const c = config();
  return new SignJWT({ version: version() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(c.username)
    .setIssuer("daymark")
    .setAudience("daymark-app")
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(new TextEncoder().encode(c.secret));
}
export async function verifyToken(token?: string) {
  if (!token) return false;
  try {
    const c = config();
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(c.secret),
      {
        algorithms: ["HS256"],
        issuer: "daymark",
        audience: "daymark-app",
        requiredClaims: ["exp", "iat", "sub"],
      },
    );
    return payload.sub === c.username && payload.version === version();
  } catch {
    return false;
  }
}
export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.AUTH_COOKIE_SECURE === "true",
  sameSite: "strict" as const,
  path: "/",
  maxAge: TTL,
});
export async function authenticated() {
  return verifyToken((await cookies()).get(COOKIE)?.value);
}
export async function authGuard(req: Request) {
  if (!(await authenticated()))
    return Response.json(
      { error: "Please sign in to continue." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (
      req.headers.get("sec-fetch-site") === "cross-site" ||
      (origin && new URL(origin).host !== req.headers.get("host"))
    )
      return Response.json({ error: "Invalid origin" }, { status: 403 });
  }
  return null;
}
