import { useCallback, useEffect, useId, useRef, useState } from "react";
import { disableYouTubeCaptions, loadYouTubeIframeApi, type YouTubePlayerInstance } from "./youtube-api";
import "./YouTubeLessonPlayer.css";

type YouTubeLessonPlayerProps = {
  videoId: string;
  /** Fallback when the player has not reported duration yet (e.g. on ENDED). */
  durationSec: number;
  onWatchProgress: (watchedSec: number) => void;
  onDurationReady?: (durationSec: number) => void;
  onVideoEnded?: (watchedSec: number) => void;
};

function FullscreenIcon({ exit }: { exit: boolean }) {
  if (exit) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"
        />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"
      />
    </svg>
  );
}

export function YouTubeLessonPlayer({
  videoId,
  durationSec,
  onWatchProgress,
  onDurationReady,
  onVideoEnded,
}: YouTubeLessonPlayerProps) {
  const reactId = useId();
  const elementId = `yt-player-${reactId.replace(/:/g, "")}`;
  const wrapRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const maxWatchedRef = useRef(0);
  const durationSecRef = useRef(durationSec);
  const onWatchProgressRef = useRef(onWatchProgress);
  const onDurationReadyRef = useRef(onDurationReady);
  const onVideoEndedRef = useRef(onVideoEnded);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  durationSecRef.current = durationSec;
  onWatchProgressRef.current = onWatchProgress;
  onDurationReadyRef.current = onDurationReady;
  onVideoEndedRef.current = onVideoEnded;

  const syncFullscreenState = useCallback(() => {
    const wrap = wrapRef.current;
    setIsFullscreen(Boolean(wrap && document.fullscreenElement === wrap));
    if (!document.fullscreenElement) {
      setExpanded(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, [syncFullscreenState]);

  useEffect(() => {
    if (!expanded) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  const toggleFullscreen = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }

    if (document.fullscreenElement === wrap) {
      void document.exitFullscreen();
      return;
    }

    if (expanded) {
      setExpanded(false);
      return;
    }

    if (wrap.requestFullscreen) {
      void wrap.requestFullscreen().catch(() => {
        setExpanded(true);
      });
      return;
    }

    setExpanded(true);
  }, [expanded]);

  useEffect(() => {
    maxWatchedRef.current = 0;
    setReady(false);
    setError(null);
    setExpanded(false);

    let pollTimer: number | undefined;
    let cancelled = false;

    void (async () => {
      try {
        await loadYouTubeIframeApi();
        if (cancelled || !window.YT?.Player) {
          return;
        }

        playerRef.current?.destroy();

        playerRef.current = new window.YT.Player(elementId, {
          height: "100%",
          width: "100%",
          videoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            controls: 0,
            fs: 0,
            disablekb: 1,
            cc_load_policy: 3,
            iv_load_policy: 3,
          },
          events: {
            onReady: (event) => {
              if (!cancelled) {
                disableYouTubeCaptions(event.target);
                setReady(true);
                const duration = Math.floor(event.target.getDuration());
                if (duration > 0) {
                  onDurationReadyRef.current?.(duration);
                }
              }
            },
            onStateChange: (event) => {
              if (event.data === window.YT!.PlayerState.PLAYING) {
                disableYouTubeCaptions(event.target);
                window.clearInterval(pollTimer);
                pollTimer = window.setInterval(() => {
                  const current = Math.floor(event.target.getCurrentTime());
                  if (current > maxWatchedRef.current) {
                    maxWatchedRef.current = current;
                    onWatchProgressRef.current(current);
                  }
                }, 1000);
              } else if (event.data === window.YT!.PlayerState.ENDED) {
                window.clearInterval(pollTimer);
                const duration =
                  Math.floor(event.target.getDuration()) || durationSecRef.current;
                if (duration > 0) {
                  onDurationReadyRef.current?.(duration);
                }
                const finalSec = Math.max(Math.floor(event.target.getCurrentTime()), duration);
                maxWatchedRef.current = finalSec;
                onWatchProgressRef.current(finalSec);
                onVideoEndedRef.current?.(finalSec);
              } else if (event.data === window.YT!.PlayerState.PAUSED) {
                window.clearInterval(pollTimer);
                const current = Math.floor(event.target.getCurrentTime());
                if (current > maxWatchedRef.current) {
                  maxWatchedRef.current = current;
                  onWatchProgressRef.current(current);
                }
              }
            },
          },
        });
      } catch {
        if (!cancelled) {
          setError("Не удалось загрузить видеоплеер");
        }
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      playerRef.current?.destroy();
      playerRef.current = null;
      if (wrapRef.current && document.fullscreenElement === wrapRef.current) {
        void document.exitFullscreen();
      }
    };
  }, [elementId, videoId]);

  const fullscreenActive = isFullscreen || expanded;

  return (
    <div className="youtube-lesson-player">
      <div
        ref={wrapRef}
        className={[
          "youtube-lesson-player__wrap",
          fullscreenActive ? "youtube-lesson-player__wrap--expanded" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="youtube-lesson-player__frame" id={elementId} />
        {ready && !error ? (
          <button
            type="button"
            className="youtube-lesson-player__fullscreen"
            aria-label={fullscreenActive ? "Выйти из полноэкранного режима" : "На весь экран"}
            onClick={(event) => {
              event.stopPropagation();
              toggleFullscreen();
            }}
          >
            <FullscreenIcon exit={fullscreenActive} />
          </button>
        ) : null}
        {!ready && !error ? (
          <div className="youtube-lesson-player__overlay" aria-hidden="true">
            <span className="youtube-lesson-player__spinner" />
            <span>Загружаем урок…</span>
          </div>
        ) : null}
        {error ? (
          <div className="youtube-lesson-player__overlay youtube-lesson-player__overlay--error" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
