import { describe, expect, it } from "vitest";
import {
  detectCoachMessageIntent,
  resolveDarkCoachReply,
  resolveDarkCoachUrgeMessage,
} from "./coach.js";

describe("detectCoachMessageIntent", () => {
  it("detects greetings", () => {
    expect(detectCoachMessageIntent("привет")).toBe("greeting");
    expect(detectCoachMessageIntent("ало")).toBe("greeting");
    expect(detectCoachMessageIntent("Здравствуйте!")).toBe("greeting");
  });

  it("detects urge messages", () => {
    expect(detectCoachMessageIntent("меня тянет покурить")).toBe("urge");
    expect(detectCoachMessageIntent("Тянет сорваться")).toBe("urge");
  });

  it("detects relief messages", () => {
    expect(detectCoachMessageIntent("Мне легче")).toBe("relief");
  });
});

describe("resolveDarkCoachReply", () => {
  it("answers greetings without urge script", () => {
    const greeting = resolveDarkCoachReply("smoking", 2, "привет");
    const urge = resolveDarkCoachUrgeMessage("smoking", 2);

    expect(greeting).toContain("Привет");
    expect(greeting).not.toBe(urge);
  });

  it("answers unclear short messages with clarify prompt", () => {
    const reply = resolveDarkCoachReply("smoking", 2, "ну такое");
    const urge = resolveDarkCoachUrgeMessage("smoking", 2);

    expect(reply).toContain("тяга");
    expect(reply).not.toBe(urge);
  });

  it("keeps urge coaching for craving messages", () => {
    const reply = resolveDarkCoachReply("smoking", 2, "хочу закурить");
    expect(reply).toBe(resolveDarkCoachUrgeMessage("smoking", 2));
  });
});
