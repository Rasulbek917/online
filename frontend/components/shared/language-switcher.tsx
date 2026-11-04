"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("gap-1.5 uppercase", className)} aria-label="Language">
          <Languages className="h-4 w-4" />
          {lang}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        <DropdownMenuItem onClick={() => setLang("uz")} className={lang === "uz" ? "bg-secondary" : ""}>
          <span className="text-base">🇺🇿</span> O&apos;zbekcha
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLang("ru")} className={lang === "ru" ? "bg-secondary" : ""}>
          <span className="text-base">🇷🇺</span> Русский
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
