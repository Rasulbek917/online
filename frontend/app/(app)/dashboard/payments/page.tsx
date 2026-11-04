import type { Metadata } from "next";
import { PaymentsPage } from "@/features/dashboard/payments-page";

export const metadata: Metadata = {
  title: "To'lovlar",
  robots: { index: false, follow: false },
};

export default function DashboardPaymentsPage() {
  return <PaymentsPage />;
}
