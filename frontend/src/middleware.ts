import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Lightweight fast-path gate: just checks a session cookie exists before
// rendering /admin or /portal, so logged-out visitors never see a flash of
// protected UI. The real authorization check (role + fine-grained
// permissions) happens server-side against the API on every request, both
// in the (dashboard) layout and — most importantly — on the API itself.
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("access_token") || request.cookies.has("refresh_token");

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*"],
};
