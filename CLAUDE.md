# CLAUDE.md — Albert Bouchal personal site

Context for continuing this project in Claude Code. Read this before editing — the hero has a
genuinely intricate live instrument with real physics that is easy to break by accident.

## What this is

A single-page personal website for **Albert Bouchal** (co-founder @czechrockets; space / sci-fi
enthusiast; traveller, 35+ countries). It is a plain static site: hand-written HTML/CSS/JS, **no
build step, no framework, no runtime dependencies.** It deploys as-is to GitHub Pages.

Aesthetic: dark by default, minimal/editorial, monospace for numbers and labels, and a single
teal accent reserved for things that are *live* or *interactive*.

## Running & previewing  ⚠️ IMPORTANT

**Serve it over HTTP — do not open `index.html` from `file://`.** `main.js` fetches
`world-map.svg` at runtime and injects it inline. `fetch()` is blocked on `file://`, so on a
`file://` open everything works *except* the map (you'll get the text fallback list). From the
project root:

```
python3 -m http.server 8000      # then open http://localhost:8000
```

(or `npx serve`, or any static server.) On GitHub Pages it's HTTPS, so the map loads fine.

## Deploy (GitHub Pages)

Put all files in the repo root → repo Settings → Pages → Deploy from branch → `main` / root.
(Or name the repo `<username>.github.io`.) There is no build step.

## File map

- **`index.html`** — all structure & content. Sections in order: hero (`#top`), about (`#about`),
  work (`#work`, titled "Selected Work"), favorites (`#favorites`), travel (`#travel`),
  contact (`#contact`).
- **`styles.css`** — the entire design system + every component style. Dark by default; light
  via `@media (prefers-color-scheme: light)`.
- **`main.js`** — all behaviour, in one IIFE, vanilla JS. Hero instruments, map injection +
  interactivity, the country counter, smooth scrolling, etc.
- **`world-map.svg`** — standalone inline SVG world map (Natural Earth, ~175 country paths).
  Visited countries carry `class="country visited"`. It is fetched and injected by `main.js`
  (rather than `<img>`-ed) so the paths stay themeable and interactive.
- **`tools/generate.mjs`** *(optional)* — regenerates the country `<path>` list. See "Editing the map".

## Design system (tokens live in `styles.css` `:root`)

- **Colors (dark):** `--bg #0f0f0f`, `--text #e8e8e8`, `--muted #888`, `--faint #5a5a5a`,
  `--ghost #4a4a4a` (the dim placeholder zeros), `--accent #4ecdc4` (teal), `--line` (hairlines).
  Light-mode equivalents are in the media query (`--ghost #bdbdbd` there).
- **Teal (`--accent`) is reserved for live / interactive / "happening right now."** Don't spend
  it on ordinary decoration.
- **Fonts:** Inter (`--sans`, body & headings) + JetBrains Mono (`--mono`, numbers/labels/data),
  loaded from Google Fonts in `<head>`.
- **Widths:** `--max-wide 1000px` is used for every section now. `--max-text 720px` still exists
  but is effectively legacy (all sections were widened to `--max-wide` per the latest design).
  Gutter: `--gutter clamp(20px,5vw,40px)`.

## The hero: two live instruments — read this before touching it

Under the name/tagline sits `.hero-instruments` (two columns ≥ 920px wide, stacked below). Both
instruments use **real physics — there is no fake or scaled time.**

### 1. Orbital km counter (`.counter`)
Reads: **"You travelled / ↗ N km through space / since you opened this page."** How far Earth has
carried you along its orbit since the page loaded. `EARTH_SPEED_KM_PER_S = 29.783`; value = real
seconds since page open × speed. **This is your real session — time travel does NOT affect it.**

### 2. Earth-rotation clock (`.spin`)
Reads: **"The Earth has rotated / ⟳ X° around its axis / since sunrise"**, plus a circle (faint
full ring + bright teal arc), an "≈ N km carried east" line, and keyboard hints.

- **Angle = degrees since the most recent sunrise in Prague.** Earth turns 15°/h, so
  `degrees = hoursSinceSunrise × 15`. On load it already shows a real, substantial arc (e.g.
  mid-afternoon ≈ a half-circle) — that's the whole point of anchoring to sunrise.
- **Sunrise** uses the NOAA / "Almanac for Computers" algorithm: `sunriseMs(y,mo,d,lat,lon)`
  returns a UTC timestamp; `lastSunriseMs(now)` returns today's or yesterday's sunrise as
  appropriate. Verified accurate for Prague (≈ 04:55 summer, 07:58 winter, 06:06 equinox).
- **Arc geometry:** `RING = {cx:80, cy:80, r:64}` in a 160×160 viewBox. `arcPath(deg)` sweeps
  **counter-clockwise from 12 o'clock** (Earth's eastward spin seen from above the North Pole).
  `headXY(deg)` positions the leading dot.
- **Distance east:** `SURFACE_M_PER_S = 40075017·cos(lat)/86400 ≈ 298 m/s` at Prague's latitude.

