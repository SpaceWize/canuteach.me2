/* ==========================================================================
   Computer U-Teach — Site behaviour
   Vanilla JS, no dependencies, no build step.

   Contents:
     1. Mobile navigation drawer
     2. Header shadow on scroll
     3. Scroll reveals (IntersectionObserver, fires once)
     4. Magnetic image hover — rotate, scale, lift, follow cursor with lag
     5. Footer year

   Every motion effect checks prefers-reduced-motion and degrades to the
   final, static state rather than disappearing.
   ========================================================================== */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ======================================================================
     1. MOBILE NAVIGATION
     FIX (audit #1): the old header stacked contact details, a logo block
     and the menu into 314px on desktop / 919px on mobile. This is a single
     68px bar with a proper drawer underneath.
     ====================================================================== */
  var toggle = document.querySelector('.nav__toggle');
  var links  = document.querySelector('.nav__links');

  if (toggle && links) {
    var closeNav = function () {
      links.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };

    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      // Lock background scroll only while the drawer covers the viewport
      document.body.style.overflow = open ? 'hidden' : '';
    });

    // Close on link tap, on Escape, and when resizing back up to desktop
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeNav();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('is-open')) {
        closeNav();
        toggle.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 900 && links.classList.contains('is-open')) closeNav();
    });
  }

  /* ======================================================================
     2. HEADER SHADOW ON SCROLL
     ====================================================================== */
  var header = document.querySelector('.site-header');
  if (header) {
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        header.classList.toggle('is-scrolled', window.scrollY > 8);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ======================================================================
     3. SCROLL REVEALS
     Equivalent to Framer Motion's whileInView with once: true — the class
     is added a single time and the element is unobserved immediately, so
     scrolling back up never replays or re-hides anything.
     ====================================================================== */
  var revealEls = document.querySelectorAll('.reveal');

  if (!revealEls.length) {
    /* nothing to do */
  } else if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    // Reduced motion, or a browser without IO: show everything immediately
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      // Start slightly before the element edge so it is already settled
      // by the time it is comfortably in view
      rootMargin: '0px 0px -60px 0px'
    });

    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ======================================================================
     4. MAGNETIC IMAGE HOVER
     ----------------------------------------------------------------------
     The brief: on hover the image rotates a few degrees, scales up slightly
     and lifts off the page with a soft shadow; while the cursor stays over
     it the image follows the pointer with a smooth lag; on leave it eases
     back to rest.

     HOW IT WORKS
     A single rAF loop runs only while at least one element is active. Each
     frame the current offset eases toward the target by a fixed fraction
     (`EASE`) — a critically-damped spring in miniature. Because the step is
     proportional to the remaining distance, motion starts quick and settles
     softly, and the return-to-rest uses the identical path with a target of
     zero. Values are written as CSS custom properties so the transform
     itself stays declarative in the stylesheet.

     WHY NOT CSS TRANSITIONS
     A transition would restart on every mousemove event, producing a stutter
     rather than a trailing lag. The lerp gives continuous, frame-accurate
     following.

     GUARDS
     - Disabled entirely under prefers-reduced-motion (and re-checked live,
       so toggling the OS setting takes effect without a reload).
     - Disabled on coarse pointers — a finger has no hover state, and the
       effect would fire on tap and feel broken.
     - Rect is cached on enter and refreshed via ResizeObserver rather than
       read per-frame, which would force layout on every mousemove.
     ====================================================================== */
  var MAX_SHIFT  = 16;    // px the image drifts toward the cursor
  var MAX_ROTATE = 4;     // deg — "a few degrees", never aggressive
  var SCALE_UP   = 1.04;  // gentle pop
  var EASE       = 0.12;  // 0..1 per frame — lower is laggier

  var magnets = [];
  var loopRunning = false;

  function initMagnets() {
    var els = document.querySelectorAll('.magnetic');
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var enabled = finePointer && !reduceMotion.matches;

    // Tear down any previous bindings (used when the media query flips)
    magnets.forEach(function (m) { m.destroy(); });
    magnets = [];

    els.forEach(function (el) {
      if (!enabled) {
        // Static fallback: CSS-only shadow lift, no transform
        el.classList.add('is-static');
        el.style.removeProperty('--mx');
        el.style.removeProperty('--my');
        el.style.removeProperty('--rot');
        el.style.removeProperty('--scale');
        magnets.push({ destroy: function () { el.classList.remove('is-static'); } });
        return;
      }

      el.classList.remove('is-static');

      var state = {
        el: el,
        rect: null,
        active: false,
        cx: 0, cy: 0, crot: 0, cscale: 1,   // current
        tx: 0, ty: 0, trot: 0, tscale: 1    // target
      };

      var measure = function () { state.rect = el.getBoundingClientRect(); };

      var onEnter = function () {
        measure();
        state.active = true;
        state.tscale = SCALE_UP;
        el.classList.add('is-hovered');
        startLoop();
      };

      var onMove = function (e) {
        if (!state.rect) measure();
        // Pointer position relative to element centre, normalised to -1..1
        var nx = (e.clientX - state.rect.left) / state.rect.width  - 0.5;
        var ny = (e.clientY - state.rect.top)  / state.rect.height - 0.5;

        state.tx = nx * MAX_SHIFT * 2;
        state.ty = ny * MAX_SHIFT * 2;
        // Rotate about the cursor's horizontal offset — tilting "into" the
        // pointer reads as the card leaning toward you
        state.trot = nx * MAX_ROTATE * 2;
      };

      var onLeave = function () {
        state.active = false;
        state.tx = state.ty = state.trot = 0;
        state.tscale = 1;
        el.classList.remove('is-hovered');
        // Must restart the loop: if it had already idled (every element at
        // rest), nothing would drive the return animation and the image
        // would stay frozen in its hovered position.
        startLoop();
      };

      el.addEventListener('pointerenter', onEnter);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      // A pointer can be lost mid-gesture (window blur, drag out)
      el.addEventListener('pointercancel', onLeave);
      window.addEventListener('blur', onLeave);

      // Keep the cached rect honest without reading layout every frame
      var ro = null;
      if ('ResizeObserver' in window) {
        ro = new ResizeObserver(function () { if (state.active) measure(); });
        ro.observe(el);
      }
      window.addEventListener('scroll', function () { if (state.active) measure(); }, { passive: true });

      state.destroy = function () {
        el.removeEventListener('pointerenter', onEnter);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerleave', onLeave);
        el.removeEventListener('pointercancel', onLeave);
        window.removeEventListener('blur', onLeave);
        if (ro) ro.disconnect();
        el.classList.remove('is-hovered');
      };

      magnets.push(state);
    });
  }

  function startLoop() {
    if (loopRunning) return;
    loopRunning = true;
    requestAnimationFrame(tick);
  }

  function tick() {
    var stillMoving = false;

    for (var i = 0; i < magnets.length; i++) {
      var m = magnets[i];
      if (!m.el) continue;

      // Ease current toward target — the "smooth lag"
      m.cx     += (m.tx     - m.cx)     * EASE;
      m.cy     += (m.ty     - m.cy)     * EASE;
      m.crot   += (m.trot   - m.crot)   * EASE;
      m.cscale += (m.tscale - m.cscale) * EASE;

      var settled =
        Math.abs(m.tx - m.cx) < 0.05 &&
        Math.abs(m.ty - m.cy) < 0.05 &&
        Math.abs(m.trot - m.crot) < 0.05 &&
        Math.abs(m.tscale - m.cscale) < 0.001;

      if (settled && !m.active) {
        // Snap to exact rest and stop writing styles for this element
        m.cx = m.cy = m.crot = 0; m.cscale = 1;
        m.el.style.setProperty('--mx', '0px');
        m.el.style.setProperty('--my', '0px');
        m.el.style.setProperty('--rot', '0deg');
        m.el.style.setProperty('--scale', '1');
        continue;
      }

      m.el.style.setProperty('--mx', m.cx.toFixed(2) + 'px');
      m.el.style.setProperty('--my', m.cy.toFixed(2) + 'px');
      m.el.style.setProperty('--rot', m.crot.toFixed(3) + 'deg');
      m.el.style.setProperty('--scale', m.cscale.toFixed(4));

      stillMoving = true;
    }

    if (stillMoving) {
      requestAnimationFrame(tick);
    } else {
      loopRunning = false;   // idle: no rAF burning battery
    }
  }

  initMagnets();

  // Re-evaluate if the user changes their motion preference live
  var onPrefChange = function () { initMagnets(); };
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onPrefChange);
  else if (reduceMotion.addListener) reduceMotion.addListener(onPrefChange);

  /* ======================================================================
     5. FOOTER YEAR
     The old footer was hardcoded to "@2024", which quietly signals an
     abandoned site. This keeps itself current.
     ====================================================================== */
  var yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();

// Prepare an email without implying that a message has been sent.
(function(){
 const form=document.querySelector('.form');
 if(!form)return;
 form.addEventListener('submit',function(event){
  event.preventDefault();
  if(!form.reportValidity())return;
  const data=new FormData(form);
  const body='Name: '+data.get('name')+'\nEmail: '+data.get('email')+'\nPhone: '+(data.get('phone')||'Not provided')+'\n\n'+data.get('message');
  window.location.href='mailto:ComputerUteach@gmail.com?subject='+encodeURIComponent(data.get('topic'))+'&body='+encodeURIComponent(body);
  let status=form.querySelector('.form-status');
  if(!status){status=document.createElement('p');status.className='form-status';status.setAttribute('role','status');form.appendChild(status);}
  status.textContent='Your email draft is ready to open. Send it from your email app. If no app opens, email ComputerUteach@gmail.com directly.';
 });
})();
