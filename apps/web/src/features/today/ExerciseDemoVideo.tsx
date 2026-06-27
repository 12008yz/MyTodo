import { useEffect, useRef } from "react";

const EXERCISE_DEMO_PLAYBACK_RATE = 1.3;

type VideoWithWebkitFullscreen = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

type DocumentWithWebkitFullscreen = Document & {
  webkitFullscreenElement?: Element | null;
};

async function openVideoFullscreen(video: HTMLVideoElement): Promise<void> {
  const webkitVideo = video as VideoWithWebkitFullscreen;
  if (typeof webkitVideo.webkitEnterFullscreen === "function") {
    webkitVideo.webkitEnterFullscreen();
    return;
  }

  if (video.requestFullscreen) {
    await video.requestFullscreen();
  }
}

function isVideoFullscreen(video: HTMLVideoElement): boolean {
  const doc = document as DocumentWithWebkitFullscreen;
  const fullscreenElement = document.fullscreenElement ?? doc.webkitFullscreenElement;
  return fullscreenElement === video;
}

function resumePreviewPlayback(video: HTMLVideoElement) {
  video.playbackRate = EXERCISE_DEMO_PLAYBACK_RATE;
  void video.play().catch(() => {});
}

export function ExerciseDemoVideo({
  src,
  label,
  active,
}: {
  src: string;
  label: string;
  active: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.playbackRate = EXERCISE_DEMO_PLAYBACK_RATE;

    const tryPlay = () => {
      if (!active) {
        return;
      }
      resumePreviewPlayback(video);
    };

    const handleFullscreenChange = () => {
      if (!active || isVideoFullscreen(video)) {
        return;
      }
      requestAnimationFrame(() => {
        resumePreviewPlayback(video);
      });
    };

    const handleWebkitEndFullscreen = () => {
      if (!active) {
        return;
      }
      requestAnimationFrame(() => {
        resumePreviewPlayback(video);
      });
    };

    video.addEventListener("canplay", tryPlay);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    video.addEventListener("webkitendfullscreen", handleWebkitEndFullscreen);
    tryPlay();

    return () => {
      video.removeEventListener("canplay", tryPlay);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      video.removeEventListener("webkitendfullscreen", handleWebkitEndFullscreen);
    };
  }, [src, active]);

  return (
    <video
      ref={videoRef}
      className="home__strength-exercise-demo-gif home__strength-exercise-demo-gif--video"
      src={src}
      preload={active ? "auto" : "none"}
      autoPlay
      loop
      muted
      playsInline
      aria-label={`${label}. Нажмите, чтобы открыть на весь экран`}
      onClick={(event) => {
        event.stopPropagation();
        const video = videoRef.current;
        if (!video) {
          return;
        }
        void openVideoFullscreen(video);
      }}
    />
  );
}
