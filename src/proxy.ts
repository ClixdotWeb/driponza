import { NextResponse, type NextRequest } from "next/server";

// Fast, optimistic gate: redirects visitors without a session cookie.
// Real authorisation (session validity + ADMIN role) is enforced server-side in layouts and every action.
export function proxy(req: NextRequest) {
  if (!req.cookies.get("dz_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/account/:path*"] };
