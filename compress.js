#!/usr/bin/env node
// Bulk lossy image compression, in place.
//   node compress.js --dir <folder> [--quality 75] [--max 2560] [--dry-run] [--concurrency 4]
// Keeps every file's format, overwrites it only when the result is smaller.

import { readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { optimize } from 'svgo';

const { values: opts } = parseArgs({
  options: {
    dir: { type: 'string' },
    quality: { type: 'string', default: '75' },
    max: { type: 'string' },
    concurrency: { type: 'string', default: String(Math.min(availableParallelism(), 4)) },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (opts.help || !opts.dir) {
  console.log(`Usage: node compress.js --dir <folder> [options]

  --dir <folder>       folder to process recursively (files are overwritten in place)
  --quality <1-100>    quality for JPEG, WebP, AVIF, TIFF and PNG (default 75)
  --max <pixels>       shrink images whose longer side exceeds this (never enlarges)
  --concurrency <n>    parallel files (default min(cores, 4))
  --dry-run            report the savings without writing anything

Handles JPEG, PNG, WebP, AVIF, GIF, TIFF and SVG.`);
  process.exit(opts.help ? 0 : 1);
}

const quality = Number(opts.quality);
const maxSide = opts.max ? Number(opts.max) : null;
const concurrency = Math.max(1, Number(opts.concurrency));
if (!(quality >= 1 && quality <= 100) || (maxSide !== null && !(maxSide > 0)) || !(concurrency >= 1)) {
  console.error('Invalid --quality, --max or --concurrency value.');
  process.exit(1);
}

const root = resolve(opts.dir);
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.tif', '.tiff', '.svg']);

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    totals.failed++;
    console.error(`! ${dir.slice(root.length + 1) || '.'}  ${error.message}`);
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(join(dir, entry.name));
    } else if (entry.isFile() && !entry.name.startsWith('.') && EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      yield join(dir, entry.name);
    }
  }
}

async function compressRaster(file, ext) {
  let image = sharp(file, { animated: ext === '.gif' || ext === '.webp', failOn: 'none' }).rotate().keepIccProfile();
  if (maxSide) image = image.resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true });

  switch (ext) {
    case '.jpg':
    case '.jpeg':
      image = image.jpeg({ quality, mozjpeg: true });
      break;
    case '.png':
      image = image.png({ quality, palette: true, effort: 10, compressionLevel: 9 });
      break;
    case '.webp':
      image = image.webp({ quality, effort: 6 });
      break;
    case '.avif':
      image = image.avif({ quality, effort: 6 });
      break;
    case '.gif':
      image = image.gif({ effort: 10 });
      break;
    case '.tif':
    case '.tiff':
      image = image.tiff({ quality, compression: 'jpeg' });
      break;
  }
  return image.toBuffer();
}

async function compressSvg(file) {
  const svg = await readFile(file, 'utf8');
  // Keep ids and unknown attributes: they are often referenced from CSS/JS.
  const { data } = optimize(svg, {
    path: file,
    multipass: true,
    plugins: [{ name: 'preset-default', params: { overrides: { cleanupIds: false, removeUnknownsAndDefaults: false } } }],
  });
  return Buffer.from(data);
}

const totals = { files: 0, written: 0, kept: 0, failed: 0, before: 0, after: 0 };

async function processFile(file) {
  const ext = extname(file).toLowerCase();
  const rel = file.slice(root.length + 1);
  try {
    const { size: before, mode } = await stat(file);
    const output = ext === '.svg' ? await compressSvg(file) : await compressRaster(file, ext);
    totals.files++;
    totals.before += before;
    if (output.length >= before) {
      totals.kept++;
      totals.after += before;
      console.log(`= ${rel}  ${fmt(before)} (already optimal)`);
      return;
    }
    totals.written++;
    totals.after += output.length;
    if (!opts['dry-run']) {
      const tmp = join(dirname(file), `.${basename(file)}.tmp`);
      try {
        await writeFile(tmp, output, { mode });
        await rename(tmp, file);
      } catch (error) {
        await unlink(tmp).catch(() => {});
        throw error;
      }
    }
    console.log(`- ${rel}  ${fmt(before)} -> ${fmt(output.length)} (-${Math.round((1 - output.length / before) * 100)}%)`);
  } catch (error) {
    totals.failed++;
    console.error(`! ${rel}  ${error.message}`);
  }
}

function fmt(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${bytes} B`;
}

sharp.cache(false);

const queue = [];
for await (const file of walk(root)) queue.push(file);
await Promise.all(
  Array.from({ length: Math.min(concurrency, queue.length || 1) }, async () => {
    while (queue.length) await processFile(queue.shift());
  }),
);

const saved = totals.before - totals.after;
console.log(
  `\n${totals.files} files, ${totals.written} ${opts['dry-run'] ? 'would be ' : ''}rewritten, ${totals.kept} kept, ${totals.failed} failed` +
    `\n${fmt(totals.before)} -> ${fmt(totals.after)}  (saved ${fmt(saved)}${totals.before ? `, ${Math.round((saved / totals.before) * 100)}%` : ''})`,
);
process.exitCode = totals.failed ? 1 : 0;
