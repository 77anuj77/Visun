"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SignInButton, SignOutButton, SignUpButton } from "@clerk/nextjs";
import {
  clerkAfterAuthUrl,
  clerkEnabled,
  demoEntryUrl,
} from "@/lib/auth-config";

type CtaProps = {
  className?: string;
  children: ReactNode;
};

/**
 * "Try Visun" — opens Clerk's sign-in modal when Clerk is configured. Without
 * a publishable key the product intentionally falls back to the demo workspace.
 */
export function SignInCta({ className, children }: CtaProps) {
  if (!clerkEnabled) {
    return (
      <Link href={demoEntryUrl} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <SignInButton
      mode="modal"
      fallbackRedirectUrl={clerkAfterAuthUrl}
      signUpFallbackRedirectUrl={clerkAfterAuthUrl}
    >
      <button type="button" className={className}>
        {children}
      </button>
    </SignInButton>
  );
}

/** "Get started" / "Sign up" — opens Clerk's sign-up modal. */
export function SignUpCta({ className, children }: CtaProps) {
  if (!clerkEnabled) {
    return (
      <Link href={demoEntryUrl} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <SignUpButton
      mode="modal"
      fallbackRedirectUrl={clerkAfterAuthUrl}
      signInFallbackRedirectUrl={clerkAfterAuthUrl}
    >
      <button type="button" className={className}>
        {children}
      </button>
    </SignUpButton>
  );
}

/** A plain link into the seeded demo workspace. */
export function DemoLink({ className, children }: CtaProps) {
  return (
    <Link href={demoEntryUrl} className={className}>
      {children}
    </Link>
  );
}

/**
 * Only safe inside a ClerkProvider. Rendered by the account menu when the
 * workspace is authenticated rather than running the public demo.
 */
export function ClerkSignOut({ className }: { className?: string }) {
  return (
    <SignOutButton redirectUrl="/">
      <button type="button" className={className}>
        Sign out
      </button>
    </SignOutButton>
  );
}
