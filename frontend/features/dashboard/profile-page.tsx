"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Camera,
  Check,
  KeyRound,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Unlink,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { PasswordInput } from "@/components/shared/password-input";
import { UserAvatar } from "@/components/shared/user-avatar";
import { apiRequest, mediaUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { formatDate, formatNumber, getErrorMessage } from "@/lib/utils";
import type { TelegramAccount, User } from "@/lib/types";
import { PageHeading } from "./shared";

interface ProfileForm {
  first_name: string;
  last_name: string;
  phone: string;
  headline: string;
  bio: string;
  city: string;
  country: string;
  website: string;
  telegram_username: string;
}

function formFromUser(user: User): ProfileForm {
  return {
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    phone: user.phone || "",
    headline: user.profile?.headline || "",
    bio: user.profile?.bio || "",
    city: user.profile?.city || "",
    country: user.profile?.country || "",
    website: user.profile?.website || "",
    telegram_username: user.profile?.telegram_username || "",
  };
}

export function ProfilePage() {
  const { t, lang } = useI18n();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProfileForm>(() => formFromUser(user as User));
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [formError, setFormError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (user) setForm(formFromUser(user));
  }, [user]);

  const telegram = useQuery({
    queryKey: ["telegram-account"],
    queryFn: () => apiRequest<TelegramAccount>("/api/notifications/telegram/"),
  });

  const connectTelegram = useMutation({
    mutationFn: () => apiRequest<{ deep_link: string; bot_username: string }>("/api/notifications/telegram/", { method: "POST" }),
    onSuccess: (data) => {
      if (data.deep_link) window.open(data.deep_link, "_blank", "noopener,noreferrer");
      telegram.refetch();
    },
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  const disconnectTelegram = useMutation({
    mutationFn: () => apiRequest("/api/notifications/telegram/", { method: "DELETE" }),
    onSuccess: () => {
      telegram.refetch();
      toast.success(t("common.success"));
    },
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        headline: form.headline,
        bio: form.bio,
        city: form.city,
        country: form.country,
        website: form.website,
        telegram_username: form.telegram_username,
      };
      if (avatar) {
        const data = new FormData();
        Object.entries(payload).forEach(([key, value]) => data.append(key, value));
        data.append("avatar", avatar);
        return apiRequest<User>("/api/auth/me/", { method: "PATCH", formData: data });
      }
      return apiRequest<User>("/api/auth/me/", { method: "PATCH", body: payload });
    },
    onSuccess: async () => {
      setAvatar(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success(t("profile.saved"));
    },
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      apiRequest("/api/auth/change-password/", {
        method: "POST",
        body: {
          current_password: passwords.current,
          new_password: passwords.next,
          new_password_confirm: passwords.confirm,
        },
      }),
    onSuccess: () => {
      setPasswords({ current: "", next: "", confirm: "" });
      toast.success(t("profile.passwordChanged"));
    },
    onError: (error) => toast.error(getErrorMessage(error, t("toast.error"))),
  });

  const submitProfile = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setFormError(t("auth.fieldRequired"));
      return;
    }
    saveProfile.mutate();
  };

  const submitPassword = (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError("");
    if (!passwords.current || !passwords.next) {
      setPasswordError(t("auth.fieldRequired"));
      return;
    }
    if (passwords.next.length < 8) {
      setPasswordError(t("auth.passwordMin"));
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordError(t("auth.passwordsMismatch"));
      return;
    }
    changePassword.mutate();
  };

  const onAvatarChange = (file: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("profile.avatarHint"));
      return;
    }
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  if (!user) return null;
  const avatarSrc = avatarPreview || mediaUrl(user.avatar);
  const linked = telegram.data?.is_linked;

  return (
    <div>
      <PageHeading
        eyebrow={t("dashboard.account")}
        title={t("profile.title")}
        subtitle={t("profile.subtitle")}
      />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <section className="surface p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                <UserAvatar name={user.full_name} src={avatarSrc} className="h-20 w-20 text-xl" />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm transition-colors hover:bg-secondary"
                  aria-label={t("profile.uploadAvatar")}
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(event) => onAvatarChange(event.target.files?.[0] ?? null)}
                />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{user.full_name}</h2>
                <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge variant="default">{t(`roles.${user.role}`)}</Badge>
                  {user.is_email_verified ? (
                    <Badge variant="success" className="gap-1">
                      <BadgeCheck className="h-3 w-3" />
                      {t("profile.emailVerified")}
                    </Badge>
                  ) : (
                    <Badge variant="warning">{t("profile.emailNotVerified")}</Badge>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("profile.uploadAvatar")}: {t("profile.avatarHint")}
                </p>
              </div>
            </div>

            <Separator className="my-5" />

            <form onSubmit={submitProfile} className="space-y-4">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">{t("profile.personal")}</h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name">{t("profile.firstName")} *</Label>
                  <Input
                    id="first_name"
                    value={form.first_name}
                    onChange={(event) => setForm({ ...form, first_name: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name">{t("profile.lastName")} *</Label>
                  <Input
                    id="last_name"
                    value={form.last_name}
                    onChange={(event) => setForm({ ...form, last_name: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("profile.email")}</Label>
                  <Input id="email" value={user.email} readOnly disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">{t("profile.phone")}</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="+998 90 123 45 67"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="headline">{t("profile.headline")}</Label>
                  <Input
                    id="headline"
                    value={form.headline}
                    onChange={(event) => setForm({ ...form, headline: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="bio">{t("profile.bio")}</Label>
                  <Textarea
                    id="bio"
                    value={form.bio}
                    onChange={(event) => setForm({ ...form, bio: event.target.value })}
                    className="min-h-[96px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country">{t("profile.country")}</Label>
                  <Input
                    id="country"
                    value={form.country}
                    onChange={(event) => setForm({ ...form, country: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">{t("profile.city")}</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(event) => setForm({ ...form, city: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="website">{t("profile.website")}</Label>
                  <Input
                    id="website"
                    value={form.website}
                    onChange={(event) => setForm({ ...form, website: event.target.value })}
                    placeholder="https://"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="telegram_username">{t("profile.telegramUsername")}</Label>
                  <Input
                    id="telegram_username"
                    value={form.telegram_username}
                    onChange={(event) => setForm({ ...form, telegram_username: event.target.value.replace(/^@/, "") })}
                    placeholder="username"
                  />
                </div>
              </div>

              {formError ? <p className="text-xs text-destructive">{formError}</p> : null}

              <div className="flex justify-end">
                <Button type="submit" variant="gradient" disabled={saveProfile.isPending}>
                  {saveProfile.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                  {saveProfile.isPending ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          </section>

          <section className="surface p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{t("profile.security")}</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
            <form onSubmit={submitPassword} className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="current_password">{t("profile.currentPassword")}</Label>
                <PasswordInput
                  id="current_password"
                  value={passwords.current}
                  onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new_password">{t("profile.newPassword")}</Label>
                <PasswordInput
                  id="new_password"
                  value={passwords.next}
                  onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm_new_password">{t("profile.confirmNewPassword")}</Label>
                <PasswordInput
                  id="confirm_new_password"
                  value={passwords.confirm}
                  onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                  autoComplete="new-password"
                />
              </div>
              {passwordError ? (
                <p className="text-xs text-destructive sm:col-span-3">{passwordError}</p>
              ) : null}
              <div className="sm:col-span-3 sm:flex sm:justify-end">
                <Button type="submit" variant="outline" disabled={changePassword.isPending}>
                  {changePassword.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                  {t("profile.changePassword")}
                </Button>
              </div>
            </form>
          </section>
        </div>

        <div className="space-y-5">
          <section className="surface p-5">
            <h3 className="text-sm font-semibold">{t("profile.pointsTitle")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t("profile.pointsHint")}</p>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold leading-none">{formatNumber(user.points ?? 0)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.points")}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t("profile.role")}</dt>
                <dd className="font-medium">{t(`roles.${user.role}`)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t("profile.memberSince")}</dt>
                <dd className="font-medium">{formatDate(user.created_at, lang)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">{t("profile.email")}</dt>
                <dd className="max-w-[60%] truncate font-medium">{user.email}</dd>
              </div>
            </dl>
          </section>

          <section className="surface p-5">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">{t("profile.telegram")}</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("profile.telegramHint")}</p>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-border/70 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium">
                  {linked ? t("profile.telegramLinked") : t("profile.telegramNotLinked")}
                </p>
                {telegram.data?.username ? (
                  <p className="truncate text-[11px] text-muted-foreground">@{telegram.data.username}</p>
                ) : null}
              </div>
              <Badge variant={linked ? "success" : "muted"}>
                {linked ? t("common.yes") : t("common.no")}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {linked ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => disconnectTelegram.mutate()}
                  disabled={disconnectTelegram.isPending}
                >
                  <Unlink className="h-3.5 w-3.5" />
                  {t("profile.disconnectTelegram")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="gradient"
                  onClick={() => connectTelegram.mutate()}
                  disabled={connectTelegram.isPending}
                >
                  <Send className="h-3.5 w-3.5" />
                  {t("profile.connectTelegram")}
                </Button>
              )}
              <Button asChild size="sm" variant="ghost">
                <a href="/dashboard/settings">{t("dashboard.settings")}</a>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
