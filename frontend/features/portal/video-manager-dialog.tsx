"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { usePortalVideos } from "@/lib/portal";
import type { LessonSummary } from "@/lib/types";
import { ConfirmDialog, StatusPill } from "./shared";

const QUALITIES = ["auto", "360p", "480p", "720p", "1080p"];

export function VideoManagerDialog({
  lesson,
  open,
  onOpenChange,
}: {
  lesson: LessonSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const videos = usePortalVideos(open && lesson ? lesson.id : null);
  const [title, setTitle] = useState("");
  const [quality, setQuality] = useState("auto");
  const [duration, setDuration] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [hlsUrl, setHlsUrl] = useState("");
  const [toDelete, setToDelete] = useState<number | null>(null);

  const invalidate = () => {
    if (lesson) queryClient.invalidateQueries({ queryKey: ["portal", "videos", lesson.id] });
    queryClient.invalidateQueries({ queryKey: ["course"] });
  };

  const upload = useMutation({
    mutationFn: () => {
      if (!lesson) throw new Error(t("portal.errorOccurred"));
      if (!file && !hlsUrl.trim()) throw new Error(t("portal.videoRequired"));
      const formData = new FormData();
      formData.append("lesson", String(lesson.id));
      formData.append("title", title);
      formData.append("quality", quality);
      formData.append("duration_seconds", duration || "0");
      formData.append("is_primary", isPrimary ? "true" : "false");
      if (file) formData.append("file", file);
      if (hlsUrl.trim()) formData.append("hls_url", hlsUrl.trim());
      return apiRequest("/api/videos/", { method: "POST", formData });
    },
    onSuccess: () => {
      toast.success(t("teacher.videoCreated"));
      setTitle("");
      setDuration("");
      setIsPrimary(false);
      setFile(null);
      setHlsUrl("");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/videos/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("portal.deleted"));
      setToDelete(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("portal.errorOccurred")),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("portal.manageVideos")}</DialogTitle>
          <DialogDescription>
            {lesson ? `${lesson.title_uz} · ${lesson.title_ru}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {videos.isLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : videos.data?.results?.length ? (
            <ul className="space-y-2">
              {videos.data.results.map((video) => (
                <li key={video.id} className="flex items-center gap-3 rounded-xl border border-border/70 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Upload className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {video.title || t("portal.video")} · {video.quality}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {video.size_bytes ? `${(video.size_bytes / 1024 / 1024).toFixed(1)} MB` : video.hls_url || "—"}
                      {video.is_primary ? ` · ${t("portal.primary")}` : ""}
                    </p>
                  </div>
                  <StatusPill status={video.processing_status} />
                  <Button
                    variant="ghost"
                    size="iconSm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setToDelete(video.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("portal.noVideos")}</p>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/20 p-4">
          <p className="text-sm font-semibold">{t("portal.uploadVideo")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="video-title">{t("portal.videoTitle")}</Label>
              <Input id="video-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("portal.quality")}</Label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUALITIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="video-duration">{t("portal.durationSeconds")}</Label>
              <Input
                id="video-duration"
                type="number"
                min={0}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="video-file">{t("teacher.videoFile")}</Label>
              <Input
                id="video-file"
                type="file"
                accept="video/*"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="video-hls">{t("teacher.videoUrl")}</Label>
              <Input
                id="video-hls"
                value={hlsUrl}
                onChange={(event) => setHlsUrl(event.target.value)}
                placeholder="https://.../playlist.m3u8"
              />
              <p className="text-[11px] text-muted-foreground">{t("portal.hlsHint")}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
              {t("teacher.primary")}
            </label>
          </div>
          <Button onClick={() => upload.mutate()} disabled={upload.isPending} variant="gradient" className="w-full sm:w-auto">
            {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {t("portal.uploadVideo")}
          </Button>
        </div>

        <ConfirmDialog
          open={toDelete !== null}
          onOpenChange={(open) => !open && setToDelete(null)}
          title={t("portal.delete")}
          description={t("teacher.deleteConfirm")}
          confirmLabel={t("portal.delete")}
          loading={remove.isPending}
          onConfirm={() => toDelete !== null && remove.mutate(toDelete)}
        />
      </DialogContent>
    </Dialog>
  );
}
