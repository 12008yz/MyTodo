import { useEffect, useRef } from "react";

const EXERCISE_DEMO_PLAYBACK_RATE = 1.3;

type VideoWithWebkitFullscreen = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
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
      void video.play().catch(() => {});
    };

    video.addEventListener("canplay", tryPlay);
    tryPlay();

    return () => {
      video.removeEventListener("canplay", tryPlay);
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
