import type { Metadata } from "next";
import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { ClerkBoundary } from "@/components/auth/ClerkBoundary";
import { Logo } from "@/components/brand/Logo";
import { clerkEnabled } from "@/lib/auth-config";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  if (!clerkEnabled) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <div className="w-full max-w-md rounded-3xl border border-[#e0dbd2] bg-white p-8 text-center shadow-neu-md">
          <Logo href="/" />
          <h1 className="mt-6 text-[22px] font-semibold tracking-tight">
            Clerk is not configured
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Add <code className="font-mono text-[11px]">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>{" "}
            to <code className="font-mono text-[11px]">frontend/.env.local</code> to enable
            sign-in. The seeded demo workspace stays available without credentials.
          </p>
          <Link
            href="/app?demo=1"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-[#e24f00] bg-orange px-5 text-[13px] font-semibold text-ink"
          >
            Open the demo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-6 py-12">
      <Logo href="/" />
      <ClerkBoundary>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/app?demo=0"
        />
      </ClerkBoundary>
      <p className="text-center text-[11.5px] text-muted">
        Prefer to look around first?{" "}
        <Link href="/app?demo=1" className="font-medium text-ink underline underline-offset-2">
          Open the demo workspace
        </Link>
      </p>
    </main>
  );
}
