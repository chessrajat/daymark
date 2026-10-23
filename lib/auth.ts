import { SignJWT, jwtVerify } from "jose";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
export const COOKIE = "daymark_session";
export const TTL = 7 * 24 * 60 * 60;
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
    .setExpirationTime(`${TTL}s`)
    .sign(new TextEncoder().encode(c.secret));
}
export async function issueMemberToken(memberId: string, credentialVersion: string) {
  return new SignJWT({ role: "member", version: credentialVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(memberId)
    .setIssuer("daymark")
    .setAudience("daymark-app")
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .sign(new TextEncoder().encode(config().secret));
}
export async function tokenSession(token?: string): Promise<{ role: "master" } | { role: "member"; id: string; version: string } | null> {
  if (!token) return null;
  try {
    const c = config();
    const { payload } = await jwtVerify(token, new TextEncoder().encode(c.secret), {
      algorithms: ["HS256"], issuer: "daymark", audience: "daymark-app",
      requiredClaims: ["exp", "iat", "sub"],
    });
    if (payload.role === "member" && typeof payload.sub === "string" &&
      /^[0-9a-f-]{36}$/i.test(payload.sub) && typeof payload.version === "string")
      return { role: "member", id: payload.sub, version: payload.version };
    if (payload.role === undefined && payload.sub === c.username && payload.version === version())
      return { role: "master" };
  } catch { /* Invalid or expired token. */ }
  return null;
}
export async function verifyToken(token?: string) {
  return (await tokenSession(token)) !== null;
}
export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.AUTH_COOKIE_SECURE === "true",
  sameSite: "strict" as const,
  path: "/",
  maxAge: TTL,
});
export async function authenticated() {
  return (await tokenSession((await cookies()).get(COOKIE)?.value))?.role === "master";
}
export async function currentSession() {
  const claim = await tokenSession((await cookies()).get(COOKIE)?.value);
  if (!claim || claim.role === "master") return claim;
  const account = (await (await db()).query(
    "SELECT m.id,m.name,a.username FROM member_accounts a JOIN members m ON m.id=a.member_id WHERE a.member_id=$1 AND a.credential_version=$2",
    [claim.id, claim.version],
  )).rows[0];
  return account ? { role: "member" as const, id: account.id as string, name: account.name as string, username: account.username as string } : null;
}
export async function memberGuard(req: Request) {
  const session = await currentSession();
  if (!session) return { denied: Response.json({ error: "Please sign in to continue." }, { status: 401 }) };
  if (session.role !== "member") return { denied: Response.json({ error: "Member access required." }, { status: 403 }) };
  const originError = originGuard(req);
  if (originError) return { denied: originError };
  return { session };
}
export function originGuard(req: Request) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (req.headers.get("sec-fetch-site") === "cross-site" ||
      (origin && new URL(origin).host !== req.headers.get("host")))
      return Response.json({ error: "Invalid origin" }, { status: 403 });
  }
  return null;
}
export async function authGuard(req: Request) {
  if (!(await authenticated()))
    return Response.json(
      { error: "Please sign in to continue." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  return originGuard(req);
}
