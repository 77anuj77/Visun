/**
 * Clerk is opt-in. Without a publishable key the app stays in the original
 * credential-free demo mode: `/app` opens directly and the API uses demo auth.
 * Setting `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` turns on the Clerk sign-in flow,
 * route protection, and bearer-token forwarding to FastAPI.
 */

export const clerkPublishableKey = (
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ""
).trim();

export const clerkEnabled = clerkPublishableKey.length > 0;

export const clerkSignInUrl = "/sign-in";
export const clerkSignUpUrl = "/sign-up";

/** Where Clerk sends a user after a successful sign-in / sign-up. */
export const clerkAfterAuthUrl = "/app?demo=0";

/** Where a CTA sends a visitor who already has a Clerk session. */
export const clerkSignedInUrl = "/app";

/** The public demo entry point. Works even when Clerk protects /app. */
export const demoEntryUrl = "/app?demo=1";

export const DEMO_COOKIE = "visun_demo";
