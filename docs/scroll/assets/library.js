"use strict";

(() => {
  const savedTheme = localStorage.getItem("sof-scroll-theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    document.documentElement.dataset.theme = savedTheme;
  }

  /* Continue where you left off: the reader remembers the last passage
     opened (sof-scroll-last-passage, written by reader.js). The library
     door offers it back. Local only; nothing is transmitted. */
  let last = null;
  try {
    last = JSON.parse(localStorage.getItem("sof-scroll-last-passage") || "null");
  } catch (e) { last = null; }
  if (!last || !last.id || !last.title) return;
  const hero = document.querySelector(".library-hero");
  if (!hero) return;
  const bar = document.createElement("p");
  bar.className = "continue-reading";
  const label = document.createElement("span");
  label.textContent = "Continue where you left off: ";
  const link = document.createElement("a");
  link.href = `reader.html?section=${encodeURIComponent(last.id)}`;
  link.textContent = last.title;
  const note = document.createElement("span");
  note.className = "continue-note";
  note.textContent = " (remembered in this browser only)";
  bar.append(label, link, note);
  hero.insertAdjacentElement("afterend", bar);
})();
