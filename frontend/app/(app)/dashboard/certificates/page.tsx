import type { Metadata } from "next";
import { CertificatesPage } from "@/features/dashboard/certificates-page";

export const metadata: Metadata = {
  title: "Sertifikatlarim",
  robots: { index: false, follow: false },
};

export default function DashboardCertificatesPage() {
  return <CertificatesPage />;
}
