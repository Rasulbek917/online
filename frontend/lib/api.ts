import type { Lang } from "./types";

// An empty value means "same origin": nginx (or the Next.js rewrite) proxies
// /api and /media to Django. This keeps the HttpOnly refresh cookie same-site.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

function apiBase() {
  if (API_URL) return API_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.INTERNAL_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface RequestOptions {
  method?: Method;
  body?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
  auth?: boolean;
  lang?: Lang;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  cache?: RequestCache;
}

export class ApiError extends Error {
  status: number;
  code: string;
  detail: unknown;

  constructor(status: number, code: string, message: string, detail: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

function currentLang(): Lang {
  if (typeof window === "undefined") return "uz";
  const stored = window.localStorage.getItem("ipa-lang");
  return stored === "ru" ? "ru" : "uz";
}

function buildUrl(path: string, query?: RequestOptions["query"], lang?: Lang) {
  const url = new URL(
    path.startsWith("http")
      ? path
      : `${apiBase()}${path.startsWith("/") ? "" : "/"}${path}`,
  );
  const finalLang = lang ?? currentLang();
  if (!url.searchParams.has("lang")) url.searchParams.set("lang", finalLang);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

async function parseResponse(response: Response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return response.text();
  }
  return response.json();
}

export async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { access?: string };
      if (!data.access) return null;
      accessToken = data.access;
      return data.access;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, formData, headers = {}, auth = true, lang, query, signal, cache } = options;
  const url = buildUrl(path, query, lang);

  const execute = async (token: string | null): Promise<Response> => {
    const requestHeaders: Record<string, string> = { Accept: "application/json", ...headers };
    let payload: BodyInit | undefined;
    if (formData) {
      payload = formData;
    } else if (body !== undefined) {
      requestHeaders["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    if (auth && token) requestHeaders.Authorization = `Bearer ${token}`;
    return fetch(url, {
      method,
      headers: requestHeaders,
      body: payload,
      credentials: "include",
      signal,
      cache,
    });
  };

  let response = await execute(auth ? accessToken : null);

  if (response.status === 401 && auth) {
    const renewed = await refreshAccessToken();
    if (renewed) {
      response = await execute(renewed);
    } else {
      accessToken = null;
      onSessionExpired?.();
    }
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    const envelope = data as { error?: { code?: string; message?: string; detail?: unknown }; detail?: string };
    const message =
      envelope?.error?.message ||
      (typeof envelope?.detail === "string" ? envelope.detail : "") ||
      `So'rov muvaffaqiyatsiz tugadi (${response.status})`;
    throw new ApiError(
      response.status,
      envelope?.error?.code || "api_error",
      message,
      envelope?.error?.detail ?? envelope,
    );
  }

  return data as T;
}

export async function apiDownload(path: string, filename?: string) {
  const token = accessToken || (await refreshAccessToken());
  const response = await fetch(buildUrl(path), {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new ApiError(response.status, "download_failed", "Faylni yuklab bo'lmadi.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "download";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function mediaUrl(url: string | null | undefined) {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) {
    if (!API_URL) {
      try {
        const parsed = new URL(url);
        return `${parsed.pathname}${parsed.search}`;
      } catch {
        return url;
      }
    }
    if (typeof window !== "undefined" && API_URL.startsWith("https://") && url.startsWith("http://")) {
      return url.replace(/^http:\/\//, "https://");
    }
    return url;
  }
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}
