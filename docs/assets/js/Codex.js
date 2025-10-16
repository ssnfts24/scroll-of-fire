/* Codex.js – progressive enhancements that must never hide content by default */

/* Remove no-js flag ASAP so we can target JS styles if needed */
document.documentElement.classList.remove('no-js');

(function () {
  // Reveal-on-scroll (safe: content is already visible without JS)
  const items = Array.from(document.querySelectorAll('.card, .divider'));
  if (!items.length) return;

  const reveal = el => el.classList.add('visible');

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
    items.forEach(el => io.observe(el));
  } else {
    // Fallback: reveal shortly after load
    window.addEventListener('load', () => items.forEach(reveal));
  }

  // Current year
  const y = document.getElementById('yr');
  if (y) y.textContent = new Date().getFullYear();

  // Extra MathJax nudge for slow in-app browsers
  window.addEventListener('load', () => {
    if (window.MathJax && typeof window.MathJax.typeset === 'function') {
      setTimeout(() => { try { window.MathJax.typeset(); } catch (_) {} }, 200);
    }
  });
})();
