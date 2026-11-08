"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { SignOutButton, useAuth, useClerk } from "@clerk/nextjs";
import {
  clerkAfterAuthUrl,
  clerkEnabled,
  clerkSignedInUrl,
  clerkSignInUrl,
  clerkSignUpUrl,
  demoEntryUrl,
} from "@/lib/auth-config";

type CtaProps = {
  className?: string;
  children: ReactNode;
  /** Runs before the CTA leaves the page, e.g. to close the mobile menu. */
  onNavigate?: () => void;
};

type ClerkCtaProps = CtaProps & { mode: "signIn" | "signUp" };

/**
 * A real link to the hosted Clerk page that upgrades itself to Clerk's modal
 * once the client is ready.
 *
 * The anchor is deliberate: before hydration (or if clerk-js is blocked) the
 * click still navigates to `/sign-in` / `/sign-up`, so the CTA can never look
 * dead. When a session already exists Clerk refuses to render a sign-in modal
 * in single-session mode, so the CTA opens the workspace instead of no-oping.
 */
function ClerkCta({ mode, className, children, onNavigate }: ClerkCtaProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const router = useRouter();
  const href = mode === "signIn" ? clerkSignInUrl : clerkSignUpUrl;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (isLoaded && isSignedIn) {
      event.preventDefault();
      onNavigate?.();
      router.push(clerkSignedInUrl);
      return;
    }

    // Clerk has not hydrated yet, so a modal would never appear. Let the
    // anchor do its job and load the real sign-in/sign-up page.
    if (!isLoaded) {
      onNavigate?.();
      return;
    }

    event.preventDefault();
    onNavigate?.();
    try {
      if (mode === "signIn") {
        clerk.openSignIn({ fallbackRedirectUrl: clerkAfterAuthUrl });
      } else {
        clerk.openSignUp({ fallbackRedirectUrl: clerkAfterAuthUrl });
      }
    } catch {
      // Any modal failure still lands on the hosted Clerk page.
      router.push(href);
    }
  };

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}

/**
 * "Try Visun" — opens Clerk's sign-in modal when Clerk is configured. Without
 * a publishable key the product intentionally falls back to the demo workspace.
 */
export function SignInCta({ className, children, onNavigate }: CtaProps) {
  if (!clerkEnabled) {
    return (
      <Link href={demoEntryUrl} className={className} onClick={onNavigate}>
        {children}
      </Link>
    );
  }
  return (
    <ClerkCta mode="signIn" className={className} onNavigate={onNavigate}>
      {children}
    </ClerkCta>
  );
}

/** "Get started" / "Sign up" — opens Clerk's sign-up modal. */
export function SignUpCta({ className, children, onNavigate }: CtaProps) {
  if (!clerkEnabled) {
    return (
      <Link href={demoEntryUrl} className={className} onClick={onNavigate}>
        {children}
      </Link>
    );
  }
  return (
    <ClerkCta mode="signUp" className={className} onNavigate={onNavigate}>
      {children}
    </ClerkCta>
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
