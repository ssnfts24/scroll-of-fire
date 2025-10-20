/* ==========================================================================
   Scroll of Fire — Codex of Reality
   codex.js v3.3  (for codex.css v2.0 and the provided HTML)
   - Sticky header, tab ink, card reveals
   - Hero (plasma/scanline) activation + parallax (cursor + scroll)
   - Simple/Echo mode toggle
   - HUD grid toggle
   - Site search mini-suggest + '/' shortcut
   - Command palette shell (⌘K / Ctrl+K)
   - Equation pop-out viewer + drag-scroll
   - Back-to-top
   - Motion/Data guard rails and robust fallbacks
   ========================================================================== */

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const html = document.documentElement;
  const body = document.body;

  // Mark JS ready early so CSS can reveal fallbacks safely
  html.classList.add('js-ready');

  /* ----------------------- Motion/Data feature flags ----------------------- */
  const mediaReduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mediaReduceData   = window.matchMedia('(prefers-reduced-data: reduce)');
  const ALLOW_MOTION = !(mediaReduceMotion.matches || mediaReduceData.matches);

  /* ----------------------- Sticky header ---------------------------------- */
  const header = $('header.site');
  const STICKY_THRESHOLD = 6;
  const onScrollHeader = () => {
    if (!header) return;
    if (window.scrollY > STICKY_THRESHOLD) header.classList.add('is-stuck');
    else header.classList.remove('is-stuck');
  };
  onScrollHeader();
  window.addEventListener('scroll', onScrollHeader, { passive: true });

  /* ----------------------- Tabs ink indicator ----------------------------- */
  const tabs = $('.tabs');
  const ink  = $('.tabs .tab-ink');
  const setInkTo = (el) => {
    if (!tabs || !ink || !el) return;
    const tb = tabs.getBoundingClientRect();
    const eb = el.getBoundingClientRect();
    const x = Math.max(0, eb.left - tb.left);
    const w = Math.max(8, eb.width);
    ink.style.setProperty('--ink-x', `${x}px`);
    ink.style.setProperty('--ink-w', `${w}px`);
  };
  const currentTab = () => {
    // Prefer [aria-current], else hash match, else first tab
    const all = $$('.tabs .tab');
    let active = all.find(a => a.getAttribute('aria-current') === 'page');
    if (!active && location.hash) {
      active = all.find(a => a.getAttribute('href') === location.hash);
    }
    return active || all[0] || null;
  };
  const initTabsInk = () => {
    setInkTo(currentTab());
    $$('.tabs .tab').forEach(a => {
      a.addEventListener('mouseenter', () => setInkTo(a));
      a.addEventListener('focus', () => setInkTo(a));
    });
    tabs?.addEventListener('mouseleave', () => setInkTo(currentTab()));
    window.addEventListener('resize', () => setInkTo(currentTab()));
    window.addEventListener('hashchange', () => setInkTo(currentTab()));
  };
  initTabsInk();

  /* ----------------------- Card reveal (IO) ------------------------------- */
  const revealCards = () => {
    const cards = $$('.card');
    if (!cards.length) return;
    if (!('IntersectionObserver' in window) || !ALLOW_MOTION) {
      cards.forEach(c => c.classList.add('visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      }
    }, { rootMargin: '80px 0px' });
    cards.forEach(c => io.observe(c));
  };
  revealCards();

  /* ----------------------- Hero: plasma & parallax ------------------------ */
  const hero = $('#hero');
  const heroImg = $('#heroBanner');
  const heroPulse = hero?.querySelector('.hero-pulse');
  // Mark active when in view (controls scanline animation + pulse)
  if (hero && 'IntersectionObserver' in window) {
    const ioHero = new IntersectionObserver((es) => {
      if (es.some(e => e.isIntersecting)) hero.classList.add('is-active');
      else hero.classList.remove('is-active');
    }, { rootMargin: '200px 0px' });
    ioHero.observe(hero);
  } else {
    hero?.classList.add('is-active');
  }

  // Parallax (cursor tilt + slight scroll-based zoom)
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  if (hero && ALLOW_MOTION) {
    let px = 0, py = 0, pz = 1;

    const updateVars = () => {
      hero.style.setProperty('--parallax-x', `${px}deg`);
      hero.style.setProperty('--parallax-y', `${py}deg`);
      hero.style.setProperty('--parallax-zoom', `${pz}`);
      // If you want to parallax the image itself:
      heroImg?.style.setProperty('transform', `translateZ(0) scale(${pz})`);
    };

    const onMove = (e) => {
      const rect = hero.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const x = (('touches' in e) ? e.touches[0].clientX : e.clientX) - cx;
      const y = (('touches' in e) ? e.touches[0].clientY : e.clientY) - cy;
      // scale to degrees
      px = clamp((x / rect.width) * 6, -6, 6);
      py = clamp((-y / rect.height) * 6, -6, 6);
      updateVars();
    };
    const onScroll = () => {
      // gentle zoom based on how far hero is from viewport center
      const rect = hero.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const mid = rect.top + rect.height / 2;
      const dist = Math.abs((vh / 2) - mid) / (vh / 2);
      pz = 1 + (0.02 * (1 - clamp(dist, 0, 1))); // 1 → 1.02
      updateVars();
    };

    hero.addEventListener('mousemove', onMove, { passive: true });
    hero.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    updateVars();
  }

  /* ----------------------- Echo/Simple mode toggle ------------------------ */
  const simpleCheckbox = $('#simple');
  const btnSimple = $('#toggleSimple');
  const setSimple = (on) => {
    body.classList.toggle('simple-on', !!on);
    if (btnSimple) btnSimple.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  simpleCheckbox?.addEventListener('change', (e) => setSimple(e.currentTarget.checked));
  btnSimple?.addEventListener('click', () => setSimple(!body.classList.contains('simple-on')));

  /* ----------------------- HUD grid toggle -------------------------------- */
  const btnGrid = $('#toggleGrid');
  const laser = $('.laser-grid');
  const setHUD = (on) => {
    if (!laser) return;
    laser.style.display = on ? '' : 'none';
    btnGrid?.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  // Start with HUD visible if present
  setHUD(!!laser);
  btnGrid?.addEventListener('click', () => {
    const on = laser && laser.style.display === 'none';
    setHUD(on);
  });

  /* ----------------------- Back to top ------------------------------------ */
  const toTop = $('#toTop');
  const onScrollTopBtn = () => {
    if (!toTop) return;
    if (window.scrollY > 400) toTop.classList.add('show');
    else toTop.classList.remove('show');
  };
  toTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: ALLOW_MOTION ? 'smooth' : 'auto' }));
  onScrollTopBtn();
  window.addEventListener('scroll', onScrollTopBtn, { passive: true });

  /* ----------------------- Site search mini-suggest ----------------------- */
  const siteSearch = $('#site-search');
  const siteSuggest = $('#site-suggest');
  const H_CANDIDATES = $$('h1[id],h2[id],h3[id],section[id],article[id]');
  const suggest = (query) => {
    if (!siteSuggest) return;
    siteSuggest.innerHTML = '';
    const q = (query || '').trim().toLowerCase();
    if (!q) { siteSuggest.style.display = 'none'; return; }

    const matches = [];
    // Headings + any anchor with id
    H_CANDIDATES.forEach(el => {
      const text = (el.textContent || '').trim();
      if (!text) return;
      if (text.toLowerCase().includes(q)) {
        matches.push({ text, href: `#${el.id}` });
      }
    });
    // Links
    $$('a[href^="#"]').forEach(a => {
      const text = (a.textContent || '').trim();
      if (text && text.toLowerCase().includes(q)) {
        matches.push({ text, href: a.getAttribute('href') });
      }
    });

    // De-dup
    const seen = new Set();
    const results = matches.filter(m => {
      const key = `${m.text}|${m.href}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12);

    if (!results.length) { siteSuggest.style.display = 'none'; return; }

    results.forEach(r => {
      const a = document.createElement('a');
      a.href = r.href;
      a.textContent = r.text;
      a.addEventListener('click', () => siteSuggest.style.display = 'none');
      siteSuggest.appendChild(a);
    });
    siteSuggest.style.display = 'block';
  };
  siteSearch?.addEventListener('input', (e) => suggest(e.currentTarget.value));
  siteSearch?.addEventListener('focus', (e) => suggest(e.currentTarget.value));
  document.addEventListener('click', (e) => {
    if (!siteSuggest) return;
    if (e.target === siteSuggest || siteSuggest.contains(e.target)) return;
    if (e.target === siteSearch) return;
    siteSuggest.style.display = 'none';
  });

  // '/' focuses the page search
  document.addEventListener('keydown', (e) => {
    if ((e.key === '/' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // allow native find with Ctrl/Cmd+F, use '/' for our input
      if (e.key === '/') {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea') {
          e.preventDefault();
          siteSearch?.focus();
        }
      }
    }
  });

  /* ----------------------- Command palette shell -------------------------- */
  const palette = $('#palette');
  const palInput = $('#palInput');
  const palList  = $('#palList');
  const openPalette = $('#openPalette');

  const togglePalette = (open) => {
    if (!palette) return;
    palette.classList.toggle('open', !!open);
    if (open) {
      palInput?.focus();
      buildPaletteList('');
    } else {
      palInput?.blur();
    }
  };

  const buildPaletteList = (q) => {
    if (!palList) return;
    palList.innerHTML = '';
    const norm = (q || '').toLowerCase().trim();

    // Basic commands; you can expand with real actions later
    const commands = [
      { label: 'Go: Theory', href: 'theory.html' },
      { label: 'Go: Manifest', href: 'teach.html' },
      { label: 'Toggle Echo View', action: () => setSimple(!body.classList.contains('simple-on')) },
      { label: 'Toggle HUD', action: () => btnGrid?.click() },
      { label: 'Back to Top', action: () => toTop?.click() },
      { label: 'Jump: Explore', href: '#explore' },
      { label: 'Jump: Canon', href: '#canon' },
      { label: 'Jump: Integrity', href: '#integrity' },
      { label: 'Jump: Provenance', href: '#provenance' }
    ];
    const rows = commands.filter(c => !norm || c.label.toLowerCase().includes(norm));
    rows.forEach((c, i) => {
      const li = document.createElement('li');
      li.textContent = c.label;
      if (i === 0) li.classList.add('sel');
      li.addEventListener('click', () => {
        if (c.href) location.href = c.href;
        else c.action?.();
        togglePalette(false);
      });
      palList.appendChild(li);
    });
  };

  palInput?.addEventListener('input', (e) => buildPaletteList(e.currentTarget.value));
  openPalette?.addEventListener('click', () => togglePalette(true));
  document.addEventListener('keydown', (e) => {
    const modK = (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey));
    if (modK) { e.preventDefault(); togglePalette(true); }
    if (e.key === 'Escape') {
      if (palette?.classList.contains('open')) togglePalette(false);
      // Close any open eq popouts too
      closeEqPopout();
    }
  });
  palette?.addEventListener('click', (e) => {
    if (e.target === palette) togglePalette(false);
  });

  /* ----------------------- Equations: pop-out + drag scroll -------------- */
  // drag-to-scroll for .eq-scroll
  const initDragScroll = () => {
    $$('.eq .eq-scroll').forEach(scroller => {
      let down = false, startX = 0, startLeft = 0;
      scroller.addEventListener('mousedown', (e) => {
        down = true; startX = e.clientX; startLeft = scroller.scrollLeft;
        scroller.classList.add('dragging'); e.preventDefault();
      });
      window.addEventListener('mousemove', (e) => {
        if (!down) return;
        scroller.scrollLeft = startLeft - (e.clientX - startX);
      }, { passive: true });
      window.addEventListener('mouseup', () => { down = false; scroller.classList.remove('dragging'); });
      // Touch
      let tStartX = 0, tStartLeft = 0, tDown = false;
      scroller.addEventListener('touchstart', (e) => {
        tDown = true; tStartX = e.touches[0].clientX; tStartLeft = scroller.scrollLeft;
      }, { passive: true });
      scroller.addEventListener('touchmove', (e) => {
        if (!tDown) return;
        scroller.scrollLeft = tStartLeft - (e.touches[0].clientX - tStartX);
      }, { passive: true });
      scroller.addEventListener('touchend', () => { tDown = false; });
    });
  };
  initDragScroll();

  // Expand nearest .eq on button[data-eq-expand]
  let eqPopout = null;
  const closeEqPopout = () => {
    if (eqPopout) {
      eqPopout.remove();
      eqPopout = null;
      document.body.style.removeProperty('overflow');
    }
  };
  document.addEventListener('click', (e) => {
    const btn = (e.target.closest('[data-eq-expand]'));
    if (!btn) return;
    const eq = btn.closest('.card, .eq')?.querySelector('.eq') || btn.closest('.eq');
    if (!eq) return;

    // Create popout
    eqPopout = document.createElement('div');
    eqPopout.className = 'eq eq--expanded';
    const inner = document.createElement('div');
    inner.className = 'eq-scroll';
    inner.innerHTML = eq.querySelector('.eq-scroll')?.innerHTML || eq.innerHTML;
    const close = document.createElement('button');
    close.className = 'eq-close';
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', closeEqPopout);
    eqPopout.appendChild(inner);
    eqPopout.appendChild(close);
    document.body.appendChild(eqPopout);
    document.body.style.overflow = 'hidden';
    initDragScroll(); // enable drag on popout content
  });

  /* ----------------------- Keyboard: general ------------------------------ */
  // Close overlays with ESC is handled in palette listener; ensure popout closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeEqPopout();
  });

  /* ----------------------- Ripple origin for quick row -------------------- */
  // Optional: place ripple origin under pointer using CSS variables (if you add them)
  const quick = $('.quick');
  if (quick) {
    quick.addEventListener('pointerdown', (e) => {
      const t = e.target.closest('a,button');
      if (!t) return;
      const r = t.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      t.style.setProperty('--mx', `${x}px`);
      t.style.setProperty('--my', `${y}px`);
    }, { passive: true });
  }

  /* ----------------------- Hash target offset fix ------------------------ */
  // Smooth scroll to in-page anchors considering sticky header
  const smoothAnchor = (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 80; // approx header height
    window.scrollTo({ top, behavior: ALLOW_MOTION ? 'smooth' : 'auto' });
    history.pushState(null, '', `#${id}`);
    setInkTo(a.closest('.tab') || currentTab());
  };
  document.addEventListener('click', smoothAnchor);

  /* ----------------------- Ambient hum hook (visual only) ---------------- */
  // Toggle body.classList.add('hum-on') in your audio code to show indicator.
  // This JS just ensures the indicator is present if you add it later.
  // (No action needed here.)

  /* ----------------------- Defer performance warmup mask ------------------ */
  // The inline <script> in HTML adds/removes .performance-warming on body.
  // No extra code is needed here; leaving note for clarity.

