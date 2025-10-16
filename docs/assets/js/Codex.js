// Smooth scroll fade-in for cards
const reveal = () => {
  const els = document.querySelectorAll('.card');
  const h = window.innerHeight || document.documentElement.clientHeight;
  els.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < h * 0.88) el.classList.add('visible');
  });
};

window.addEventListener('scroll', reveal);
window.addEventListener('load', reveal);

// Fallback for no-JS browsers
document.head.insertAdjacentHTML('beforeend', `
  <noscript>
    <style>.card{opacity:1!important;transform:none!important}</style>
  </noscript>
`);
