"use strict";

/*
 * Homepage ambient life.
 *
 * A small, deliberately cheap 2D-canvas field behind the hero:
 * pollen-like motes in daylight and fireflies after dark, chosen from
 * the visitor's own hour. It carries no information and no state.
 * The keeper's Spark remains the existing Spark presence system —
 * this layer never creates, moves, or impersonates a Spark.
 *
 * Motion fences: slow drift only; no sound; no layout work after the
 * canvas is sized; animation pauses off-screen and while the tab is
 * hidden; and a reduced-motion visitor gets a single still drawing.
 */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const hero = document.querySelector(".home-hero");
  if (!hero || typeof hero.getContext === "function") return;
  if (document.querySelector("[data-home-ambient-life]")) return;

  const canvas = document.createElement("canvas");
  canvas.className = "home-ambient-life";
  canvas.dataset.homeAmbientLife = "";
  canvas.setAttribute("aria-hidden", "true");
  hero.prepend(canvas);

  const context = canvas.getContext && canvas.getContext("2d", { alpha: true });
  if (!context) {
    canvas.remove();
    return;
  }

  const hour = new Date().getHours();
  const mode = hour >= 5 && hour < 19 ? "pollen" : "fireflies";
  canvas.dataset.mode = mode;
  hero.dataset.ambientLife = mode;

  const reducedMotion = Boolean(
    document.documentElement.classList.contains("sof-reduced-motion") ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  );

  let width = 0;
  let height = 0;
  let particles = [];
  let rafId = null;
  let lastFrame = 0;
  let heroVisible = true;

  function seededRandom(seed) {
    let value = seed >>> 0;
    return function () {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function buildParticles() {
    const area = Math.max(1, width * height);
    const count = Math.round(Math.min(42, Math.max(16, area / 30000)));
    const random = seededRandom(mode === "pollen" ? 0x13a11 : 0xf17e5);
    particles = Array.from({ length: count }, (_, index) => ({
      x: random() * width,
      y: random() * height,
      radius: 0.8 + random() * (mode === "pollen" ? 1.7 : 2.1),
      drift: (random() - 0.5) * (mode === "pollen" ? 13 : 8),
      sink: (random() - 0.5) * 5 - (mode === "pollen" ? 2 : 0),
      sway: 4 + random() * 10,
      phase: random() * Math.PI * 2,
      speed: 0.08 + random() * 0.16,
      warm: index % 4 !== 3
    }));
    canvas.dataset.particleCount = String(count);
  }

  function resize() {
    const rect = hero.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(rect.width));
    const nextHeight = Math.max(1, Math.round(rect.height));
    if (nextWidth === width && nextHeight === height && particles.length) return;
    width = nextWidth;
    height = nextHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    buildParticles();
    draw(0);
  }

  function draw(elapsedSeconds) {
    context.clearRect(0, 0, width, height);
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const particle of particles) {
      const sway = Math.sin(elapsedSeconds * particle.speed + particle.phase) * particle.sway;
      const x = particle.x + sway;
      const y = particle.y + Math.cos(elapsedSeconds * particle.speed * 0.7 + particle.phase) * 2;
      const pulse =
        mode === "fireflies"
          ? 0.35 + 0.65 * Math.max(0, Math.sin(elapsedSeconds * 0.7 + particle.phase))
          : 0.52 + 0.18 * Math.sin(elapsedSeconds * particle.speed + particle.phase);
      const alpha = Math.max(0.08, Math.min(0.72, pulse));
      const halo = particle.radius * (mode === "fireflies" ? 4.2 : 3.1);
      const fill = particle.warm
        ? `rgba(255, 205, 105, ${alpha * 0.16})`
        : `rgba(151, 231, 205, ${alpha * 0.13})`;
      context.beginPath();
      context.fillStyle = fill;
      context.arc(x, y, halo, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.fillStyle = particle.warm
        ? `rgba(255, 226, 150, ${alpha})`
        : `rgba(178, 244, 214, ${alpha})`;
      context.arc(x, y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function step(timestamp) {
    rafId = null;
    if (!heroVisible || document.hidden) return;
    const elapsed = timestamp / 1000;
    // Redraw at ~20 fps, not ~30: the field's motion is a pure
    // function of elapsed time (drift integrates real deltas, sway
    // and pulse read the clock), so a slower cadence draws the exact
    // same field, sampled less often — and the compositor blends
    // this full-hero layer under the hero's live sphere canvas
    // half as often again while the sphere turns above it.
    if (!lastFrame || timestamp - lastFrame >= 50) {
      const delta = lastFrame ? Math.min(0.05, (timestamp - lastFrame) / 1000) : 0.016;
      for (const particle of particles) {
        particle.x += particle.drift * delta;
        particle.y += particle.sink * delta;
        if (particle.x < -12) particle.x = width + 12;
        if (particle.x > width + 12) particle.x = -12;
        if (particle.y < -12) particle.y = height + 12;
        if (particle.y > height + 12) particle.y = -12;
      }
      draw(elapsed);
      lastFrame = timestamp;
    }
    rafId = window.requestAnimationFrame(step);
  }

  function start() {
    if (reducedMotion || rafId != null || !heroVisible || document.hidden) return;
    lastFrame = 0;
    rafId = window.requestAnimationFrame(step);
  }

  function stop() {
    if (rafId != null) window.cancelAnimationFrame(rafId);
    rafId = null;
    lastFrame = 0;
  }

  resize();
  if (reducedMotion) {
    draw(1.25);
    return;
  }

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => {
      resize();
      start();
    });
    observer.observe(hero);
  } else {
    window.addEventListener("resize", resize, { passive: true });
  }

  if (typeof IntersectionObserver !== "undefined") {
    const observer = new IntersectionObserver(
      (entries) => {
        heroVisible = entries.some((entry) => entry.isIntersecting);
        if (heroVisible) start();
        else stop();
      },
      { threshold: 0.04 }
    );
    observer.observe(hero);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  start();
})();
