import type { Metadata } from "next";
import { DashboardOverview } from "@/features/dashboard/dashboard-overview";

export const metadata: Metadata = {
  title: "O'quv kabineti",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <DashboardOverview />;
}
