// Simple fade/slide reveal on scroll
const reveal = () => {
  const els = document.querySelectorAll('.card, .divider');
  const h = window.innerHeight || document.documentElement.clientHeight;
  els.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < h * 0.88) el.classList.add('visible');
  });
};
window.addEventListener('scroll', reveal);
window.addEventListener('load', reveal);

// Add a subtle class for CSS transitions (optional)
document.head.insertAdjacentHTML('beforeend', `
  <style>
    .card, .divider { opacity:0; transform: translateY(12px); transition: opacity .6s ease, transform .6s ease }
    .card.visible, .divider.visible { opacity:1; transform: none }
  </style>
`);
