/**
 * Downloads public-domain book texts, splits into virtual pages, writes to apps/web/public/books/.
 * Run: node scripts/books/prepare-books.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const JSZip = require("../../apps/api/node_modules/jszip");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../apps/web/public/books");

/** Must match packages/shared/src/constants/books.ts */
const BOOK_PAGE_COUNTS = {
  "kak-zakalyalas-stal": 592,
  meditations: 176,
  "self-help-smiles": 360,
  "franklin-autobiography": 188,
  "chto-delat": 488,
};

const BOOK_META = {
  meditations: { title: "Размышления", author: "Марк Аврелий" },
  "kak-zakalyalas-stal": { title: "Как закалялась сталь", author: "Николай Островский" },
  "self-help-smiles": { title: "Саморазвитие", author: "Сэмюэл Смайлс" },
  "franklin-autobiography": { title: "Автобиография", author: "Бенджамин Франклин" },
  "chto-delat": { title: "Что делать?", author: "Николай Чернышевский" },
};

/** @type {Record<string, { kind: 'txt' | 'fb2zip' | 'gutenberg'; url: string }>} */
const SOURCES = {
  meditations: {
    kind: "fb2zip",
    url: "https://zhurnal.lib.ru/a/ajnur_e_w/aureliusmeditations.fb2.zip",
  },
  "kak-zakalyalas-stal": {
    kind: "fb2zip",
    url: "http://az.lib.ru/o/ostrowskij_n_a/ostrowskij_n_a-text_0010.fb2.zip",
  },
  "chto-delat": {
    kind: "fb2zip",
    url: "http://az.lib.ru/c/chernyshewskij_n_g/chernyshewskij_n_g-text_1862_01_chto_delat.fb2.zip",
  },
  "franklin-autobiography": {
    kind: "gutenberg",
    url: "https://www.gutenberg.org/cache/epub/148/pg148.txt",
  },
  "self-help-smiles": {
    kind: "gutenberg",
    url: "https://www.gutenberg.org/cache/epub/935/pg935.txt",
  },
};

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function fb2ToText(xml) {
  return decodeHtmlEntities(
    xml
      .replace(/<binary[\s\S]*?<\/binary>/gi, "")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();
}

function cleanGutenberg(text) {
  const start = text.indexOf("*** START");
  const end = text.indexOf("*** END");
  if (start !== -1 && end !== -1) {
    const lineEnd = text.indexOf("\n", start);
    return text.slice(lineEnd + 1, end).trim();
  }
  return text.trim();
}

function cleanLibRuTxt(text) {
  const markers = ["Глава", "Часть", "I\n", "I.\n", "Предисловие"];
  let start = 0;
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx > 200 && idx < 8000) {
      start = idx;
      break;
    }
  }
  return text.slice(start).replace(/\n{3,}/g, "\n\n").trim();
}

function splitIntoPages(text, pageCount) {
  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) {
    return Array.from({ length: pageCount }, () => "");
  }

  const totalLen = paragraphs.reduce((sum, p) => sum + p.length + 2, 0);
  const targetPerPage = Math.max(400, Math.ceil(totalLen / pageCount));
  const pages = [];
  let current = "";

  for (const para of paragraphs) {
    if (pages.length >= pageCount - 1) {
      current = current ? `${current}\n\n${para}` : para;
      continue;
    }

    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length >= targetPerPage && current) {
      pages.push(current);
      current = para;
    } else {
      current = candidate;
    }
  }

  if (current) {
    pages.push(current);
  }

  while (pages.length < pageCount) {
    pages.push("");
  }

  if (pages.length > pageCount) {
    const tail = pages.splice(pageCount - 1);
    pages.push(tail.join("\n\n"));
  }

  return pages;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "mytodo-books-prepare/1.0" },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString("utf16le");
  }
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    return buf.swap16().toString("utf16le");
  }
  return buf.toString("utf-8");
}

async function fetchFb2Zip(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "mytodo-books-prepare/1.0" },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  const fb2Name = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith(".fb2"));
  if (!fb2Name) {
    throw new Error(`No .fb2 in zip from ${url}`);
  }
  const xml = await zip.file(fb2Name).async("string");
  return fb2ToText(xml);
}

async function loadBookText(id, source) {
  console.log(`  fetching (${source.kind})…`);
  switch (source.kind) {
    case "gutenberg":
      return cleanGutenberg(await fetchText(source.url));
    case "txt":
      return cleanLibRuTxt(await fetchText(source.url));
    case "fb2zip":
      return cleanLibRuTxt(await fetchFb2Zip(source.url));
    default:
      throw new Error(`Unknown source kind for ${id}`);
  }
}

async function writeBook(id) {
  const pageCount = BOOK_PAGE_COUNTS[id];
  const meta = BOOK_META[id];
  const source = SOURCES[id];
  if (!pageCount || !meta || !source) {
    throw new Error(`Missing book config for ${id}`);
  }
  console.log(`\n${id} → ${pageCount} pages`);

  const text = await loadBookText(id, source);
  const pages = splitIntoPages(text, pageCount);
  const bookDir = path.join(OUT_DIR, id);
  const pagesDir = path.join(bookDir, "pages");

  await fs.rm(bookDir, { recursive: true, force: true });
  await fs.mkdir(pagesDir, { recursive: true });

  await fs.writeFile(
    path.join(bookDir, "manifest.json"),
    `${JSON.stringify({ id, title: meta.title, author: meta.author, pageCount }, null, 2)}\n`,
    "utf-8",
  );

  await Promise.all(
    pages.map((content, index) => {
      const num = String(index + 1).padStart(3, "0");
      return fs.writeFile(path.join(pagesDir, `${num}.txt`), content, "utf-8");
    }),
  );

  const totalBytes = pages.reduce((sum, p) => sum + Buffer.byteLength(p, "utf-8"), 0);
  if (pages.length !== pageCount) {
    throw new Error(`${id}: expected ${pageCount} pages, got ${pages.length}`);
  }
  console.log(`  wrote ${pages.length} pages, ${(totalBytes / 1024).toFixed(0)} KB text`);
}

async function main() {
  console.log("Preparing books →", OUT_DIR);
  for (const id of Object.keys(BOOK_PAGE_COUNTS)) {
    await writeBook(id);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
