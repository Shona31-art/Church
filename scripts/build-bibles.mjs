// Builds the Bible text files the reader uses: public/bibles/<version>/NN-<book>.json
// plus public/bibles/versions.json. Run it only when adding or refreshing a version:
//
//   node scripts/build-bibles.mjs
//
// Every version here is PUBLIC DOMAIN, which is what lets us ship the text
// inside the app and let members download it for offline reading. Never add
// a copyrighted version (NIV, ESV, Afrikaans 1983, …) to this script —
// licensed versions must come from a licensed API and stay online-only.
// See docs/adr/0001-bible-text-hosting-and-offline.md.
//
// Sources (downloaded once into your temp folder, then reused):
//   KJV, ASV, YLT — github.com/scrollmapper/bible_databases (MIT; texts public domain)
//   WEB           — ebible.org (public domain; "World English Bible" is a trademark
//                   of eBible.org, so the text must not be altered under that name —
//                   we only normalise whitespace)
//
// Output format, one file per book:  {"book":"John","chapters":[["v1 text","v2 text",…],…]}
// Verse N is at index N-1. A verse a version doesn't have is "" so indexes stay aligned.
// Words in [square brackets] are words the translators supplied (printed in italics
// in paper Bibles); the reader shows them in italics.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "bibles");
const CACHE_DIR = path.join(os.tmpdir(), "church-app-bible-sources");
const canon = JSON.parse(fs.readFileSync(path.join(ROOT, "lib", "bible", "canon.json"), "utf8"));

const SCROLLMAPPER = "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json";

const VERSIONS = [
  { id: "web", abbreviation: "WEB", name: "World English Bible", year: 2000, source: { kind: "ebible-vpl", url: "https://ebible.org/Scriptures/eng-web_vpl.zip", entry: "eng-web_vpl.txt" } },
  { id: "kjv", abbreviation: "KJV", name: "King James Version", year: 1769, source: { kind: "scrollmapper", url: `${SCROLLMAPPER}/KJV.json` } },
  { id: "asv", abbreviation: "ASV", name: "American Standard Version", year: 1901, source: { kind: "scrollmapper", url: `${SCROLLMAPPER}/ASV.json` } },
  { id: "ylt", abbreviation: "YLT", name: "Young's Literal Translation", year: 1898, source: { kind: "scrollmapper", url: `${SCROLLMAPPER}/YLT.json` } },
];

// ---------------------------------------------------------------------------

async function download(url) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, path.basename(new URL(url).pathname));
  if (fs.existsSync(file)) return fs.readFileSync(file);
  console.log(`  downloading ${url}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  return buf;
}

/** Reads one file out of a .zip using only zlib (avoids adding an unzip package for a one-off script). */
function readZipEntry(zip, wanted) {
  let eocd = zip.length - 22;
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Not a zip file");
  const entries = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < entries; i++) {
    const method = zip.readUInt16LE(p + 10);
    const size = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const name = zip.toString("utf8", p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      return method === 0 ? data : zlib.inflateRawSync(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${wanted} not found in zip`);
}

/** Collapse whitespace and drop square brackets that have no partner (e.g. ASV's "[Selah"). */
function cleanVerse(text) {
  const chars = [...text.replace(/\s+/g, " ").trim()];
  const open = [];
  const drop = new Set();
  chars.forEach((ch, i) => {
    if (ch === "[") open.push(i);
    else if (ch === "]") open.length ? open.pop() : drop.add(i);
  });
  open.forEach((i) => drop.add(i));
  return chars.filter((_, i) => !drop.has(i)).join("").replace(/\s+/g, " ").trim();
}

/** books[bookIndex][chapterIndex][verseIndex] = text */
function emptyBooks() {
  return canon.map(() => []);
}

function put(books, bookIndex, chapter, verse, text) {
  const chapters = books[bookIndex];
  const verses = (chapters[chapter - 1] ??= []);
  if (verses[verse - 1]) throw new Error(`Duplicate verse ${canon[bookIndex].name} ${chapter}:${verse}`);
  verses[verse - 1] = cleanVerse(text);
}

