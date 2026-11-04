"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, type ReactNode } from "react";
import { AppStoreProvider } from "@/lib/store";

/**
 * Waits for Clerk to hydrate, then mounts the workspace store with a stable
 * session-token getter. The proxy guarantees a signed-in session on this path,
 * but the guard stays here so a stale tab fails visibly instead of silently.
 */
export function ClerkWorkspaceProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const stableGetToken = useCallback(() => getToken(), [getToken]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <div className="rounded-2xl border border-[#e0dbd2] bg-white px-6 py-5 text-center shadow-neu-sm">
          <p className="text-[13px] font-medium text-ink">Loading your workspace…</p>
          <p className="mt-1 text-[11.5px] text-muted">Verifying your Clerk session.</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <div className="max-w-sm rounded-2xl border border-[#e0dbd2] bg-white px-6 py-5 text-center shadow-neu-sm">
          <p className="text-[13px] font-medium text-ink">This workspace needs a session</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
            Sign in to continue, or open the seeded demo workspace without an account.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link
              href="/sign-in"
              className="inline-flex h-9 items-center rounded-lg border border-[#e24f00] bg-orange px-3 text-[12px] font-semibold text-ink"
            >
              Sign in
            </Link>
            <Link
              href="/app?demo=1"
              className="inline-flex h-9 items-center rounded-lg border border-[#d9d4ca] bg-white px-3 text-[12px] font-medium text-ink"
            >
              Open demo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppStoreProvider getToken={stableGetToken} demo={false} authenticated>
      {children}
    </AppStoreProvider>
  );
}
