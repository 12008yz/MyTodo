import sharp from "sharp";
import { readdir } from "node:fs/promises";
import path from "node:path";

const threshold = 40;

function colorDistance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function matchesBackground(rgb, bg) {
  return colorDistance(rgb, bg) <= threshold;
}

async function removeEdgeBackground(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const getRgb = (x, y) => {
    const i = (y * width + x) * channels;
    return [data[i], data[i + 1], data[i + 2]];
  };

  const corners = [
    getRgb(0, 0),
    getRgb(width - 1, 0),
    getRgb(0, height - 1),
    getRgb(width - 1, height - 1),
  ];

  const bg = [
    Math.round(corners.reduce((sum, color) => sum + color[0], 0) / 4),
    Math.round(corners.reduce((sum, color) => sum + color[1], 0) / 4),
    Math.round(corners.reduce((sum, color) => sum + color[2], 0) / 4),
  ];

  const enqueue = (x, y) => {
    const index = y * width + x;
    if (visited[index]) return;
    if (!matchesBackground(getRgb(x, y), bg)) return;
    visited[index] = 1;
    queue.push([x, y]);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }

  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (queue.length > 0) {
    const [x, y] = queue.pop();
    const pixelIndex = (y * width + x) * channels;
    data[pixelIndex + 3] = 0;

    if (x > 0) enqueue(x - 1, y);
    if (x < width - 1) enqueue(x + 1, y);
    if (y > 0) enqueue(x, y - 1);
    if (y < height - 1) enqueue(x, y + 1);
  }

  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(filePath);
  console.log(`processed ${path.basename(filePath)} (bg: ${bg.join(",")})`);
}

const targetDir = process.argv[2] ?? path.resolve("apps/web/public/iconsApp");
const files = await readdir(targetDir);

for (const file of files.filter((name) => name.endsWith(".png"))) {
  await removeEdgeBackground(path.join(targetDir, file));
}
