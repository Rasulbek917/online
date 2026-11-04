"use client";

import Link from "next/link";
import { ArrowUpRight, Instagram, Mail, Phone, Send, Youtube } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { usePublicSettings } from "@/lib/queries";
import { Logo } from "./logo";

export function SiteFooter() {
  const { t } = useI18n();
  const settings = usePublicSettings();
  const data = settings.data;
  const year = new Date().getFullYear();

  const socials = [
    { href: data?.telegram_url || "https://t.me/itparkacademy", icon: Send, label: "Telegram" },
    { href: data?.instagram_url || "https://instagram.com/itparkacademy", icon: Instagram, label: "Instagram" },
    { href: data?.youtube_url || "https://youtube.com/@itparkacademy", icon: Youtube, label: "YouTube" },
  ];

  return (
    <footer className="mt-20 border-t border-border/70 bg-card/40">
      <div className="container py-12 lg:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("footer.tagline")}</p>
            <div className="mt-5 flex items-center gap-2">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background/50 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("footer.platform")}
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link href="/courses" className="text-muted-foreground transition-colors hover:text-foreground">{t("nav.courses")}</Link></li>
              <li><Link href="/categories" className="text-muted-foreground transition-colors hover:text-foreground">{t("nav.categories")}</Link></li>
              <li><Link href="/verify/certificate" className="text-muted-foreground transition-colors hover:text-foreground">{t("nav.certificate")}</Link></li>
              <li><Link href="/register" className="text-muted-foreground transition-colors hover:text-foreground">{t("nav.register")}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("footer.company")}
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li><Link href="/about" className="text-muted-foreground transition-colors hover:text-foreground">{t("footer.about")}</Link></li>
              <li><Link href="/legal/privacy" className="text-muted-foreground transition-colors hover:text-foreground">{t("footer.privacy")}</Link></li>
              <li><Link href="/legal/terms" className="text-muted-foreground transition-colors hover:text-foreground">{t("footer.terms")}</Link></li>
              <li><Link href="/login" className="text-muted-foreground transition-colors hover:text-foreground">{t("nav.login")}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("footer.contact")}
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a
                  href={`mailto:${data?.support_email || "support@itparkacademy.uz"}`}
                  className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Mail className="h-4 w-4" />
                  {data?.support_email || "support@itparkacademy.uz"}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${(data?.support_phone || "+998712000000").replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Phone className="h-4 w-4" />
                  {data?.support_phone || "+998 71 200 00 00"}
                </a>
              </li>
              <li>
                <a
                  href={data?.telegram_url || "https://t.me/itparkacademy"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary transition-opacity hover:opacity-80"
                >
                  {t("footer.support")}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {year} IT PARK ACADEMY. {t("footer.rights")}</p>
          <div className="flex items-center gap-4">
            <Link href="/legal/privacy" className="transition-colors hover:text-foreground">{t("footer.privacy")}</Link>
            <Link href="/legal/terms" className="transition-colors hover:text-foreground">{t("footer.terms")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
