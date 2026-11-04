import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: string | number | null | undefined, currency = "so'm") {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return `0 ${currency}`;
  return `${new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(number).replace(/,/g, " ")} ${currency}`;
}

export function formatNumber(value: string | number | null | undefined) {
  const number = Number(value ?? 0);
  return new Intl.NumberFormat("uz-UZ").format(Number.isFinite(number) ? number : 0);
}

export function formatDate(value: string | null | undefined, _lang: "uz" | "ru" = "uz") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

export function formatDateTime(value: string | null | undefined, _lang: "uz" | "ru" = "uz") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()} ${hours}:${minutes}`;
}

export function formatDuration(seconds: number | null | undefined) {
  const total = Math.max(0, Math.round(Number(seconds ?? 0)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function initials(name: string | null | undefined) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function pluralize(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function formatRelative(value: string | null | undefined, lang: "uz" | "ru" = "uz") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return lang === "ru" ? "только что" : "hozirgina";
  if (minutes < 60) return lang === "ru" ? `${minutes} мин назад` : `${minutes} daqiqa oldin`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === "ru" ? `${hours} ч назад` : `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  if (days < 7) return lang === "ru" ? `${days} дн назад` : `${days} kun oldin`;
  return formatDate(value, lang);
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") return error;
  return fallback;
}
