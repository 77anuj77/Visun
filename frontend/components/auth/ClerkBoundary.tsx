import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import {
  clerkEnabled,
  clerkPublishableKey,
  clerkSignInUrl,
  clerkSignUpUrl,
} from "@/lib/auth-config";

/**
 * Mounts Clerk only for the private application. The public marketing routes
 * intentionally live outside this boundary, so they build and render without a
 * publishable key and never load Clerk's client bundle.
 */
export function ClerkBoundary({ children }: { children: ReactNode }) {
  if (!clerkEnabled) return <>{children}</>;

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      signInUrl={clerkSignInUrl}
      signUpUrl={clerkSignUpUrl}
    >
      {children}
    </ClerkProvider>
  );
}