### Time travel (keyboard) — scrubs the rotation clock ONLY
- **Tap `A` / `D`** = step the clock ∓ / ± 1 hour. **Hold** = an accelerating cruise (~1 → 12 h/s)
  that sails through days; the arc resets at each dawn as you pass it. **`S`** = snap back to now.
- A `timeOffsetMs` is added to `Date.now()` → `effNow()`. Tap vs. hold vs. cruise is handled with
  keydown/keyup + an rAF cruise loop (`onKey`, `cruiseLoop`). The status line shows the simulated
  Prague time + offset (Intl `Europe/Prague`) and reads "live" at offset 0; `.spin.traveling`
  highlights it. **Only the rotation clock reads `effNow()`; the km counter uses real elapsed time.**

### Ghost placeholder zeros (the big numbers)
- The big numbers show **dim leading zeros that "fill in"** as the value grows. `fmtKm` pads km to
  6 digits with thousands grouping; `fmtDeg` pads the whole-degree part to 3. `splitPadded()` wraps
  everything before the first significant digit in `<span class="num-ghost">` (color `--ghost`);
  the remainder inherits the bright accent.
- This also keeps the field a fixed width, so the unit text never shifts. **There is intentionally
  no `min-width` slot — don't add one back.**
- If the zeros ever look invisible, that's a **contrast** issue with `--ghost`, not a JS bug: the
  spans are regenerated on every change (confirmed).

### Render loop & efficiency
One `requestAnimationFrame` loop (`tickCounters`) updates everything, but it **only writes to the
DOM when a displayed value actually changes** (a `disp{}` cache + a `put()` helper), so identical
frames don't re-parse HTML or thrash layout. Keep that pattern if you add readouts.

## Travel section & map

`#travel` fetches `world-map.svg` into `.map-scroll`, then wires up the visited countries
(tooltips, keyboard focus) with a text-list fallback if the fetch fails. The country counter
animates up to `TOTAL_COUNTRIES`. There is also an "IN THE AIR" / Flightradar24 block intended as
an optional live-flight banner, with a graceful fallback when it isn't configured.

## Editing the map / marking a visited country

Two ways:

1. **Quick (recommended):** in `world-map.svg`, find the country's `<path …>` and change
   `class="country"` → `class="country visited"` (optionally add `data-slug` / `data-name`). Then
   bump `TOTAL_COUNTRIES` in `main.js` if you want the counter to match.
2. **Regenerate (optional):** edit the `VISITED` map in `tools/generate.mjs`, then
   `cd tools && npm install && node generate.mjs`. It writes `paths.txt` (the `<path>` list); paste
   that into the `<g class="world">…</g>` group in `world-map.svg`. Deps: `topojson-client`,
   `d3-geo`, `world-atlas` (see `tools/package.json`).

## Tweakable knobs (near the top of the hero block in `main.js`)

- `LAT_DEG`, `LON_DEG` — location; drives sunrise + metres-east. Keep the hero geo-stamp in sync.
- `EARTH_SPEED_KM_PER_S`, `SURFACE_M_PER_S` — orbital / surface speeds.
- `RING` — clock circle geometry; sweep direction is inside `arcPath`.
- Cruise feel — the `rate` ramp in `cruiseLoop`; the ±1 h step in `onKey`.
- Ghost field widths — `padStart(6, …)` in `fmtKm`, `padStart(3, …)` in `fmtDeg`.
- `TOTAL_COUNTRIES` — the count-up animation target.

## TODOs (real content for Albert — search `index.html` for "TODO Albert")

- Real GitHub / LinkedIn / email / X URLs and the @czechrockets profile link.
- Project details in "Selected Work" (names, links, blurbs).
- Mark the remaining visited countries (see above) and set `TOTAL_COUNTRIES`.
- Favorites: real links / logos for "in the kit".
- Flightradar24 banner: wire up a real feed or remove it.
- Replace any placeholder copy in About / Contact.

## Conventions & gotchas

- No runtime dependencies — keep it that way unless there's a strong reason.
- Everything is one IIFE in `main.js`; guard DOM lookups (elements can be absent).
- Accessibility: instruments have `.sr-only` descriptions and the visuals are `aria-hidden`. Keep
  that split. Reduced motion: `prefersReduced` gates the count-up animation.
- Don't reintroduce a `min-width` slot on the big numbers — the ghost padding handles width.
- The map must be served over HTTP (see "Running").

## Recent state (last working session)

- Rebuilt the rotation instrument as the **sunrise clock** (CCW arc from 12 o'clock, real degrees
  since sunrise) with **keyboard time-travel**.
- Matched both hero readouts' styling and added the "You travelled" / "The Earth has rotated"
  labels.
- Added the **ghost placeholder zeros**; widened all sections to `--max-wide`.
- Bumped `--ghost` contrast (dark `#4a4a4a` / light `#bdbdbd`) so the zeros are clearly visible,
  and made the rAF loop write to the DOM only when a value changes.
