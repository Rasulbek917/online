import { AppShell } from "@/components/shared/app-shell";
import { RequireAuth } from "@/components/shared/require-auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
