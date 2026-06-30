import { describe, expect, it } from "vitest";
import {
  formatSocialMediaRemainingMinutes,
  resolveDoomScrollEndMessage,
  resolveDoomScrollWarningMessage,
} from "./doom-scroll.js";

describe("formatSocialMediaRemainingMinutes", () => {
  it("shows remaining minutes with correct plural forms", () => {
    expect(formatSocialMediaRemainingMinutes(0, 30)).toBe("осталось 30 минут на сегодня");
    expect(formatSocialMediaRemainingMinutes(1, 30)).toBe("осталось 29 минут на сегодня");
    expect(formatSocialMediaRemainingMinutes(26, 30)).toBe("осталось 4 минуты на сегодня");
    expect(formatSocialMediaRemainingMinutes(29, 30)).toBe("осталось 1 минута на сегодня");
  });

  it("marks the daily allowance as exhausted at or above the limit", () => {
    expect(formatSocialMediaRemainingMinutes(30, 30)).toBe("лимит на сегодня исчерпан");
    expect(formatSocialMediaRemainingMinutes(35, 30)).toBe("лимит на сегодня исчерпан");
  });
});

describe("doom scroll push copy", () => {
  it("uses platform-specific warning and end messages", () => {
    expect(resolveDoomScrollWarningMessage("tiktok", 1)).toContain("TikTok");
    expect(resolveDoomScrollEndMessage("youtube_shorts", 2)).toContain("Shorts");
  });
});
