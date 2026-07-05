// Fetches Albert's Flightradar24 summary banner (a small server-rendered PNG — FR24 doesn't
// expose these personal totals as JSON) and OCRs it with tesseract to pull out the three
// numbers it always contains: flights tracked, km flown, hours in the air. Writes
// ../fr24-stats.json only when a number actually changed, so the GitHub Actions workflow
// (.github/workflows/fr24-update.yml) that runs this every two weeks can skip empty commits.
// Requires the `tesseract` and `convert` (ImageMagick) CLIs on PATH — see the workflow for setup.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// TODO Albert: keep in sync with the username in index.html's fr24-frame link if it ever changes.
const FR24_USER = 'albert96';
const BANNER_URL = `https://banners-my.flightradar24.com/${FR24_USER}.png`;
const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'fr24-stats.json');

async function main() {
  const res = await fetch(BANNER_URL);
  if (!res.ok) throw new Error(`Fetching banner failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const work = mkdtempSync(join(tmpdir(), 'fr24-'));
  const raw = join(work, 'raw.png');
  const scaled = join(work, 'scaled.png');
  writeFileSync(raw, buf);

  try {
    // Tesseract chokes on FR24's small (320x70) banner at native size. Upscaling helps, but
    // only with nearest-neighbor sampling (`-sample`, not `-resize`) — the latter's smoothing
    // filter blurs the thin font strokes and *causes* misreads (verified locally: "55"→"SS",
    // "km"→dropped) that crisp nearest-neighbor scaling doesn't.
    execFileSync('convert', [raw, '-sample', '300%', scaled]);
    const text = execFileSync('tesseract', [scaled, 'stdout', '--psm', '6'], { encoding: 'utf8' });

    const flightsM = text.match(/(\d+)\s*flights/i);
    const kmM = text.match(/([\d,]+)\s*km/i);
    const hoursM = text.match(/(\d+)\s*h\s*(\d+)\s*min/i);
    if (!flightsM || !kmM || !hoursM) {
      throw new Error(`Could not parse OCR output:\n${text}`);
    }

    const stats = {
      flights: parseInt(flightsM[1], 10),
      km: parseInt(kmM[1].replace(/,/g, ''), 10),
      hours: parseInt(hoursM[1], 10),
      minutes: parseInt(hoursM[2], 10),
      updated: new Date().toISOString().slice(0, 10),
    };

    const prev = existsSync(OUT_PATH) ? JSON.parse(readFileSync(OUT_PATH, 'utf8')) : null;
    const changed = !prev || ['flights', 'km', 'hours', 'minutes'].some((k) => prev[k] !== stats[k]);

    if (changed) {
      writeFileSync(OUT_PATH, JSON.stringify(stats, null, 2) + '\n');
      console.log('fr24-stats.json updated:', stats);
    } else {
      console.log('No change in FR24 stats — nothing to commit.');
    }

    if (process.env.GITHUB_OUTPUT) {
      writeFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`, { flag: 'a' });
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
