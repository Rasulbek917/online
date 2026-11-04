import type { Metadata } from "next";
import { LeaderboardPage } from "@/features/dashboard/leaderboard-page";

export const metadata: Metadata = {
  title: "Reyting",
  robots: { index: false, follow: false },
};

export default function DashboardLeaderboardPage() {
  return <LeaderboardPage />;
}
