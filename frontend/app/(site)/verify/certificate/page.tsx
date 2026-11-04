import type { Metadata } from "next";
import { CertificateVerifyPage } from "@/features/verify/certificate-verify-page";

export const metadata: Metadata = {
  title: "Sertifikat tekshiruvi",
  description:
    "IT PARK ACADEMY sertifikatining haqiqiyligini unikal ID yoki QR kod orqali onlayn tekshiring.",
  alternates: { canonical: "/verify/certificate" },
};

export default function Page() {
  return <CertificateVerifyPage />;
}
