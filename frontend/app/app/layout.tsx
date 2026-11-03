import { AppShell } from "@/components/shell/AppShell";
import { ToastProvider } from "@/components/ui";
import { AppStoreProvider } from "@/lib/store";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppStoreProvider>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </AppStoreProvider>
  );
}
