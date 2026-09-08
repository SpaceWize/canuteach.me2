/* ==========================================================================
   Computer U-Teach — Directional slide panels
   --------------------------------------------------------------------------
   Vertical scrolling drives horizontal movement. The outer section is tall;
   a sticky child pins the viewport; each panel is stacked on the last with a
   rising z-index and slides in from an alternating edge, covering what came
   before — including the scribble line behind the first panel.

   TIMING
   Panel i of N enters over the scroll range [i/N, i/N + i/N*0 + DUR], where
   DUR is a fraction of one slot. A short DUR means each panel snaps in and
   then holds while you keep scrolling, which reads as deliberate rather than
   sluggish — this is the "slightly faster" pacing.

   SPRING
   Raw scroll mapping feels mechanical, and on trackpads it jitters. Each
   panel's offset is therefore eased toward its scroll-derived target every
   frame, the vanilla equivalent of wrapping the value in a spring. The loop
   idles when nothing is moving so it costs nothing at rest.

   DISABLED on narrow screens and under prefers-reduced-motion — pinning the
   page and hijacking scroll is genuinely hostile on a phone, and this site
   serves people who scroll in big imprecise jumps. The CSS falls the panels
   back to ordinary stacked sections; this script then does nothing at all.
   ========================================================================== */

(function () {
  'use strict';

  var section = document.querySelector('.panels');
  if (!section) return;

  var sticky = section.querySelector('.panels__sticky');
  var panels = [].slice.call(section.querySelectorAll('.panel'));
  if (!panels.length) return;

  var dots = [].slice.call(section.querySelectorAll('.panels__dot'));

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var narrow = window.matchMedia('(max-width: 900px)');

  var DUR  = 0.62;   // fraction of a panel's slot spent sliding (rest is hold)
  var EASE = 0.18;   // spring-ish follow factor per frame

  var state = panels.map(function (el, i) {
    // Alternate the entry edge: right, left, right, left …
    var from = el.getAttribute('data-from') || (i % 2 === 0 ? 'right' : 'left');
    return { el: el, from: from, cur: i === 0 ? 100 : 100, target: 100 };
  });

  var running = false;
  var enabled = false;

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  // Gentle acceleration in, soft settle out
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  /* Turn the effect off: clear every inline transform so the CSS fallback
     (static, stacked panels) is what shows. */
  function disable() {
    enabled = false;
    state.forEach(function (s) {
      s.el.style.transform = '';
      s.cur = s.target = 0;
    });
  }

  /* Progress through the pinned range, 0..1.

     The sticky child is offset by the fixed header (top: var(--header-h)), so
     pinning BEGINS when the section top reaches headerH — not when it reaches
     0. Measuring from 0 would start the sequence one header-height early and
     leave the last panel unfinished at the bottom. */
  function measure() {
    var headerH = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--header-h')
    ) || 0;
    var rect = section.getBoundingClientRect();
    var range = section.offsetHeight - sticky.offsetHeight;
    return clamp01(range > 0 ? (headerH - rect.top) / range : 0);
  }

  function updateTargets() {
    var p = measure();
    var N = state.length;
    var slot = 1 / N;

    for (var i = 0; i < N; i++) {
      var start = i * slot;
      var t = clamp01((p - start) / (slot * DUR));
      // 100 = fully off-screen on its entry edge, 0 = seated
      state[i].target = (1 - easeInOut(t)) * 100;
    }

    // Progress dots follow whichever panel is currently seated
    if (dots.length) {
      var active = Math.min(N - 1, Math.floor(p / slot + 0.35));
      for (var d = 0; d < dots.length; d++) {
        dots[d].classList.toggle('is-active', d === active);
      }
    }
  }

  function tick() {
    var moving = false;

    for (var i = 0; i < state.length; i++) {
      var s = state[i];
      s.cur += (s.target - s.cur) * EASE;

      if (Math.abs(s.target - s.cur) < 0.05) s.cur = s.target;
      else moving = true;

      var sign = s.from === 'left' ? -1 : 1;
      s.el.style.transform = s.cur === 0
        ? 'translate3d(0,0,0)'
        : 'translate3d(' + (sign * s.cur).toFixed(2) + '%,0,0)';
    }

    if (moving) requestAnimationFrame(tick);
    else running = false;
  }

  function start() {
    if (!running) { running = true; requestAnimationFrame(tick); }
  }

  var ticking = false;
  function onScroll() {
    if (!enabled || ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      updateTargets();
      start();
      ticking = false;
    });
  }

  function enable() {
    enabled = true;
    updateTargets();
    // Seat the panels at their target immediately on enable so nothing
    // flashes in from off-screen when the page loads mid-section.
    state.forEach(function (s) { s.cur = s.target; });
    start();
  }

  function sync() {
    if (reduce.matches || narrow.matches) disable();
    else enable();
  }

  /* Anchor links into a panel (e.g. the footer's "Testimonials" -> #testimonials).
     A panel is position:absolute inside the sticky container, so its natural
     offsetTop is the top of the whole section — the browser would scroll to
     the start of the sequence rather than to that panel. Compute the scroll
     position at which the panel is fully seated instead. */
  function scrollToPanel(index) {
    var headerH = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--header-h')
    ) || 0;
    var range = section.offsetHeight - sticky.offsetHeight;
    var slot = 1 / state.length;
    var p = index * slot + slot * DUR;           // moment it finishes entering
    var top = window.scrollY + section.getBoundingClientRect().top - headerH;
    window.scrollTo({ top: top + range * p, behavior: 'smooth' });
  }

  document.addEventListener('click', function (e) {
    if (!enabled) return;                        // let the browser handle it normally
    var a = e.target.closest && e.target.closest('a[href*="#"]');
    if (!a) return;

    var href = a.getAttribute('href') || '';
    var hash = href.slice(href.indexOf('#') + 1);
    if (!hash) return;

    // Only intercept links pointing at this page
    var path = href.split('#')[0];
    if (path && path !== location.pathname.split('/').pop() && path !== 'index.html') return;

    for (var i = 0; i < state.length; i++) {
      if (state[i].el.id === hash) {
        e.preventDefault();
        scrollToPanel(i);
        return;
      }
    }
  });

  sync();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', sync, { passive: true });

  ['change'].forEach(function (evt) {
    if (reduce.addEventListener) reduce.addEventListener(evt, sync);
    if (narrow.addEventListener) narrow.addEventListener(evt, sync);
  });
})();
