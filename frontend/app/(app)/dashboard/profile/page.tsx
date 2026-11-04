import type { Metadata } from "next";
import { ProfilePage } from "@/features/dashboard/profile-page";

export const metadata: Metadata = {
  title: "Profil",
  robots: { index: false, follow: false },
};

export default function DashboardProfilePage() {
  return <ProfilePage />;
}
