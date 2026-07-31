(() => {
  "use strict";

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  const reducedData = connection?.saveData === true || /(^|-)2g$/.test(connection?.effectiveType || "");
  const lowMemory = typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4;
  const lowCpu = typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4;
  const constrained = reducedData || lowMemory || lowCpu;

  document.documentElement.classList.toggle("sof-reduced-motion", reducedMotion);
  document.documentElement.classList.toggle("sof-reduced-data", reducedData);
  document.documentElement.classList.toggle("sof-constrained-device", constrained);
  document.documentElement.dataset.sofPerformance = constrained ? "adaptive" : "full";

  function tuneImages(root = document) {
    const images = root.querySelectorAll?.("img") || [];
    images.forEach((img, index) => {
      const isHero = img.closest(".hero, .home-hero, [data-critical-media]") || img.fetchPriority === "high" || index === 0;
      if (!img.hasAttribute("decoding")) img.decoding = "async";
      if (!isHero && !img.hasAttribute("loading")) img.loading = "lazy";
      if (!isHero && !img.hasAttribute("fetchpriority")) img.fetchPriority = "low";
    });
  }

  function tuneIframes(root = document) {
    (root.querySelectorAll?.("iframe") || []).forEach(frame => {
      if (!frame.hasAttribute("loading")) frame.loading = "lazy";
    });
  }

  function pauseDecorativeMedia() {
    document.querySelectorAll("video[autoplay]").forEach(video => {
      if (document.hidden || constrained || reducedMotion) video.pause();
      else if (video.dataset.userPaused !== "true") video.play().catch(() => {});
    });
  }

  function publishProfile() {
    window.dispatchEvent(new CustomEvent("sof:performance-profile", {
      detail: Object.freeze({ constrained, reducedData, reducedMotion, lowMemory, lowCpu })
    }));
  }

  function init() {
    tuneImages();
    tuneIframes();
    pauseDecorativeMedia();
    publishProfile();

    if ("MutationObserver" in window) {
      const observer = new MutationObserver(records => {
        records.forEach(record => record.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node.matches("img")) tuneImages(node.parentElement || document);
          else tuneImages(node);
          tuneIframes(node);
        }));
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  document.addEventListener("visibilitychange", pauseDecorativeMedia, { passive: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
