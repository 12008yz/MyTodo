#!/usr/bin/env node
/**
 * Fast VK playlist import (~5s). Fetches IDs/URLs only via flat playlist.
 * Titles/durations in JSON are placeholders — UI uses VK player for real duration.
 *
 * Usage: node scripts/import-english-playlist.mjs
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLAYLIST_URL = "https://vkvideo.ru/playlist/-98069659_11";
/** Placeholder until VK player reports real duration; not used when player is ready. */
const PLACEHOLDER_DURATION_SEC = 1;
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../packages/shared/src/data/english-lessons.json",
);

const raw = execFileSync(
  process.platform === "win32" ? "python" : "python3",
  [
    "-m",
    "yt_dlp",
    "--flat-playlist",
    "--print",
    "%(playlist_index)s|%(id)s",
    PLAYLIST_URL,
  ],
  { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 },
);

const lessons = raw
  .trim()
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("WARNING"))
  .map((line) => {
    const [index, vkId] = line.split("|", 2);
    const dayNumber = Number(index);
    const normalizedVkId = vkId?.trim() ?? "";
    return {
      dayNumber,
      title: `Урок ${dayNumber}`,
      videoUrl: `https://vk.com/video${normalizedVkId}`,
      durationSec: PLACEHOLDER_DURATION_SEC,
      description: null,
    };
  });

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(lessons, null, 2)}\n`, "utf8");
console.log(`Wrote ${lessons.length} lessons to ${OUT}`);