async function loadScrollmapper(source) {
  const data = JSON.parse((await download(source.url)).toString("utf8"));
  if (data.books.length !== canon.length) throw new Error(`Expected 66 books, got ${data.books.length}`);
  const books = emptyBooks();
  // Source names differ from ours ("I Samuel", "Revelation of John") but the order is canonical.
  data.books.forEach((b, bi) => b.chapters.forEach((c) => c.verses.forEach((v) => put(books, bi, c.chapter, v.verse, v.text))));
  return books;
}

async function loadEbibleVpl(source) {
  const text = readZipEntry(await download(source.url), source.entry).toString("utf8");
  const byCode = new Map(canon.map((b, i) => [b.code, i]));
  const books = emptyBooks();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = /^(\S+) (\d+):(\d+) (.*)$/.exec(line);
    if (!m) throw new Error(`Unrecognised line: ${line.slice(0, 80)}`);
    const bi = byCode.get(m[1]);
    if (bi === undefined) continue; // Apocrypha / deuterocanon — not in the 66-book canon
    put(books, bi, Number(m[2]), Number(m[3]), m[4]);
  }
  return books;
}

// ---------------------------------------------------------------------------

function verseCount(books) {
  return books.flat().reduce((n, verses) => n + verses.filter(Boolean).length, 0);
}

function validate(version, books, reference) {
  const problems = [];
  books.forEach((chapters, bi) => {
    const book = canon[bi];
    if (chapters.length !== book.chapters) problems.push(`${book.name}: ${chapters.length} chapters, expected ${book.chapters}`);
    chapters.forEach((verses, ci) => {
      if (!verses || !verses.length) problems.push(`${book.name} ${ci + 1}: empty chapter`);
      // Fill holes (verses a version omits) so verse N stays at index N-1.
      for (let vi = 0; vi < verses.length; vi++) verses[vi] ??= "";
    });
  });
  if (problems.length) throw new Error(`${version.abbreviation} failed checks:\n  ${problems.join("\n  ")}`);

  // Report (not fail on) chapters whose verse count differs from the KJV —
  // real versification differences, useful to know about for highlights.
  if (reference) {
    const diffs = [];
    books.forEach((chapters, bi) =>
      chapters.forEach((verses, ci) => {
        const ref = reference[bi][ci].length;
        if (verses.length !== ref) diffs.push(`${canon[bi].name} ${ci + 1} (${verses.length} vs ${ref})`);
      }),
    );
    if (diffs.length) console.log(`  verse-count differences from KJV: ${diffs.join(", ")}`);
  }
}

function write(version, books) {
  const dir = path.join(OUT_DIR, version.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let bytes = 0;
  let gzipBytes = 0;
  books.forEach((chapters, bi) => {
    const book = canon[bi];
    const json = JSON.stringify({ book: book.name, chapters });
    const file = `${String(bi + 1).padStart(2, "0")}-${book.slug}.json`;
    fs.writeFileSync(path.join(dir, file), json);
    bytes += Buffer.byteLength(json);
    gzipBytes += zlib.gzipSync(json).length;
  });
  return { bytes, gzipBytes };
}

const loaders = { scrollmapper: loadScrollmapper, "ebible-vpl": loadEbibleVpl };

const loaded = new Map();
for (const version of VERSIONS) {
  console.log(`${version.abbreviation}:`);
  loaded.set(version.id, await loaders[version.source.kind](version.source));
}

const manifest = [];
for (const version of VERSIONS) {
  const books = loaded.get(version.id);
  console.log(`${version.abbreviation}: checking`);
  validate(version, books, version.id === "kjv" ? null : loaded.get("kjv"));
  const sizes = write(version, books);
  const verses = verseCount(books);
  console.log(`  ${verses} verses, ${(sizes.bytes / 1e6).toFixed(1)} MB (${(sizes.gzipBytes / 1e6).toFixed(1)} MB compressed)`);
  const { source, ...meta } = version;
  manifest.push({ ...meta, licence: "Public domain", verses, bytes: sizes.bytes, downloadBytes: sizes.gzipBytes });
}

fs.writeFileSync(path.join(OUT_DIR, "versions.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Wrote ${path.relative(ROOT, OUT_DIR)}/versions.json`);
