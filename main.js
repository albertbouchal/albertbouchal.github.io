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
  var PING_DIST_KM = 890;                          // Prague–Amsterdam great-circle, km (~30 s at orbital speed)
  var PING_P = [[156, 128], [80, 12], [4, 128]];   // bezier ctrl pts: PRG, apex, AMS (SVG viewBox 160×160)

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
    var dir = travelDir();
    if (!dir) { cruising = false; lastCruiseT = 0; return; }
    var dt = lastCruiseT ? (now - lastCruiseT) : 16; lastCruiseT = now;
    var heldFor = (now - (holdStart[dir > 0 ? 'd' : 'a'] || now)) / 1000;
    var rate = Math.min(12, 1 + heldFor * 4.5);             // hours per second, ramps over ~2.5 s
    timeOffsetMs += dir * rate * 3600000 * (dt / 1000);
    requestAnimationFrame(cruiseLoop);
  }
  function onKey(e, down) {
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
  function arcPath(a) {
    a = nrm(a, 360);
    var seg = Math.max(2, Math.ceil(a / 2)), i, t, p, d = '';
    for (i = 0; i <= seg; i++) {
      t = rad(a * i / seg);                                 // 0 → a, counter-clockwise from the top
      p = [RING.cx - RING.r * Math.sin(t), RING.cy - RING.r * Math.cos(t)];
      d += (i ? 'L' : 'M') + p[0].toFixed(2) + ',' + p[1].toFixed(2);
    }
    return d;
  }
  function pingXY(t) {                             // quadratic bezier position at t ∈ [0,1]
    var mt = 1 - t;
    return [mt*mt*PING_P[0][0] + 2*mt*t*PING_P[1][0] + t*t*PING_P[2][0],
            mt*mt*PING_P[0][1] + 2*mt*t*PING_P[1][1] + t*t*PING_P[2][1]];
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

  // Only touch the DOM when a value actually changes. The rAF loop runs every frame, but the
  // km string changes ~30×/s and the degree string far less often, so most frames would be
  // redundant innerHTML writes (each one re-parses HTML). Caching skips those.
  var disp = {};
  function put(el, key, val, asHTML) {
    if (!el || disp[key] === val) return;
    disp[key] = val;
    if (asHTML) el.innerHTML = val; else el.textContent = val;
  }

  function tickCounters() {
    // orbital km — your real session, never time-travelled
    var elapsedKm = (performance.now() - pageOpenTime) / 1000 * EARTH_SPEED_KM_PER_S;
    put(kmEl, 'km', fmtKm(elapsedKm), true);

    // ping: dot bounces PRG→AMS→PRG every PING_DIST_KM (~30 s per leg)
    if (pingDotEl) {
      var cycle = elapsedKm % (2 * PING_DIST_KM);
      var pingT = cycle <= PING_DIST_KM ? cycle / PING_DIST_KM : (2 * PING_DIST_KM - cycle) / PING_DIST_KM;
      var pp = pingXY(pingT), pk = pp[0].toFixed(1) + ',' + pp[1].toFixed(1);
      if (disp.pingDot !== pk) {
        disp.pingDot = pk;
        pingDotEl.setAttribute('cx', pp[0].toFixed(1));
        pingDotEl.setAttribute('cy', pp[1].toFixed(1));
      }
    }
    put(pingCountEl, 'pingCount', Math.floor(elapsedKm / PING_DIST_KM).toLocaleString(), false);

    // Earth-rotation clock — driven by the (possibly time-travelled) effective clock
    var now = effNow();
    var sr = lastSunriseMs(now);
    if (sr != null) {
      var hrs = (now - sr) / 3600000;
      var degSince = hrs * 15;                              // Earth turns 15°/h
      put(degEl, 'deg', fmtDeg(degSince), true);
      put(distEl, 'dist', Math.round(hrs * 3600 * SURFACE_M_PER_S / 1000).toLocaleString(), false);
      var d = arcPath(degSince);
      if (arcEl && disp.arc !== d) { disp.arc = d; arcEl.setAttribute('d', d); }
      if (headEl) {
        var hp = headXY(degSince), hk = hp[0].toFixed(2) + ',' + hp[1].toFixed(2);
        if (disp.head !== hk) { disp.head = hk; headEl.setAttribute('cx', hp[0].toFixed(2)); headEl.setAttribute('cy', hp[1].toFixed(2)); }
      }
    }

    // time-travel status line
    if (ttEl) {
      if (timeOffsetMs === 0) { put(ttEl, 'tt', 'live', false); if (spinBlock) spinBlock.classList.remove('traveling'); }
      else { put(ttEl, 'tt', pragueFmt.format(new Date(now)) + ' · ' + fmtOffset(timeOffsetMs), false); if (spinBlock) spinBlock.classList.add('traveling'); }
    }
    requestAnimationFrame(tickCounters);
  }
  if (kmEl || degEl) requestAnimationFrame(tickCounters);

  /* ---------- Country count: animate to total when scrolled into view ---------- */
  var TOTAL_COUNTRIES = 31;
  var countEl = document.getElementById('country-count');
  if (countEl) {
    if (prefersReduced || !('IntersectionObserver' in window)) {
      countEl.textContent = TOTAL_COUNTRIES;
    } else {
      countEl.textContent = '0';
      var travel = document.getElementById('travel');
      var counted = false;
      var cObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && !counted) {
            counted = true;
            var start = performance.now(), dur = 900;
            (function tick(now) {
              var t = Math.min(1, (now - start) / dur);
              var eased = 1 - Math.pow(1 - t, 3);
              countEl.textContent = Math.round(eased * TOTAL_COUNTRIES);
              if (t < 1) requestAnimationFrame(tick);
            })(start);
          }
        });
      }, { threshold: 0.4 });
      cObs.observe(travel);
    }
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

  function initMap() {
    var visitedPaths = Array.prototype.slice.call(document.querySelectorAll('.world .visited'));
    var listEl = document.getElementById('visited-list');
    var tip = document.getElementById('map-tip');
    var wrap = document.querySelector('.map-wrap');

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
          // Later: swap this <button> for <a href="/travel/{slug}"> once write-ups exist.
          var el = document.createElement('button');
          el.type = 'button';
          el.className = 'v-item';
          el.setAttribute('data-slug', c.slug);
          el.setAttribute('aria-label', c.name + ' — find on the map');
          el.textContent = c.home ? ('★ ' + c.name) : c.name;
          if (c.home) el.setAttribute('data-home', '');
          el.addEventListener('click', function () { locateCountry(c.slug); });
          el.addEventListener('mouseenter', function () { peek(c.slug, true); });
          el.addEventListener('mouseleave', function () { peek(c.slug, false); });
          el.addEventListener('blur', function () { peek(c.slug, false); });
          listEl.appendChild(el);
        });
    }

    // Tooltip + keyboard access for the highlighted countries.
    function showTip(name, x, y) {
      if (!tip || !wrap) return;
      tip.innerHTML = '<strong>' + name + '</strong> <span class="soon">· write-up coming soon</span>';
      tip.hidden = false;
      var r = wrap.getBoundingClientRect();
      tip.style.left = (x - r.left) + 'px';
      tip.style.top = (y - r.top) + 'px';
    }
    function hideTip() { if (tip) tip.hidden = true; }

    visitedPaths.forEach(function (p) {
      var name = p.getAttribute('data-name');
      p.setAttribute('tabindex', '0');
      p.setAttribute('role', 'img');
      p.setAttribute('aria-label', name + ' — visited, write-up coming soon');
      p.addEventListener('mousemove', function (e) { showTip(name, e.clientX, e.clientY); });
      p.addEventListener('mouseleave', hideTip);
      p.addEventListener('focus', function () {
        var b = p.getBoundingClientRect();
        showTip(name, b.left + b.width / 2, b.top + b.height / 2);
      });
      p.addEventListener('blur', hideTip);
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
})();
