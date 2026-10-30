"use strict";

(() => {
  const savedTheme = localStorage.getItem("sof-scroll-theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    document.documentElement.dataset.theme = savedTheme;
  }
})();
