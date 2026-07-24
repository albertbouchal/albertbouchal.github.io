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
  (rather than `<img>`-ed) so the paths stay themeable and interactive. **It is also the single
  source of truth for how many countries are marked** — `main.js` counts the highlighted paths.
- **`travel.html`** — shared template for a per-country write-up, addressed as
  `/travel.html?c=<slug>`. Reads `window.TRAVEL` and fills itself in from a small inline script.
- **`travel-data.js`** — the write-up content, one entry per slug (must match the map's
  `data-slug`). Adding an entry is what publishes a write-up: the country's pill becomes a link
  and clicking it on the map navigates there.
- **`fr24-stats.json`** — flight totals rendered in the travel section. Machine-written; don't
  hand-edit. Refreshed by `.github/workflows/fr24-update.yml` on the 1st & 15th, which runs
  **`tools/fetch-fr24.mjs`** (OCRs Albert's FR24 banner — FR24 exposes no data API) and commits
  only when a number changed.
- **`tools/generate.mjs`** *(optional)* — regenerates the country `<path>` list. See "Editing the map".

## Design system (tokens live in `styles.css` `:root`)

- **Colors (dark):** `--bg #0f0f0f`, `--text #e8e8e8`, `--muted #888`, `--faint #5a5a5a`,
  `--ghost #4a4a4a` (the dim placeholder zeros), `--accent #4ecdc4` (teal), `--line` (hairlines).
  Light-mode equivalents are in the media query (`--ghost #bdbdbd` there).
- **Teal (`--accent`) is reserved for live / interactive / "happening right now."** Don't spend
  it on ordinary decoration.
- **Fonts:** Inter (`--sans`, body & headings) + JetBrains Mono (`--mono`, numbers/labels/data),
  loaded from Google Fonts in `<head>`.
- **Widths:** `--max-wide 1000px` is used for every section on the main page. `--max-text 720px`
  is **not** legacy — it's what keeps `.trav-body` readable on `travel.html`.
  Gutter: `--gutter clamp(20px,5vw,40px)`.
- **`.wide`** is currently a no-op: `main` is already `max-width: var(--max-wide)`, so the
  `<div class="wide">` wrappers constrain nothing. They're kept deliberately as the hook for
  narrowing the prose sections again later — don't "clean them up" without asking.
- **The two hero instruments share one set of `.inst-*` rules** (`.inst-label`, `.inst-readout`,
  `.inst-arrow`, `.inst-num`, `.inst-unit`, `.inst-sub`, `.inst-track`, `.inst-foot`). Only
  genuinely instrument-specific bits are modifiers (`.counter-sub` adds flex for the live dot,
  `.counter-foot` its own spacing). Style the shared class, not one instrument.

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
  **counter-clockwise from 12 o'clock** (Earth's eastward spin seen from above the North Pole),
  emitting two SVG `A` commands — split at the midpoint so the large-arc flag is always 0 and so
  360° still closes the ring (one `A` can't draw a full circle). `headXY(deg)` positions the
  leading dot.
- **Distance east:** `SURFACE_M_PER_S = 40075017·cos(lat)/86400 ≈ 298 m/s` at Prague's latitude.

### Time travel (keyboard) — scrubs the rotation clock ONLY
- **Tap `A` / `D`** = step the clock ∓ / ± 1 hour. **Hold** = an accelerating cruise (~1 → 12 h/s)
  that sails through days; the arc resets at each dawn as you pass it. **`S`** = snap back to now.
- A `timeOffsetMs` is added to `Date.now()` → `effNow()`. Tap vs. hold vs. cruise is handled with
  keydown/keyup + an rAF cruise loop (`onKey`, `cruiseLoop`). The status line shows the simulated
  Prague time + offset (Intl `Europe/Prague`) and reads "live" at offset 0; `.spin.traveling`
  highlights it. **Only the rotation clock reads `effNow()`; the km counter uses real elapsed time.**
- `onKey` **bails on any modifier key before calling `preventDefault()`.** Without that, the page
  swallows Cmd/Ctrl+A, +S and +D. Don't remove the guard.
- `cruiseLoop` keeps running while *either* key is held, even when A and D cancel out — stopping
  on `dir === 0` would leave the cruise dead after you release one of them.

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
One `requestAnimationFrame` loop (`tickCounters`) updates everything, and **writes to the DOM only
when a displayed value actually changes** — a `disp{}` cache plus a `put(el, key, val, apply)`
helper, where `apply` picks the sink (`asHTML` / `asD` / `asPoint`, default `textContent`). Use
`put()` for any readout you add rather than hand-rolling another cache.

Measured over 10 s at 60 fps, the guard skips ~50% of km writes, ~75% of arc writes and ~99% of
head-dot writes. Two caveats worth knowing:

- **The guard is on writes, not on work.** Every frame still recomputes everything, including a
  full NOAA sunrise solve (`lastSunriseMs`) for a value that changes once a day. It's a handful of
  trig ops, so it's been left alone deliberately — simpler beats marginally faster here.
- **The ping dot moves nearly every frame** (~97%), so its cache buys almost nothing. It goes
  through `put()` anyway for uniformity, not for speed.

## Travel section & map

`#travel` fetches `world-map.svg` into `.map-scroll`, then wires up the visited countries
(tooltips, keyboard focus) with a text-list fallback if the fetch fails. **The country count is
derived from the map** — `initMap()` passes `visitedPaths.length` to `initCount()`, which fills
both `#country-total` (the heading) and `#country-count` (the animated figure). The numbers written
into `index.html` are only the no-JS / map-failed fallback. There is also an "IN THE AIR" /
Flightradar24 card fed by `fr24-stats.json`; it hides itself entirely if the fetch fails.

## Editing the map / marking a visited country

Two ways:

1. **Quick (recommended):** in `world-map.svg`, find the country's `<path …>` and change
   `class="country"` → `class="country visited"` (add `data-slug` / `data-name` — the list and
   tooltips need them). Nothing else to update: the counter reads the map. Optionally refresh the
   fallback numbers in `index.html` so no-JS visitors see the right figure.
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
- `PING_DIST_KM` — km per Prague–Amsterdam leg. The *curve* the dot follows is not a knob here:
  it's the `d` on `<path class="ping-rail">` in `index.html`, which `main.js` samples with
  `getPointAtLength()`. Edit the path and the dot follows.

## TODOs (real content for Albert — search `index.html` for "TODO Albert")

- Real GitHub / LinkedIn / email / X URLs and the @czechrockets profile link.
- Project details in "Selected Work" (names, links, blurbs) — two placeholder `.proj` slots wait.
- Mark the remaining visited countries (see above).
- Favorites: real links / logos for "in the kit".
- Travel write-ups: add entries to `travel-data.js` (only `czech-republic` exists, and it's a
  placeholder).
- Replace any placeholder copy in About / Contact.

## Conventions & gotchas

- No runtime dependencies — keep it that way unless there's a strong reason.
- Everything is one IIFE in `main.js`; guard DOM lookups (elements can be absent).
- Accessibility: instruments have `.sr-only` descriptions and the visuals are `aria-hidden`. Keep
  that split. Reduced motion: `prefersReduced` gates the count-up animation.
- Don't reintroduce a `min-width` slot on the big numbers — the ghost padding handles width.
- The map must be served over HTTP (see "Running").

## Recent state (last working session — simplification pass)

A review pass aimed at cutting complexity **without changing the design or any behaviour**:

- **Two bug fixes:** `onKey` no longer swallows Cmd/Ctrl+A/S/D; `cruiseLoop` no longer deadlocks
  when A and D are held together.
- **`arcPath` draws two SVG `A` arcs** instead of generating a ~62-point polyline every frame.
  Verified identical: endpoints match exactly at every angle, and the old chords sat 0.0097px
  inside the true circle against a 3px stroke. Path strings went from up to 2,314 chars to ~60.
- **The ping curve has one definition.** `PING_P` and the hand-written bezier evaluator are gone;
  `main.js` samples `.ping-rail` with `getPointAtLength()`.
- **`put()` took over the three hand-rolled caches** (ping dot, arc, head dot) via `apply` sinks.
- **Duplicate CSS merged** into the shared `.inst-*` rules (the `.counter-*`/`.spin-*`/`.ping-*`
  typography was written twice, near byte-identical).
- **The country count derives from the map** (`initCount(visitedPaths.length)`); `TOTAL_COUNTRIES`
  is gone, as is the never-disconnected IntersectionObserver.
- **`hasWriteUp()` / `writeUpHref()`** replace four copies of the `window.TRAVEL` lookup.
- Removed the footer "Source" links from both pages; dropped stale TODOs; moved orphaned rules at
  the end of `styles.css` back into their sections.

Kept deliberately: the `.wide` wrappers, `--max-text`, the placeholder project slots, the
`travel-data.js` plumbing, and the FR24 OCR script.
