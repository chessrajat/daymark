import { NextResponse } from "next/server";
import {
  COOKIE,
  cookieOptions,
  validCredentials,
  issueToken,
} from "@/lib/auth";
// Single-user, single-process login throttle. Never trust caller-supplied IP headers.
const attempts: number[] = [];
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (
    req.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && new URL(origin).host !== req.headers.get("host"))
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const now = Date.now();
  while (attempts.length && attempts[0] < now - 60000) attempts.shift();
  if (attempts.length >= 10)
    return NextResponse.json(
      { error: "Too many attempts. Try again in one minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  attempts.push(now);
  if (Number(req.headers.get("content-length")) > 4096)
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const body = await req.json().catch(() => null);
  if (
    typeof body?.username !== "string" ||
    typeof body?.password !== "string" ||
    body.username.length > 200 ||
    body.password.length > 1000
  )
    return NextResponse.json(
      { error: "Enter your username and password." },
      { status: 400 },
    );
  try {
    if (!validCredentials(body.username, body.password))
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 },
      );
    const r = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    r.cookies.set(COOKIE, await issueToken(), cookieOptions());
    return r;
  } catch {
    return NextResponse.json(
      {
        error:
          "Authentication is not configured. Check the server environment.",
      },
      { status: 503 },
    );
  }
}
