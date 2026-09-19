import { NextResponse } from "next/server";
import { COOKIE, cookieOptions } from "@/lib/auth";
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (
    req.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && new URL(origin).host !== req.headers.get("host"))
  )
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const r = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  r.cookies.set(COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return r;
}
