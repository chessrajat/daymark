import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifyToken } from "@/lib/auth";
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (
    path === "/login" ||
    path === "/api/auth/login" ||
    path === "/api/auth/logout"
  )
    return NextResponse.next();
  if (await verifyToken(req.cookies.get(COOKIE)?.value)) {
    const r = NextResponse.next();
    r.headers.set("Cache-Control", "private, no-store");
    return r;
  }
  if (path.startsWith("/api/"))
    return NextResponse.json(
      { error: "Please sign in to continue." },
      { status: 401 },
    );
  const url = new URL("/login", req.url);
  url.searchParams.set("next", path + req.nextUrl.search);
  return NextResponse.redirect(url);
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
