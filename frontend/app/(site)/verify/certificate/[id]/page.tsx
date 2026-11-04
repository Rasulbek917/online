import type { Metadata } from "next";
import { CertificateVerifyPage } from "@/features/verify/certificate-verify-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `${id} — Sertifikat tekshiruvi`,
    description: "IT PARK ACADEMY sertifikatining haqiqiyligini onlayn tekshirish.",
    robots: { index: false, follow: true },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CertificateVerifyPage initialId={decodeURIComponent(id)} />;
}
