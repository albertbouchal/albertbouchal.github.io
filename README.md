# Albert Bouchal — personal site

A single-page personal site. Plain HTML / CSS / JS, no build step, no runtime dependencies. Dark
by default, with a live "you are moving through space" hero (an orbital-distance counter and an
Earth-rotation clock you can scrub through time with the keyboard) and an interactive travel map.

## Run locally

Serve over HTTP — the world map is fetched at runtime, so opening the file directly (`file://`)
won't load it:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

(Any static server works: `npx serve`, etc.)

## Deploy

Push to GitHub and enable Pages (main branch, root). No build step.

## Files

| File | What |
|------|------|
| `index.html` | structure & content |
| `styles.css` | design system & component styles |
| `main.js` | behaviour: hero instruments, map injection, interactions |
| `world-map.svg` | the world map (visited countries flagged) |
| `tools/` | optional script to regenerate the map's country paths |

## Hero keyboard controls

While the page is focused: **`D`** forward, **`A`** back (tap = ±1 h, hold = fast cruise),
**`S`** = back to now. This scrubs the Earth-rotation clock; the distance counter stays on real time.

See **`CLAUDE.md`** for full architecture notes, the physics behind the instruments, tweakable
knobs, and the content TODO list.
