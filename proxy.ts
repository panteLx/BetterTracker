import { NextResponse, type NextRequest } from "next/server";

// Allowlist rather than blocklist: a page added later is protected by default
// instead of silently falling open. This is a redirect helper for signed-out
// visitors only — it checks that a session cookie is present, never that it is
// valid. Real authorization always happens server-side in the page and route
// guards. API routes are excluded from the matcher so unauthenticated calls
// keep getting a JSON error from their guard instead of an HTML redirect.
const publicRoutes = ["/login", "/register", "/no-access", "/t"];

function isPublicRoute(pathname: string) {
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Only real page loads are redirected. Next's router fetches page data as
 * `text/x-component`, and this version strips both the RSC request headers and
 * the `_rsc` query param before the proxy runs, so `Accept` is the one marker
 * left. Redirecting a data request turns a background prefetch into a real
 * navigation — a signed-out prefetch of "/" would throw the visitor onto the
 * login page mid-sign-in. Those requests still hit the page's own
 * `requireUser()`, which redirects in the way the router expects.
 */
function isDocumentRequest(request: NextRequest) {
  return (request.headers.get("accept") || "").includes("text/html");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isDocumentRequest(request) || isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const hasSessionCookie =
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");

  if (!hasSessionCookie) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
