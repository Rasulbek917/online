import type { Metadata } from "next";
import { SettingsPage } from "@/features/dashboard/settings-page";

export const metadata: Metadata = {
  title: "Sozlamalar",
  robots: { index: false, follow: false },
};

export default function DashboardSettingsPage() {
  return <SettingsPage />;
}
