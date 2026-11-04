import type { Metadata } from "next";
import { PortalShell } from "@/components/shared/portal-shell";
import { RequireAuth } from "@/components/shared/require-auth";

export const metadata: Metadata = {
  title: "Ustoz paneli",
  robots: { index: false, follow: false },
};

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={["teacher"]}>
      <PortalShell role="teacher">{children}</PortalShell>
    </RequireAuth>
  );
}
