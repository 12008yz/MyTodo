#!/usr/bin/env node
/**
 * Import YouTube playlist into packages/shared/src/data/english-lessons.json
 *
 * Requires: python -m pip install yt-dlp
 *
 * Usage: node scripts/import-english-playlist.mjs
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLAYLIST_URL =
  "https://www.youtube.com/playlist?list=PLD6SPjEPomaustGSgYNsn3V62BTQeH85X";
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
    "%(playlist_index)s|%(id)s|%(title)s|%(duration)s",
    PLAYLIST_URL,
  ],
  { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
);

const lessons = raw
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [index, videoId, title, duration] = line.split("|", 4);
    const dayNumber = Number(index);
    return {
      dayNumber,
      title: title?.trim() || `Урок ${dayNumber}`,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      durationSec: Math.max(1, Math.floor(Number(duration) || 0)),
      description: null,
    };
  });

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(lessons, null, 2)}\n`, "utf8");
console.log(`Wrote ${lessons.length} lessons to ${OUT}`);
