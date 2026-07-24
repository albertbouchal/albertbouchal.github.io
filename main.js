/* main.js — behaviour for Albert Bouchal's site.
   Loads the world map from world-map.svg, then wires up the interactive bits.
   No build step, no dependencies. Served over http(s) (e.g. GitHub Pages) so the
   relative fetch below resolves against the page URL. */
(function () {
  'use strict';

  /* ---------- Footer year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Hero instruments: orbital km counter + an Earth-rotation clock ---------- */
  var EARTH_SPEED_KM_PER_S = 29.783;          // orbital speed around the Sun
  var LAT_DEG = 50.08, LON_DEG = 14.44;       // Prague — matches the hero geo-stamp
  var EQ_CIRCUMFERENCE_M = 40075017;          // WGS84 equatorial circumference, metres
  // Eastward surface speed at this latitude (~298 m/s at Prague): circumference·cosφ / day.
  var SURFACE_M_PER_S = (EQ_CIRCUMFERENCE_M * Math.cos(LAT_DEG * Math.PI / 180)) / 86400;
  var PING_DIST_KM = 890;                     // Prague–Amsterdam great-circle, km (~30 s at orbital speed)

  // --- Sunrise (NOAA / "Almanac for Computers"): sunrise on a UTC date, as a UTC timestamp ---
  function rad(d) { return d * Math.PI / 180; }
  function deg(r) { return r * 180 / Math.PI; }
  function nrm(v, m) { v %= m; if (v < 0) v += m; return v; }
  function sunriseMs(y, mo, d, lat, lon) {
    var N = Math.floor((Date.UTC(y, mo - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
    var lngHour = lon / 15, t = N + (6 - lngHour) / 24;
    var M = 0.9856 * t - 3.289;
    var L = nrm(M + 1.916 * Math.sin(rad(M)) + 0.020 * Math.sin(rad(2 * M)) + 282.634, 360);
    var RA = nrm(deg(Math.atan(0.91764 * Math.tan(rad(L)))), 360);
    RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
    var sinDec = 0.39782 * Math.sin(rad(L)), cosDec = Math.cos(Math.asin(sinDec));
    var cosH = (Math.cos(rad(90.833)) - sinDec * Math.sin(rad(lat))) / (cosDec * Math.cos(rad(lat)));
    if (cosH > 1 || cosH < -1) return null;                  // sun never rises / never sets
    var H = (360 - deg(Math.acos(cosH))) / 15;
    var UT = nrm(H + RA - 0.06571 * t - 6.622 - lngHour, 24);
    return Date.UTC(y, mo - 1, d) + Math.round(UT * 3600000);
  }
  function lastSunriseMs(nowMs) {
    var dt = new Date(nowMs);
    var sr = sunriseMs(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), LAT_DEG, LON_DEG);
    if (sr == null) return null;
    if (sr > nowMs) {                                        // before today's sunrise → use yesterday's
      var p = new Date(nowMs - 86400000);
      sr = sunriseMs(p.getUTCFullYear(), p.getUTCMonth() + 1, p.getUTCDate(), LAT_DEG, LON_DEG);
    }
    return sr;
  }

  // --- Time travel (scrubs the rotation clock only; the km counter stays your real session).
  //     Tap A / D = step ∓ / ± 1 h; hold to cruise (accelerates ~1→12 h/s); S = back to now. ---
  var timeOffsetMs = 0, HELD = {}, holdStart = {}, cruising = false, lastCruiseT = 0;
  function effNow() { return Date.now() + timeOffsetMs; }
  function travelDir() { return (HELD.d ? 1 : 0) - (HELD.a ? 1 : 0); }
  function cruiseLoop(now) {
    // Keep looping while either key is down. A and D held together cancel out (dir === 0) but
    // must NOT stop the loop, or releasing one would leave the cruise dead until the next press.
    if (!HELD.a && !HELD.d) { cruising = false; lastCruiseT = 0; return; }
    var dir = travelDir();
    var dt = lastCruiseT ? (now - lastCruiseT) : 16; lastCruiseT = now;
    if (dir) {
      var heldFor = (now - (holdStart[dir > 0 ? 'd' : 'a'] || now)) / 1000;
      var rate = Math.min(12, 1 + heldFor * 4.5);           // hours per second, ramps over ~2.5 s
      timeOffsetMs += dir * rate * 3600000 * (dt / 1000);
    }
    requestAnimationFrame(cruiseLoop);
  }
  function onKey(e, down) {
    // Never swallow browser shortcuts — Cmd/Ctrl+A, +S and +D all collide with these keys.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    var key = (e.key || '').toLowerCase();
    if (key !== 'a' && key !== 'd' && key !== 's') return;
    e.preventDefault();
    if (key === 's') { if (down) timeOffsetMs = 0; return; }
    if (down) {
      if (HELD[key]) return;                                // ignore the OS key-repeat
      HELD[key] = true; holdStart[key] = performance.now();
      timeOffsetMs += (key === 'a' ? -1 : 1) * 3600000;     // instant ±1 h nudge on press
      if (!cruising) { cruising = true; lastCruiseT = 0; requestAnimationFrame(cruiseLoop); }
    } else { delete HELD[key]; }
  }
  window.addEventListener('keydown', function (e) { onKey(e, true); });
  window.addEventListener('keyup', function (e) { onKey(e, false); });

  // --- Clock geometry: a faint full ring with a bright arc swept counter-clockwise from 12 o'clock ---
  var RING = { cx: 80, cy: 80, r: 64 };
  function headXY(a) { var t = rad(nrm(a, 360)); return [RING.cx - RING.r * Math.sin(t), RING.cy - RING.r * Math.cos(t)]; }
  function xy(p) { return p[0].toFixed(2) + ',' + p[1].toFixed(2); }
  // Drawn as two ≤180° sweeps so the large-arc flag is always 0; sweep-flag 0 reads
  // counter-clockwise on screen. The midpoint split is also what lets a = 360° close the ring —
  // a single A command can't. (Previously this emitted a 62-point polyline approximating the
  // same circle; the chords sat ≤0.01px inside it, so the drawn result is unchanged.)
  function arcPath(a) {
    a = nrm(a, 360);
    if (a < 0.01) return '';                                // the first instants after dawn
    var r = RING.r + ',' + RING.r + ' 0 0 0 ';
    return 'M' + xy(headXY(0)) + 'A' + r + xy(headXY(a / 2)) + 'A' + r + xy(headXY(a));
  }
  // Ping dot position, read straight off the flight arc already drawn in index.html
  // (<path class="ping-rail">) so the curve has exactly one definition. main.js is deferred,
  // so the DOM is parsed by the time this runs.
  var pingRail = document.querySelector('.ping-rail');
  var pingLen = pingRail ? pingRail.getTotalLength() : 0;
  function pingXY(t) {                             // rail is drawn AMS→PRG, so t = 0 is PRG
    var p = pingRail.getPointAtLength(pingLen * (1 - t));
    return [p.x, p.y];
  }

  var pageOpenTime = performance.now();
  var prefersReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var kmEl = document.getElementById('km-counter');
  var degEl = document.getElementById('deg-counter');
  var distEl = document.getElementById('spin-dist');
  var arcEl = document.getElementById('spin-arc');
  var headEl = document.getElementById('spin-head');
  var ttEl = document.getElementById('spin-tt');
  var spinBlock   = document.querySelector('.spin');
  var pingDotEl   = document.getElementById('ping-dot');
  var pingCountEl = document.getElementById('ping-count');
  var pragueFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', weekday: 'short', hour: '2-digit', minute: '2-digit' });

  function fmtOffset(ms) {
    var sign = ms < 0 ? '−' : '+', a = Math.abs(ms);
    var dd = Math.floor(a / 86400000), hh = Math.floor(a % 86400000 / 3600000), mm = Math.floor(a % 3600000 / 60000);
    if (dd) return sign + dd + ' d ' + hh + ' h';
    if (hh) return sign + hh + ' h' + (mm ? ' ' + mm + ' m' : '');
    return sign + mm + ' m';
  }

  // Wrap the leading zeros (the placeholder padding) in a dim span so the field always looks
  // full and "fills in" from the left as the real number grows. Everything from the first
  // significant digit onward stays bright (inherits the accent colour).
  function splitPadded(s) {
    var idx = -1;
    for (var i = 0; i < s.length; i++) { if (s[i] >= '1' && s[i] <= '9') { idx = i; break; } }
    if (idx === -1) idx = s.length - 1;            // all zeros → keep the last digit bright
    return '<span class="num-ghost">' + s.slice(0, idx) + '</span>' + s.slice(idx);
  }
  function fmtKm(v) {                               // e.g. 5495 → "005,495" (00 dim, 5,495 bright)
    var s = String(Math.round(v)).padStart(6, '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return splitPadded(s);
  }
  function fmtDeg(v) {                              // e.g. 1.45 → "001.45°" (00 dim, 1.45° bright)
    var f = v.toFixed(2).split('.');
    return splitPadded(f[0].padStart(3, '0') + '.' + f[1]) + '°';
  }

  // Only touch the DOM when a value actually changes. The rAF loop runs every frame, but most
  // frames recompute a string identical to the last one — measured over 10 s at 60 fps, the km
  // readout repeats on ~50% of frames, the arc path on ~75%, and the head dot on ~99%. `apply`
  // picks the sink; the default is textContent.
  var disp = {};
  function put(el, key, val, apply) {
    if (!el || disp[key] === val) return;
    disp[key] = val;
    if (apply) apply(el, val); else el.textContent = val;
  }
  function asHTML(el, v) { el.innerHTML = v; }
  function asD(el, v) { el.setAttribute('d', v); }
  function asPoint(el, v) { var p = v.split(','); el.setAttribute('cx', p[0]); el.setAttribute('cy', p[1]); }

  function tickCounters() {
    // orbital km — your real session, never time-travelled
    var elapsedKm = (performance.now() - pageOpenTime) / 1000 * EARTH_SPEED_KM_PER_S;
    put(kmEl, 'km', fmtKm(elapsedKm), asHTML);

    // ping: dot bounces PRG→AMS→PRG every PING_DIST_KM (~30 s per leg)
    if (pingLen) {
      var cycle = elapsedKm % (2 * PING_DIST_KM);
      var pingT = cycle <= PING_DIST_KM ? cycle / PING_DIST_KM : (2 * PING_DIST_KM - cycle) / PING_DIST_KM;
      put(pingDotEl, 'pingDot', xy(pingXY(pingT)), asPoint);
    }
    put(pingCountEl, 'pingCount', Math.floor(elapsedKm / PING_DIST_KM).toLocaleString());

    // Earth-rotation clock — driven by the (possibly time-travelled) effective clock
    var now = effNow();
    var sr = lastSunriseMs(now);
    if (sr != null) {
      var hrs = (now - sr) / 3600000;
      var degSince = hrs * 15;                              // Earth turns 15°/h
      put(degEl, 'deg', fmtDeg(degSince), asHTML);
      put(distEl, 'dist', Math.round(hrs * 3600 * SURFACE_M_PER_S / 1000).toLocaleString());
      put(arcEl, 'arc', arcPath(degSince), asD);
      put(headEl, 'head', xy(headXY(degSince)), asPoint);
    }

    // time-travel status line
    if (ttEl) {
      if (timeOffsetMs === 0) { put(ttEl, 'tt', 'live'); if (spinBlock) spinBlock.classList.remove('traveling'); }
      else { put(ttEl, 'tt', pragueFmt.format(new Date(now)) + ' · ' + fmtOffset(timeOffsetMs)); if (spinBlock) spinBlock.classList.add('traveling'); }
    }
    requestAnimationFrame(tickCounters);
  }
  if (kmEl || degEl) requestAnimationFrame(tickCounters);

  /* ---------- Country count: derived from the map, animated when scrolled into view ----------
     The highlighted paths in world-map.svg are the single source of truth — initMap() passes
     their count in. The numbers hard-coded in index.html are only the static fallback for when
     the map can't load (or JS is off), and are overwritten here as soon as it does. */
  function initCount(total) {
    var countEl = document.getElementById('country-count');
    var totalEl = document.getElementById('country-total');
    var travel = document.getElementById('travel');
    if (totalEl) totalEl.textContent = total;
    if (!countEl || !travel) return;
    if (prefersReduced || !('IntersectionObserver' in window)) { countEl.textContent = total; return; }
    countEl.textContent = '0';
    new IntersectionObserver(function (entries, obs) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      obs.disconnect();                                     // count up once, then stop watching
      var start = performance.now(), dur = 900;
      (function tick(now) {
        var t = Math.min(1, (now - start) / dur);
        countEl.textContent = Math.round((1 - Math.pow(1 - t, 3)) * total);
        if (t < 1) requestAnimationFrame(tick);
      })(start);
    }, { threshold: 0.4 }).observe(travel);
  }

  /* ---------- Active nav link while scrolling ---------- */
  if ('IntersectionObserver' in window) {
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
    var lookup = {};
    navLinks.forEach(function (a) { lookup[a.getAttribute('href').slice(1)] = a; });
    var navObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          navLinks.forEach(function (a) { a.classList.remove('active'); });
          var a = lookup[en.target.id];
          if (a) a.classList.add('active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('#content section[id]').forEach(function (s) { navObs.observe(s); });
  }

  /* ---------- Sticky header hairline on scroll ---------- */
  var head = document.querySelector('.site-head');
  function onScroll() { if (head) head.classList.toggle('scrolled', window.scrollY > 8); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- World map: fetch world-map.svg, inject it, then wire interactions ---------- */
  var scroller = document.querySelector('.map-scroll');

  // A country has a write-up once it gets an entry in travel-data.js, keyed by the same
  // data-slug the map path carries. That turns its pill into a link and makes the map clickable.
  function hasWriteUp(slug) { return !!(slug && window.TRAVEL && window.TRAVEL[slug]); }
  function writeUpHref(slug) { return '/travel.html?c=' + slug; }

  function initMap() {
    var visitedPaths = Array.prototype.slice.call(document.querySelectorAll('.world .visited'));
    var listEl = document.getElementById('visited-list');
    var tip = document.getElementById('map-tip');
    var wrap = document.querySelector('.map-wrap');

    initCount(visitedPaths.length);

    // Find a country path by slug, center it in the scroller, and pulse it.
    function getPath(slug) { return document.querySelector('.world .country[data-slug="' + slug + '"]'); }
    function peek(slug, on) { var p = getPath(slug); if (p) p.classList.toggle('hl', on); }
    function locateCountry(slug) {
      var path = getPath(slug);
      if (!path) return;
      if (wrap) {
        var fb = wrap.getBoundingClientRect();
        if (fb.bottom < 80 || fb.top > window.innerHeight - 80) {
          wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      if (scroller) {
        try {
          var pb = path.getBoundingClientRect(), sb = scroller.getBoundingClientRect();
          scroller.scrollLeft += (pb.left + pb.width / 2) - (sb.left + sb.width / 2);
        } catch (e) {}
      }
      peek(slug, true);
      path.classList.remove('flash');
      void path.offsetWidth;            // restart the flash animation
      path.classList.add('flash');
      setTimeout(function () { path.classList.remove('flash'); peek(slug, false); }, 950);
    }

    // Visited list — sorted, home first. Buttons that locate the country on the map.
    if (listEl) {
      listEl.innerHTML = '';
      visitedPaths
        .map(function (p) {
          return { name: p.getAttribute('data-name'), slug: p.getAttribute('data-slug'), home: p.hasAttribute('data-home') };
        })
        .filter(function (c) { return c.name; })
        .sort(function (a, b) {
          if (a.home !== b.home) return a.home ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .forEach(function (c) {
          var el;
          if (hasWriteUp(c.slug)) {
            el = document.createElement('a');
            el.href = writeUpHref(c.slug);
            el.setAttribute('aria-label', c.name + ' — read write-up');
          } else {
            el = document.createElement('button');
            el.type = 'button';
            el.setAttribute('aria-label', c.name + ' — find on the map');
            el.addEventListener('click', function () { locateCountry(c.slug); });
            el.addEventListener('mouseenter', function () { peek(c.slug, true); });
            el.addEventListener('mouseleave', function () { peek(c.slug, false); });
            el.addEventListener('blur', function () { peek(c.slug, false); });
          }
          el.className = 'v-item';
          el.setAttribute('data-slug', c.slug);
          el.textContent = c.home ? ('★ ' + c.name) : c.name;
          if (c.home) el.setAttribute('data-home', '');
          listEl.appendChild(el);
        });
    }

    // Tooltip + keyboard access for the highlighted countries.
    function showTip(name, slug, x, y) {
      if (!tip || !wrap) return;
      var suffix = hasWriteUp(slug) ? '· write-up available ↗' : '· write-up coming';
      tip.innerHTML = '<strong>' + name + '</strong> <span class="soon">' + suffix + '</span>';
      tip.hidden = false;
      var r = wrap.getBoundingClientRect();
      tip.style.left = (x - r.left) + 'px';
      tip.style.top = (y - r.top) + 'px';
    }
    function hideTip() { if (tip) tip.hidden = true; }

    visitedPaths.forEach(function (p) {
      var name = p.getAttribute('data-name');
      var slug = p.getAttribute('data-slug');
      var hasBlog = hasWriteUp(slug);
      p.setAttribute('tabindex', '0');
      p.setAttribute('role', 'img');
      p.setAttribute('aria-label', name + (hasBlog ? ' — read write-up' : ' — visited, write-up coming'));
      if (hasBlog) p.style.cursor = 'pointer';
      p.addEventListener('mousemove', function (e) { showTip(name, slug, e.clientX, e.clientY); });
      p.addEventListener('mouseleave', hideTip);
      p.addEventListener('focus', function () {
        var b = p.getBoundingClientRect();
        showTip(name, slug, b.left + b.width / 2, b.top + b.height / 2);
      });
      p.addEventListener('blur', hideTip);
      if (hasBlog) {
        var open = function () { location.href = writeUpHref(slug); };
        p.addEventListener('click', open);
        p.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
      }
    });
  }

  if (scroller) {
    fetch('world-map.svg')
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.text(); })
      .then(function (svg) {
        scroller.innerHTML = svg;
        scroller.removeAttribute('aria-busy');
        initMap();
      })
      .catch(function () {
        scroller.removeAttribute('aria-busy');
        scroller.innerHTML = '<p class="map-fallback">Couldn\u2019t load the map \u2014 the countries I\u2019ve visited are listed just below.</p>';
      });
  }

  /* ---------- Flightradar24 stats: fetch fr24-stats.json (refreshed every two weeks by
     .github/workflows/fr24-update.yml) and fill in the numbers. There's no link/fallback
     to fall back to (the FR24 profile is private), so on failure the whole card just hides. ---------- */
  var fr24Card = document.querySelector('.fr24');
  if (fr24Card) {
    fetch('fr24-stats.json')
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (s) {
        var flightsEl = document.getElementById('fr24-flights');
        var fr24KmEl = document.getElementById('fr24-km');
        var hoursEl = document.getElementById('fr24-hours');
        if (flightsEl) flightsEl.textContent = s.flights.toLocaleString();
        if (fr24KmEl) fr24KmEl.textContent = s.km.toLocaleString();
        if (hoursEl) hoursEl.textContent = s.hours + 'h ' + s.minutes + 'm';
        var capEl = document.getElementById('fr24-cap');
        if (capEl && s.updated) capEl.textContent = 'Pulled from my Flightradar24 log \u2014 last updated ' + s.updated + '.';
      })
      .catch(function () { fr24Card.hidden = true; });
  }
})();
