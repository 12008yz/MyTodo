export type VkVideoPlayerState = {
  state: string;
  time: number;
  duration: number;
  volume?: number;
  muted?: boolean;
};

export type VkVideoPlayerInstance = {
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getState: () => string;
  on: (event: string, listener: (state: VkVideoPlayerState) => void) => void;
  off: (event: string, listener: (state: VkVideoPlayerState) => void) => void;
  destroy: () => void;
};

type VkVideoPlayerConstructor = (iframe: HTMLIFrameElement) => VkVideoPlayerInstance;

type VkNamespace = {
  VideoPlayer: VkVideoPlayerConstructor;
};

declare global {
  interface Window {
    VK?: VkNamespace;
  }
}

let loadPromise: Promise<void> | null = null;

export function loadVkVideoPlayerApi(): Promise<void> {
  if (window.VK?.VideoPlayer) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-vk-videoplayer-api="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("VK VideoPlayer API failed to load")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://vk.com/js/api/videoplayer.js";
    script.async = true;
    script.dataset.vkVideoplayerApi = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("VK VideoPlayer API script failed to load"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

/** Stops any VK lesson iframes still mounted inside a container (e.g. during card collapse). */
export function stopVkEmbedsInContainer(root: ParentNode | null | undefined): void {
  if (!root) {
    return;
  }

  root.querySelectorAll<HTMLIFrameElement>(".vk-lesson-player__frame iframe").forEach((iframe) => {
    if (iframe.src && iframe.src !== "about:blank") {
      iframe.src = "about:blank";
    }
  });
}
