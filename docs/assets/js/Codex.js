<script>
(() => {
  const SELECTOR = '.card, .divider';
  const VISIBLE_CLASS = 'visible';
  const STYLE_ID = 'reveal-style-once';

  // Inject styles once (keeps your hymn/theme; just the effect layer)
  if (!document.getElementById(STYLE_ID)) {
    const css = `
      @media (prefers-reduced-motion: no-preference) {
        .card, .divider { opacity:0; transform: translateY(12px); transition: opacity .6s ease, transform .6s ease }
        .card.${VISIBLE_CLASS}, .divider.${VISIBLE_CLASS} { opacity:1; transform: none }
      }
      @media (prefers-reduced-motion: reduce) {
        .card, .divider { opacity:1 !important; transform:none !important; transition:none !important }
      }
    `;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // If the user prefers less motion, just make everything visible and exit.
  if (prefersReducedMotion) {
    document.querySelectorAll(SELECTOR).forEach(el => el.classList.add(VISIBLE_CLASS));
    return;
  }

  // --- IntersectionObserver path (preferred) ---
  const els = () => Array.from(document.querySelectorAll(SELECTOR));

  let io;
  const observeAll = () => {
    // rootMargin pulls the reveal a bit earlier (approx. your 0.88 threshold)
    io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add(VISIBLE_CLASS);
          io.unobserve(entry.target); // reveal once, then stop observing
        }
      }
    }, { root: null, rootMargin: '0px 0px -12% 0px', threshold: 0 });

    els().forEach(el => {
      if (!el.classList.contains(VISIBLE_CLASS)) io.observe(el);
    });
  };

  const supportsIO = 'IntersectionObserver' in window;

  // --- Fallback: scroll + rAF throttle ---
  const fallbackReveal = (() => {
    let ticking = false;
    const check = () => {
      const h = window.innerHeight || document.documentElement.clientHeight;
      els().forEach(el => {
        if (el.classList.contains(VISIBLE_CLASS)) return;
        const r = el.getBoundingClientRect();
        if (r.top < h * 0.88) el.classList.add(VISIBLE_CLASS);
      });
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(check);
      }
    };
    const init = () => {
      check();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      window.addEventListener('orientationchange', onScroll, { passive: true });
    };
    const destroy = () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('orientationchange', onScroll);
    };
    return { init, destroy, check };
  })();

  const init = () => {
    if (supportsIO) {
      observeAll();
    } else {
      fallbackReveal.init();
    }

    // Watch for dynamically added cards/dividers and attach reveal behavior
    const mo = new MutationObserver((muts) => {
      const added = [];
      for (const mut of muts) {
        mut.addedNodes.forEach(n => {
          if (!(n instanceof Element)) return;
          if (n.matches && n.matches(SELECTOR)) added.push(n);
          n.querySelectorAll && added.push(...n.querySelectorAll(SELECTOR));
        });
      }
      if (added.length) {
        if (supportsIO) {
          added.forEach(el => {
            if (!el.classList.contains(VISIBLE_CLASS)) io.observe(el);
          });
        } else {
          fallbackReveal.check();
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Cleanup on page hide/unload (single page/GP builds benefit)
    const cleanup = () => {
      mo.disconnect();
      if (supportsIO && io) io.disconnect();
      else fallbackReveal.destroy();
      window.removeEventListener('pagehide', cleanup);
      window.removeEventListener('beforeunload', cleanup);
    };
    window.addEventListener('pagehide', cleanup);
    window.addEventListener('beforeunload', cleanup);
  };

  // Kick off when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
</script>
