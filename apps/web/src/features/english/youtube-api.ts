type YouTubePlayerInstance = {
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
  unloadModule?: (moduleName: string) => void;
};

type YouTubePlayerOptions = {
  videoId: string;
  events?: {
    onReady?: (event: { target: YouTubePlayerInstance }) => void;
    onStateChange?: (event: { data: number; target: YouTubePlayerInstance }) => void;
  };
};

type YouTubePlayerConstructor = new (
  elementId: string,
  options: {
    height: string;
    width: string;
    videoId: string;
    playerVars?: Record<string, string | number>;
    events?: YouTubePlayerOptions["events"];
  },
) => YouTubePlayerInstance;

type YouTubeNamespace = {
  Player: YouTubePlayerConstructor;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
  };
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReadyPromise: Promise<void> | null = null;

function waitForYouTubeApi(timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(timer);
        resolve();
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer);
        reject(new Error("YouTube IFrame API load timeout"));
      }
    }, 50);
  });
}

export function loadYouTubeIframeApi(): Promise<void> {
  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (!apiReadyPromise) {
    apiReadyPromise = new Promise((resolve, reject) => {
      const finish = () => {
        waitForYouTubeApi()
          .then(resolve)
          .catch(reject);
      };

      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        finish();
      };

      const existingScript = document.querySelector('script[data-youtube-iframe-api="true"]');
      if (existingScript) {
        finish();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.dataset.youtubeIframeApi = "true";
      script.onerror = () => reject(new Error("YouTube IFrame API script failed to load"));
      document.head.appendChild(script);
    });
  }

  return apiReadyPromise;
}

export type { YouTubePlayerInstance, YouTubeNamespace };

export function disableYouTubeCaptions(player: YouTubePlayerInstance) {
  try {
    player.unloadModule?.("captions");
  } catch {
    // YouTube may reject this for some videos — safe to ignore.
  }
}
