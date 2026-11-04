import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { DEMO_COOKIE } from "@/lib/auth-config";

const isWorkspaceRoute = createRouteMatcher(["/app(.*)"]);

const demoCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 8,
};

/**
 * Protect `/app` only when Clerk is configured. `?demo=1` sets a short-lived
 * cookie that keeps the seeded demo usable across client-side navigation;
 * `?demo=0` clears it and sends the visitor through the normal sign-in gate.
 */
const clerkProxy = clerkMiddleware(async (auth, request) => {
  const url = request.nextUrl;
  const demoParam = url.searchParams.get("demo");

  if (isWorkspaceRoute(request)) {
    if (demoParam === "0") {
      const destination = url.clone();
      destination.searchParams.delete("demo");
      const response = NextResponse.redirect(destination);
      response.cookies.delete(DEMO_COOKIE);
      return response;
    }

    if (demoParam === "1") {
      const destination = url.clone();
      destination.searchParams.delete("demo");
      const response = NextResponse.redirect(destination);
      response.cookies.set(DEMO_COOKIE, "1", demoCookieOptions);
      return response;
    }

    if (request.cookies.get(DEMO_COOKIE)?.value !== "1") {
      await auth.protect();
    }
  }

  return NextResponse.next();
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  // No publishable key means the original credential-free demo deployment.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return NextResponse.next();
  }
  return clerkProxy(request, event);
}

export const config = {
  matcher: [
    // Skip Next internals, static files, and API routes rewritten to FastAPI.
    "/((?!_next|api/backend|.*\\..*).*)",
  ],
};
