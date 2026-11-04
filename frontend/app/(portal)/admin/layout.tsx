import type { Metadata } from "next";
import { PortalShell } from "@/components/shared/portal-shell";
import { RequireAuth } from "@/components/shared/require-auth";

export const metadata: Metadata = {
  title: "Admin panel",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={["admin"]}>
      <PortalShell role="admin">{children}</PortalShell>
    </RequireAuth>
  );
}
