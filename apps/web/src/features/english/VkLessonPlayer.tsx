import { useCallback, useEffect, useRef, useState } from "react";
import { buildVkEmbedUrl, type VkVideoRef } from "./format";
import { loadVkVideoPlayerApi, stopVkEmbedsInContainer, type VkVideoPlayerInstance, type VkVideoPlayerState } from "./vk-api";
import "./VkLessonPlayer.css";

/** Pause and lock before VK shows its own "next video" countdown. */
const END_LOCK_BUFFER_SEC = 4;

type VkLessonPlayerProps = {
  video: VkVideoRef;
  /** Page URL for fallback when embed fails. */
  pageUrl: string;
  durationSec: number;
  fallbackClassName?: string;
  completionMessage?: string;
  /** Preview in catalog — no end-of-lesson handling. */
  previewOnly?: boolean;
  /** Hide VK done overlay; parent shows completion UI on home. */
  suppressDoneOverlay?: boolean;
  onWatchProgress: (watchedSec: number) => void;
  onDurationReady?: (durationSec: number) => void;
  onVideoEnded?: (payload: { watchedSec: number; durationSec: number }) => void;
  /** Remount the player to watch again after the lesson ends. */
  onRewatch?: () => void;
};

export function VkLessonPlayer({
  video,
  pageUrl,
  durationSec,
  fallbackClassName = "home__plan-drawer-btn",
  completionMessage = "Урок просмотрен",
  previewOnly = false,
  suppressDoneOverlay = false,
  onWatchProgress,
  onDurationReady,
  onVideoEnded,
  onRewatch,
}: VkLessonPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<VkVideoPlayerInstance | null>(null);
  const bindPlayerRef = useRef<(() => void) | null>(null);
  const endedRef = useRef(false);
  const maxWatchedRef = useRef(0);
  const durationSecRef = useRef(durationSec);
  const onWatchProgressRef = useRef(onWatchProgress);
  const onDurationReadyRef = useRef(onDurationReady);
  const onVideoEndedRef = useRef(onVideoEnded);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playbackLocked, setPlaybackLocked] = useState(false);

  const embedSrc = buildVkEmbedUrl(video);
  const videoKey = `${video.oid}:${video.id}`;

  durationSecRef.current = durationSec;
  onWatchProgressRef.current = onWatchProgress;
  onDurationReadyRef.current = onDurationReady;
  onVideoEndedRef.current = onVideoEnded;

  const lockPlaybackSurface = useCallback(() => {
    const player = playerRef.current;
    if (player) {
      try {
        player.pause();
      } catch {
        // Player may already be torn down.
      }
    }

    const iframe = iframeRef.current;
    if (iframe && iframe.src !== "about:blank") {
      iframe.src = "about:blank";
    }

    setPlaybackLocked(true);
  }, []);

  useEffect(() => {
    maxWatchedRef.current = 0;
    endedRef.current = false;
    setReady(false);
    setError(null);
    setPlaybackLocked(false);

    let cancelled = false;
    let initTimer: number | undefined;

    const reportProgress = (seconds: number) => {
      const current = Math.floor(seconds);
      if (current > maxWatchedRef.current) {
        maxWatchedRef.current = current;
        onWatchProgressRef.current(current);
      }
    };

    const handleEnded = (seconds: number, duration: number) => {
      if (endedRef.current) {
        return;
      }
      endedRef.current = true;

      if (previewOnly) {
        return;
      }

      if (!suppressDoneOverlay) {
        lockPlaybackSurface();
      } else {
        const player = playerRef.current;
        if (player) {
          try {
            player.pause();
          } catch {
            // Player may already be torn down.
          }
        }
      }

      const resolvedDuration =
        duration > 0 ? duration : durationSecRef.current > 60 ? durationSecRef.current : 0;
      if (resolvedDuration > 0) {
        onDurationReadyRef.current?.(resolvedDuration);
      }
      const finalSec = Math.max(
        Math.floor(seconds),
        resolvedDuration > 0 ? resolvedDuration : maxWatchedRef.current,
      );
      maxWatchedRef.current = finalSec;
      onWatchProgressRef.current(finalSec);
      onVideoEndedRef.current?.({
        watchedSec: finalSec,
        durationSec: resolvedDuration > 0 ? resolvedDuration : finalSec,
      });
    };

    const shouldLockNearEnd = (time: number, duration: number) =>
      duration > 60 && time >= Math.max(duration - END_LOCK_BUFFER_SEC, duration * 0.97);

    const onInited = (state: VkVideoPlayerState) => {
      if (!cancelled) {
        setReady(true);
        if (state.duration > 0) {
          onDurationReadyRef.current?.(Math.floor(state.duration));
        }
      }
    };

    const onTimeUpdate = (state: VkVideoPlayerState) => {
      reportProgress(state.time);
      const duration = Math.floor(state.duration);
      if (shouldLockNearEnd(state.time, duration)) {
        handleEnded(state.time, duration);
      }
    };

    const onEnded = (state: VkVideoPlayerState) => {
      handleEnded(state.time, Math.floor(state.duration));
    };

    const onPlayerError = () => {
      if (!cancelled) {
        setError("Не удалось воспроизвести видео");
      }
    };

    const bindPlayer = () => {
      const iframe = iframeRef.current;
      if (cancelled || !iframe || !window.VK?.VideoPlayer || playerRef.current) {
        return;
      }

      const player = window.VK.VideoPlayer(iframe);
      playerRef.current = player;
      player.on("inited", onInited);
      player.on("timeupdate", onTimeUpdate);
      player.on("ended", onEnded);
      player.on("error", onPlayerError);

      initTimer = window.setTimeout(() => {
        if (!cancelled && player.getState() === "error") {
          setError("Не удалось воспроизвести видео");
        }
      }, 12_000);
    };

    bindPlayerRef.current = bindPlayer;

    void (async () => {
      try {
        await loadVkVideoPlayerApi();
        bindPlayer();
      } catch {
        if (!cancelled) {
          setError("Не удалось загрузить видеоплеер");
        }
      }
    })();

    return () => {
      cancelled = true;
      bindPlayerRef.current = null;
      window.clearTimeout(initTimer);
      const player = playerRef.current;
      if (player) {
        player.off("inited", onInited);
        player.off("timeupdate", onTimeUpdate);
        player.off("ended", onEnded);
        player.off("error", onPlayerError);
        try {
          player.pause();
        } catch {
          // ignore
        }
        player.destroy();
      }
      playerRef.current = null;
      stopVkEmbedsInContainer(iframeRef.current?.parentElement ?? null);
    };
  }, [videoKey, lockPlaybackSurface]);

  return (
    <div className="vk-lesson-player">
      {playbackLocked && !suppressDoneOverlay ? (
        <div className="vk-lesson-player__done" role="status" aria-live="polite">
          <div className="vk-lesson-player__done-row">
            <span className="vk-lesson-player__done-icon" aria-hidden="true">
              ✓
            </span>
            <div className="vk-lesson-player__done-copy">
              <p className="vk-lesson-player__done-title">{completionMessage}</p>
              <p className="vk-lesson-player__done-hint">Завтра откроется следующий урок</p>
            </div>
          </div>
          {onRewatch ? (
            <button
              type="button"
              className="vk-lesson-player__rewatch-btn"
              onClick={(event) => {
                event.stopPropagation();
                onRewatch();
              }}
            >
              Пересмотреть урок
            </button>
          ) : null}
        </div>
      ) : (
        <div className="vk-lesson-player__wrap">
          <div className="vk-lesson-player__frame">
            <iframe
              key={videoKey}
              ref={iframeRef}
              src={embedSrc}
              title="Видеоурок"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => bindPlayerRef.current?.()}
            />
          </div>
          {!ready && !error ? (
            <div className="vk-lesson-player__overlay" aria-hidden="true">
              <span className="vk-lesson-player__spinner" />
              <span>Загружаем урок…</span>
            </div>
          ) : null}
          {error ? (
            <div className="vk-lesson-player__overlay vk-lesson-player__overlay--error" role="alert">
              {error}
            </div>
          ) : null}
        </div>
      )}
      {error && !playbackLocked ? (
        <a
          className={`${fallbackClassName} vk-lesson-player__fallback`}
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          Открыть урок во VK
        </a>
      ) : null}
    </div>
  );
}
