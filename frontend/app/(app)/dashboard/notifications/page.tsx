import type { Metadata } from "next";
import { NotificationsPage } from "@/features/dashboard/notifications-page";

export const metadata: Metadata = {
  title: "Bildirishnomalar",
  robots: { index: false, follow: false },
};

export default function DashboardNotificationsPage() {
  return <NotificationsPage />;
}
