import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { AppShell } from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/ui";
import { ClerkWorkspaceProvider } from "@/components/auth/ClerkWorkspaceProvider";
import { DEMO_COOKIE, clerkEnabled } from "@/lib/auth-config";
import { AppStoreProvider } from "@/lib/store";

/**
 * Two provider stacks share one shell:
 *
 * - Demo: the original credential-free workspace. `demo={clerkEnabled}` sends
 *   `X-Visun-Demo: 1` only when the deployment is in Clerk mode and the API has
 *   opted into `ALLOW_PUBLIC_DEMO`.
 * - Clerk: the session-token bridge feeds `Authorization: Bearer …` to FastAPI
 *   and hydrates the signed-in user's own workspace.
 *
 * A Clerk session always wins over a leftover `visun_demo` cookie: signing in
 * must never leave a visitor looking at the seeded workspace.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const signedIn = clerkEnabled ? Boolean((await auth()).userId) : false;
  const demo =
    !clerkEnabled || (!signedIn && cookieStore.get(DEMO_COOKIE)?.value === "1");

  return (
    <ToastProvider>
      {demo ? (
        <AppStoreProvider demo={clerkEnabled}>
          <AppShell>{children}</AppShell>
        </AppStoreProvider>
      ) : (
        <ClerkWorkspaceProvider>
          <AppShell>{children}</AppShell>
        </ClerkWorkspaceProvider>
      )}
    </ToastProvider>
  );
}
