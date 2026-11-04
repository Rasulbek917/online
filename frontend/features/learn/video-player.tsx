"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { clamp, cn, formatDuration } from "@/lib/utils";
import type { StreamVideo } from "@/lib/types";

interface VideoPlayerProps {
  videos: StreamVideo[];
  startPosition?: number;
  poster?: string | null;
  title: string;
  onProgress: (position: number, duration: number, videoId: number) => void;
  onEnded: (position: number, duration: number, videoId: number) => void;
  onRefresh?: () => void;
}

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function VideoPlayer({
  videos,
  startPosition = 0,
  poster,
  title,
  onProgress,
  onEnded,
  onRefresh,
}: VideoPlayerProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReport = useRef(0);
  const pendingSeek = useRef(0);
  const shouldResume = useRef(false);
  const initialApplied = useRef(false);

  const primary = videos.find((item) => item.is_primary) || videos[0];
  const [videoId, setVideoId] = useState<number | undefined>(primary?.id);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(primary?.duration_seconds || 0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const active = videos.find((item) => item.id === videoId) || primary;

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("ipa-video-volume") : null;
    if (stored) {
      const parsed = Number(stored);
      if (Number.isFinite(parsed)) setVolume(clamp(parsed, 0, 1));
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const element = videoRef.current;
    if (!element) return;
    element.playbackRate = speed;
  }, [speed, active]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => document.removeEventListener("fullscreenchange", onFullscreen);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!active) return null;

  const showControls = () => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 3000);
  };

  const togglePlay = async () => {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) {
      try {
        await element.play();
      } catch {
        setFailed(true);
      }
    } else {
      element.pause();
    }
  };

  const seek = (value: number) => {
    const element = videoRef.current;
    if (!element) return;
    element.currentTime = clamp(value, 0, element.duration || duration || 0);
    setCurrent(element.currentTime);
  };

  const changeVolume = (value: number) => {
    const element = videoRef.current;
    const next = clamp(value, 0, 1);
    setVolume(next);
    setMuted(next === 0);
    if (element) {
      element.volume = next;
      element.muted = next === 0;
    }
    window.localStorage.setItem("ipa-video-volume", String(next));
  };

  const toggleMute = () => {
    const element = videoRef.current;
    if (!element) return;
    const next = !element.muted;
    element.muted = next;
    setMuted(next);
    if (!next && element.volume === 0) {
      element.volume = 1;
      setVolume(1);
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  };

  const switchQuality = (id: number) => {
    if (id === videoId) return;
    const element = videoRef.current;
    pendingSeek.current = element?.currentTime ?? current;
    shouldResume.current = Boolean(element && !element.paused);
    initialApplied.current = true;
    setFailed(false);
    setVideoId(id);
  };

  const onLoadedMetadata = () => {
    const element = videoRef.current;
    if (!element) return;
    const nextDuration = element.duration || active.duration_seconds || 0;
    setDuration(nextDuration);
    const target = pendingSeek.current || (!initialApplied.current ? startPosition : 0);
    if (target > 3 && target < nextDuration - 3) {
      element.currentTime = target;
      setCurrent(target);
    }
    initialApplied.current = true;
    pendingSeek.current = 0;
    element.volume = volume;
    element.muted = muted;
    element.playbackRate = speed;
    if (shouldResume.current) {
      element.play().catch(() => undefined);
      shouldResume.current = false;
    }
  };

  const onTimeUpdate = () => {
    const element = videoRef.current;
    if (!element) return;
    setCurrent(element.currentTime);
    if (element.currentTime - lastReport.current >= 10) {
      lastReport.current = element.currentTime;
      onProgress(element.currentTime, element.duration || duration, active.id);
    }
  };

  const handleEnded = () => {
    const element = videoRef.current;
    if (!element) return;
    setPlaying(false);
    setControlsVisible(true);
    onEnded(element.duration || duration, element.duration || duration, active.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const element = videoRef.current;
    if (!element) return;
    switch (event.key) {
      case " ":
        event.preventDefault();
        void togglePlay();
        break;
      case "ArrowRight":
        event.preventDefault();
        seek(element.currentTime + 5);
        break;
      case "ArrowLeft":
        event.preventDefault();
        seek(element.currentTime - 5);
        break;
      case "ArrowUp":
        event.preventDefault();
        changeVolume(volume + 0.1);
        break;
      case "ArrowDown":
        event.preventDefault();
        changeVolume(volume - 0.1);
        break;
      case "m":
        toggleMute();
        break;
      case "f":
        void toggleFullscreen();
        break;
      default:
        return;
    }
    showControls();
  };

  const progress = duration ? (current / duration) * 100 : 0;
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={showControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
      className={cn(
        "group relative aspect-video w-full overflow-hidden rounded-2xl border border-border/70 bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        fullscreen && "flex items-center justify-center rounded-none border-0",
      )}
      aria-label={title}
    >
      <video
        key={active.id}
        ref={videoRef}
        src={active.stream_url}
        poster={poster || undefined}
        preload="metadata"
        playsInline
        className={cn("h-full w-full", fullscreen ? "object-contain" : "object-contain")}
        onClick={() => void togglePlay()}
        onPlay={() => {
          setPlaying(true);
          showControls();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
          if (videoRef.current) {
            onProgress(videoRef.current.currentTime, videoRef.current.duration || duration, active.id);
          }
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={handleEnded}
        onError={() => setFailed(true)}
      />

      {buffering && !failed ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
          <Loader2 className="h-9 w-9 animate-spin text-white" />
        </div>
      ) : null}

      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-6 text-center text-white">
          <p className="text-sm">{t("learn.playerError")}</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              onRefresh?.();
              const element = videoRef.current;
              if (element) {
                element.load();
                element.play().catch(() => setFailed(true));
              }
            }}
            className="rounded-lg bg-white/15 px-4 py-2 text-xs font-medium transition-colors hover:bg-white/25"
          >
            {t("common.retry")}
          </button>
        </div>
      ) : null}

      {!playing && !failed && !buffering ? (
        <button
          type="button"
          onClick={() => void togglePlay()}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
          aria-label={t("learn.startLesson")}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-xl transition-transform hover:scale-105">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
        </button>
      ) : null}

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-2.5 pt-10 transition-opacity duration-200 sm:px-4",
          controlsVisible || !playing ? "opacity-100" : "opacity-0",
        )}
      >
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(current, duration || 0)}
          onChange={(event) => seek(Number(event.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-primary [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
          aria-label={t("learn.videoPosition")}
          style={{
            background: `linear-gradient(to right, rgb(99 102 241) ${progress}%, rgba(255,255,255,0.25) ${progress}%)`,
          }}
        />

        <div className="mt-1.5 flex items-center gap-1 text-white sm:gap-2">
          <button type="button" onClick={() => void togglePlay()} className="rounded p-1.5 hover:bg-white/15" aria-label={playing ? t("learn.pause") : t("learn.play")}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
          </button>
          <button type="button" onClick={() => seek(current - 10)} className="hidden rounded p-1.5 hover:bg-white/15 sm:block" aria-label={t("learn.back10")}>
            <RotateCcw className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => seek(current + 10)} className="hidden rounded p-1.5 hover:bg-white/15 sm:block" aria-label={t("learn.forward10")}>
            <RotateCw className="h-4 w-4" />
          </button>

          <span className="ml-1 text-[11px] tabular-nums text-white/85">
            {formatDuration(current)} / {formatDuration(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <div className="group/volume flex items-center">
              <button type="button" onClick={toggleMute} className="rounded p-1.5 hover:bg-white/15" aria-label={muted ? t("learn.unmute") : t("learn.mute")}>
                <VolumeIcon className="h-4 w-4" />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(event) => changeVolume(Number(event.target.value))}
                className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 opacity-0 transition-all duration-200 group-hover/volume:w-16 group-hover/volume:opacity-100 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                aria-label={t("learn.unmute")}
              />
            </div>

            <select
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
              className="cursor-pointer rounded bg-white/10 px-1.5 py-1 text-[11px] text-white outline-none hover:bg-white/20"
              aria-label={t("learn.speed")}
            >
              {speeds.map((value) => (
                <option key={value} value={value} className="text-slate-900">
                  {value}x
                </option>
              ))}
            </select>

            {videos.length > 1 ? (
              <select
                value={active.id}
                onChange={(event) => switchQuality(Number(event.target.value))}
                className="cursor-pointer rounded bg-white/10 px-1.5 py-1 text-[11px] text-white outline-none hover:bg-white/20"
                aria-label={t("learn.quality")}
              >
                {videos.map((video) => (
                  <option key={video.id} value={video.id} className="text-slate-900">
                    {video.quality || "auto"}
                  </option>
                ))}
              </select>
            ) : null}

            <button type="button" onClick={() => void toggleFullscreen()} className="rounded p-1.5 hover:bg-white/15" aria-label={t("learn.fullscreen")}>
              {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
