# imagecompress

Bulk lossy image compression, in place. Walks a folder recursively and rewrites every image in its own format, only when the result is smaller. **The originals are overwritten**, so work on a copy or a git-tracked folder.

| Format | Engine |
| --- | --- |
| JPEG | sharp (mozjpeg) |
| PNG | sharp (palette quantisation) |
| WebP, AVIF, TIFF | sharp |
| GIF (also animated) | sharp |
| SVG | svgo (ids and unknown attributes are kept) |

EXIF orientation is applied and then metadata is dropped; the ICC profile is kept.

```sh
npm install
node compress.js --dir ~/path/to/images
node compress.js --dir ~/path/to/images --quality 70 --max 2560
node compress.js --dir ~/path/to/images --dry-run
```

| Option | Meaning |
| --- | --- |
| `--dir` | Folder to process (required) |
| `--quality` | 1-100 for JPEG, PNG, WebP, AVIF, TIFF (default 75) |
| `--max` | Shrink images whose longer side exceeds this many pixels; never enlarges |
| `--concurrency` | Files processed in parallel (default: cores, at most 4) |
| `--dry-run` | Report the savings, write nothing |

Compression is lossy, so running it again on the same files loses a little more quality each time.

Needs Node 20.3 or newer. Skips `.git`, `node_modules` and dotfiles.
