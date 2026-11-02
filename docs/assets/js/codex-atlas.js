(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector("[data-atlas-filters]");
    const cards = [...document.querySelectorAll("[data-atlas-card]")];
    const areas = [...document.querySelectorAll("[data-atlas-area]")];
    const count = document.querySelector("[data-atlas-count]");
    const empty = document.querySelector("[data-atlas-empty]");
    if (!form || !cards.length || !count || !empty) return;

    const search = form.elements.namedItem("q");
    const area = form.elements.namedItem("area");
    const category = form.elements.namedItem("category");
    const type = form.elements.namedItem("type");
    const status = form.elements.namedItem("status");

    function update() {
      const query = search.value.trim().toLocaleLowerCase();
      let visible = 0;
      const visibleByArea = new Map();
      cards.forEach(function (card) {
        const matches = (!query || card.textContent.toLocaleLowerCase().includes(query))
          && (!area.value || card.dataset.area === area.value)
          && (!category.value || card.dataset.category === category.value)
          && (!type.value || card.dataset.type === type.value)
          && (!status.value || card.dataset.status === status.value);
        card.hidden = !matches;
        if (matches) {
          visible += 1;
          visibleByArea.set(card.dataset.area, (visibleByArea.get(card.dataset.area) || 0) + 1);
        }
      });
      areas.forEach(function (section) {
        section.hidden = !visibleByArea.has(section.dataset.atlasArea);
      });
      count.textContent = `${visible} ${visible === 1 ? "resource" : "resources"} shown`;
      empty.hidden = visible !== 0;
    }

    form.hidden = false;
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("reset", function () {
      window.requestAnimationFrame(update);
    });
  });
})();
