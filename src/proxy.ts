import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getTenantByHostname } from "@/lib/tenant";

// Public routes that don't require authentication (Context7-style)
const publicRoutes = ["/", "/auth/signin", "/api/auth", "/api/cron"];

function isPublicPath(pathname: string): boolean {
  return publicRoutes.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

// Protected route prefixes (Context7-style)
const protectedRoutePrefixes = ["/dashboard", "/listing", "/admin"];

function isProtectedRoute(pathname: string): boolean {
  return protectedRoutePrefixes.some((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Resolve tenant from hostname and set header for downstream use
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const tenant = getTenantByHostname(host);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-id", tenant.id);
  // Ensure x-forwarded-host is set for Auth.js host detection
  requestHeaders.set("x-forwarded-host", host);
  if (!requestHeaders.get("x-forwarded-proto")) {
    requestHeaders.set("x-forwarded-proto", "https");
  }

  if (isPublicPath(pathname)) {
    // Authenticated users hitting / can be redirected to dashboard
    if (pathname === "/") {
      const session = await auth();
      if (session?.user) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const session = await auth();

  if (isProtectedRoute(pathname) && !session?.user?.id) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Match all paths except static files and images
    "/((?!_next/static|_next/image|brand/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
