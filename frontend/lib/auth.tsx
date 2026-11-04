"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { apiRequest, refreshAccessToken, setAccessToken, setSessionExpiredHandler } from "./api";
import { useI18n } from "./i18n";
import type { Lang, Role, User } from "./types";

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  language: Lang;
  accept_terms: boolean;
}

interface AuthResponse {
  access: string;
  user: User;
  message?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isStudent: boolean;
  isTeacher: boolean;
  isAdmin: boolean;
  hasRole: (...roles: Role[]) => boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  googleLogin: (credential: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const { setLang } = useI18n();
  const { setTheme } = useTheme();

  const applyPreferences = useCallback(
    (next: User) => {
      if (next.profile?.language && !window.localStorage.getItem("ipa-lang")) setLang(next.profile.language);
      if (next.profile?.theme && next.profile.theme !== "system") setTheme(next.profile.theme);
    },
    [setLang, setTheme],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await refreshAccessToken();
      if (token) {
        try {
          const me = await apiRequest<User>("/api/auth/me/");
          if (!cancelled) {
            setUser(me);
            applyPreferences(me);
          }
        } catch {
          setAccessToken(null);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyPreferences]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      queryClient.clear();
    });
    return () => setSessionExpiredHandler(null);
  }, [queryClient]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const data = await apiRequest<AuthResponse>("/api/auth/login/", {
        method: "POST",
        auth: false,
        body: payload,
      });
      setAccessToken(data.access);
      setUser(data.user);
      applyPreferences(data.user);
      queryClient.clear();
      return data.user;
    },
    [applyPreferences, queryClient],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const data = await apiRequest<AuthResponse>("/api/auth/register/", {
        method: "POST",
        auth: false,
        body: payload,
      });
      setAccessToken(data.access);
      setUser(data.user);
      applyPreferences(data.user);
      queryClient.clear();
      return data.user;
    },
    [applyPreferences, queryClient],
  );

  const googleLogin = useCallback(
    async (credential: string) => {
      const data = await apiRequest<AuthResponse>("/api/auth/google/", {
        method: "POST",
        auth: false,
        body: { credential },
      });
      setAccessToken(data.access);
      setUser(data.user);
      applyPreferences(data.user);
      queryClient.clear();
      return data.user;
    },
    [applyPreferences, queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest("/api/auth/logout/", { method: "POST", auth: false });
    } catch {
      // The refresh cookie may already be invalid; local state still clears.
    }
    setAccessToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await apiRequest<User>("/api/auth/me/");
      setUser(me);
      return me;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isStudent: user?.role === "student",
      isTeacher: user?.role === "teacher",
      isAdmin: user?.role === "admin",
      hasRole: (...roles: Role[]) => Boolean(user && roles.includes(user.role)),
      login,
      register,
      googleLogin,
      logout,
      refreshUser,
      setUser,
    }),
    [user, loading, login, register, googleLogin, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function dashboardPathFor(role: Role | undefined) {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  return "/dashboard";
}
