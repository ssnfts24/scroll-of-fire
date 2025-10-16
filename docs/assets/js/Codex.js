// Small niceties: glow pulse on dividers and tooltip support for <abbr>.
(function(){
  const pulses = document.querySelectorAll('.divider.glow span');
  pulses.forEach(el => {
    el.animate(
      [
        { boxShadow: '0 0 0 rgba(255,216,107,0)' },
        { boxShadow: '0 0 24px rgba(255,216,107,.35), 0 0 48px rgba(255,216,107,.15)' },
        { boxShadow: '0 0 0 rgba(255,216,107,0)' }
      ],
      { duration: 3500, iterations: Infinity }
    );
  });
})();
