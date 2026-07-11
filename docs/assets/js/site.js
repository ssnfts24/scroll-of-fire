/* Scroll of Fire — Unified Site Navigation + Shared Helpers */
(function () {
  "use strict";

  const root = document.documentElement;
  const body = document.body;
  const siteApi = window.ScrollOfFire || {};

  const SITE_ROOT = "/";
  const GITHUB_ROOT = "/scroll-of-fire/";
  const MOBILE_NAV_QUERY = "(max-width: 760px)";
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

  const LEGACY_PATHS = {
    "caravan.html": "covenant-caravan.html",
    "theory/artifacts.html": "theory/artifact-theory.html",
    "theory/delta-scaffold.html": "theory/delta-framework.html",
    "theory/theory/operators.html": "theory/operators.html"
  };

  root.classList.add("js-ready");

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  function boot() {
    setYear();
    normalizeInternalLinks();
    markActiveNavigation();
    initGlobalNavigation();
    enableCopyButtons();
    enableImageFallbacks();
    secureExternalLinks();
    syncDocumentLock();
    exposeSiteApi();
  }

  function exposeSiteApi() {
    window.ScrollOfFire = Object.assign(siteApi, {
      cleanPath,
      copyText,
      flashButton,
      getFocusable,
      prefersReducedMotion,
      resolveFromCodexRoot,
      syncDocumentLock
    });
  }

  function prefersReducedMotion() {
    return window.matchMedia?.(REDUCED_MOTION_QUERY).matches === true;
  }

  function getDeploymentRoot() {
    return location.hostname === "ssnfts24.github.io" ? GITHUB_ROOT : SITE_ROOT;
  }

  function removeDeploymentRoot(pathname) {
    let path = pathname || "/";

    if (path.startsWith(GITHUB_ROOT)) {
      path = path.slice(GITHUB_ROOT.length);
    } else {
      path = path.replace(/^\/+/, "");
    }

    return path || "index.html";
  }

  function normalizeEquationPath(path) {
    return path.replace(/^theory\/(?:eq)(\d{2}|04b)\.html$/i, "theory/equations/eq$1.html");
  }

  function cleanPath(value) {
    if (!value) return "";

    let path = String(value).split("#")[0].split("?")[0].trim();

    try {
      path = decodeURIComponent(path);
    } catch (_) {}

    path = path
      .replace(/^https?:\/\/(?:www\.)?codexofreality\.org\//i, "")
      .replace(/^https?:\/\/ssnfts24\.github\.io\/scroll-of-fire\//i, "")
      .replace(/^\/scroll-of-fire\//, "")
      .replace(/^\/+/, "")
      .replace(/^\.\//, "");

    if (!path || path.endsWith("/")) {
      path += "index.html";
    }

    path = normalizeEquationPath(path);

    return LEGACY_PATHS[path] || path;
  }

  function resolveFromCodexRoot(path) {
    const clean = cleanPath(path);
    const rootPath = getDeploymentRoot();
    return `${rootPath}${clean === "index.html" ? "" : clean}`;
  }

  function isIgnoredHref(href) {
    return (
      !href ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("sms:") ||
      href.startsWith("javascript:") ||
      href.startsWith("vbscript:") ||
      href.startsWith("data:")
    );
  }

  function isExternalHref(href) {
    try {
      const url = new URL(href, location.href);
      return url.origin !== location.origin;
    } catch (_) {
      return false;
    }
  }

  function normalizeInternalLinks() {
    document.querySelectorAll("a[href]").forEach(function (anchor) {
      const original = anchor.getAttribute("href");

      if (isIgnoredHref(original) || isExternalHref(original)) {
        return;
      }

      const hash = original.includes("#") ? `#${original.split("#").slice(1).join("#")}` : "";
      const queryPart = original.split("#")[0];
      const query = queryPart.includes("?") ? `?${queryPart.split("?").slice(1).join("?")}` : "";
      const pathOnly = queryPart.split("?")[0];

      if (!pathOnly) return;

      const canonical = cleanPath(pathOnly);
      if (!canonical) return;

      anchor.href = `${resolveFromCodexRoot(canonical)}${query}${hash}`;
    });
  }

  function markActiveNavigation() {
    const current = cleanPath(removeDeploymentRoot(location.pathname));

    document
      .querySelectorAll(".site-nav a[href], .site-footer a[href], [data-section-link][href]")
      .forEach(function (anchor) {
        anchor.removeAttribute("aria-current");
        anchor.classList.remove("is-current", "is-current-section");

        const href = anchor.getAttribute("href");
        if (!href || isIgnoredHref(href)) return;

        const target = cleanPath(href);
        if (!target) return;

        if (target === current) {
          anchor.setAttribute("aria-current", "page");
          anchor.classList.add("is-current");
          return;
        }

        if (isSameSection(current, target)) {
          anchor.setAttribute("aria-current", "location");
          anchor.classList.add("is-current-section");
        }
      });
  }

  function isSameSection(current, target) {
    const currentSection = getSection(current);
    const targetSection = getSection(target);
    return !!currentSection && currentSection === targetSection;
  }

  function getSection(path) {
    if (path === "theory.html" || path.startsWith("theory/")) return "theory";
    if (path === "hub.html" || path.startsWith("systems/")) return "systems";
    if (path === "shop.html" || path.startsWith("artifacts/")) return "artifacts";
    if (path === "moons.html" || path.startsWith("moons/")) return "moons";
    if (path === "covenant-caravan.html" || path.startsWith("caravan/")) return "caravan";
    return "";
  }

  function getFocusable(container) {
    if (!container) return [];

    return Array.from(
      container.querySelectorAll(
        [
          'a[href]:not([tabindex="-1"])',
          'button:not([disabled]):not([tabindex="-1"])',
          'input:not([disabled]):not([tabindex="-1"])',
          'select:not([disabled]):not([tabindex="-1"])',
          'textarea:not([disabled]):not([tabindex="-1"])',
          '[tabindex]:not([tabindex="-1"])'
        ].join(',')
      )
    ).filter(function (element) {
      return !element.hidden && element.getAttribute("aria-hidden") !== "true" && element.offsetParent !== null;
    });
  }

  function syncDocumentLock() {
    const shouldLock =
      body?.classList.contains("site-menu-open") ||
      body?.classList.contains("command-open") ||
      document.querySelector("[data-theory-nav].is-theory-nav-open") !== null;

    root.style.overflow = shouldLock ? "hidden" : "";
  }

  function initGlobalNavigation() {
    const button = document.querySelector("[data-nav-toggle]");
    const nav = document.querySelector("[data-site-nav]");
    const dropdown = document.querySelector("[data-dropdown]");
    const dropdownButton = document.querySelector("[data-dropdown-toggle]");

    if (!button || !nav) return;

    const media = window.matchMedia(MOBILE_NAV_QUERY);
    let returnFocus = null;

    function isNavOpen() {
      return nav.classList.contains("is-site-nav-open");
    }

    function isDropdownOpen() {
      return dropdown?.classList.contains("is-dropdown-open") === true;
    }

    function setDropdownState(open) {
      if (!dropdown || !dropdownButton) return;
      dropdown.classList.toggle("is-dropdown-open", open);
      dropdownButton.setAttribute("aria-expanded", String(open));
    }

    function closeDropdown(options = {}) {
      const { restoreFocus = false } = options;
      const wasOpen = isDropdownOpen();

      setDropdownState(false);

      if (wasOpen && restoreFocus) {
        requestAnimationFrame(function () {
          dropdownButton?.focus({ preventScroll: true });
        });
      }
    }

    function setNavState(open) {
      const mobileOpen = open && media.matches;

      nav.classList.toggle("is-site-nav-open", mobileOpen);
      body?.classList.toggle("site-menu-open", mobileOpen);

      button.setAttribute("aria-expanded", String(mobileOpen));
      button.setAttribute("aria-label", mobileOpen ? "Close navigation" : "Open navigation");

      if (media.matches) {
        nav.setAttribute("aria-hidden", String(!mobileOpen));
      } else {
        nav.removeAttribute("aria-hidden");
      }

      if (!mobileOpen) {
        closeDropdown();
      }

      syncDocumentLock();
    }

    function openNav() {
      if (!media.matches || isNavOpen()) return;

      returnFocus = document.activeElement;
      setNavState(true);

      const firstItem = getFocusable(nav)[0];
      if (firstItem) {
        requestAnimationFrame(function () {
          firstItem.focus({ preventScroll: true });
        });
      }
    }

    function closeNav(options = {}) {
      const { restoreFocus = false } = options;
      const wasOpen = isNavOpen();

      setNavState(false);

      if (wasOpen && restoreFocus) {
        const focusTarget = returnFocus instanceof HTMLElement ? returnFocus : button;
        requestAnimationFrame(function () {
          focusTarget.focus({ preventScroll: true });
        });
      }

      returnFocus = null;
    }

    function trapFocus(event) {
      if (event.key !== "Tab" || !media.matches || !isNavOpen()) return;

      const focusable = getFocusable(nav);
      if (!focusable.length) {
        event.preventDefault();
        button.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    button.addEventListener("click", function () {
      if (isNavOpen()) {
        closeNav({ restoreFocus: true });
      } else {
        openNav();
      }
    });

    dropdownButton?.addEventListener("click", function (event) {
      event.stopPropagation();
      setDropdownState(!isDropdownOpen());
    });

    nav.addEventListener("click", function (event) {
      const link = event.target.closest("a[href]");
      if (!link) return;

      closeDropdown();
      if (media.matches) {
        closeNav();
      }
    });

    document.addEventListener("click", function (event) {
      if (dropdown && isDropdownOpen() && !dropdown.contains(event.target)) {
        closeDropdown();
      }

      if (!media.matches || !isNavOpen()) return;
      if (button.contains(event.target) || nav.contains(event.target)) return;

      closeNav();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (isDropdownOpen()) {
          event.preventDefault();
          closeDropdown({ restoreFocus: true });
          return;
        }

        if (isNavOpen()) {
          event.preventDefault();
          closeNav({ restoreFocus: true });
          return;
        }
      }

      trapFocus(event);
    });

    function handleViewportChange() {
      if (!media.matches) {
        closeNav();
        nav.removeAttribute("aria-hidden");
      } else {
        setNavState(false);
      }
    }

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleViewportChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(handleViewportChange);
    }

    if (media.matches) {
      setNavState(false);
    } else {
      nav.removeAttribute("aria-hidden");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Open navigation");
      syncDocumentLock();
    }
  }

  function enableCopyButtons() {
    document.querySelectorAll("[data-copy]").forEach(function (button) {
      if (button.dataset.copyReady === "true") return;
      button.dataset.copyReady = "true";

      button.addEventListener("click", async function () {
        const value = getCopyValue(button);
        if (!value) {
          flashButton(button, "Nothing to copy");
          return;
        }

        const copied = await copyText(value);
        flashButton(button, copied ? "Copied" : "Copy failed");
      });
    });
  }

  function getCopyValue(button) {
    const directive = button.getAttribute("data-copy");

    if (!directive) {
      return button.dataset.copyText || "";
    }

    if (directive.startsWith("#") || directive.startsWith(".") || directive.startsWith("[")) {
      try {
        const target = document.querySelector(directive);
        return target ? target.innerText.trim() : "";
      } catch (_) {
        return "";
      }
    }

    return directive.trim();
  }

  async function copyText(value) {
    const text = String(value || "").trim();
    if (!text) return false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}

    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    field.style.top = "0";
    field.style.opacity = "0";

    body?.appendChild(field);
    field.focus();
    field.select();
    field.setSelectionRange(0, field.value.length);

    let copied = false;

    try {
      copied = document.execCommand("copy");
    } catch (_) {
      copied = false;
    }

    field.remove();
    return copied;
  }

  function flashButton(button, text, duration = 1000) {
    if (!(button instanceof HTMLElement)) return;

    const original = button.dataset.originalText || button.textContent;
    button.dataset.originalText = original;
    button.textContent = text;

    window.clearTimeout(button._sofFlashTimer);
    button._sofFlashTimer = window.setTimeout(function () {
      button.textContent = original;
    }, duration);
  }

  function enableImageFallbacks() {
    document.querySelectorAll("img[data-fallbacks]").forEach(function (img) {
      const list = img.dataset.fallbacks
        .split(",")
        .map(function (item) {
          return item.trim();
        })
        .filter(Boolean);

      function handleImageError() {
        const next = list.shift();

        if (next) {
          img.src = next;
          img.dataset.fallbacks = list.join(",");
          return;
        }

        img.removeEventListener("error", handleImageError);
        img.hidden = true;
      }

      img.addEventListener("error", handleImageError);
    });
  }

  function secureExternalLinks() {
    document.querySelectorAll("a[href]").forEach(function (anchor) {
      const href = anchor.getAttribute("href");

      if (!href || !isExternalHref(href)) return;

      if (anchor.target === "_blank") {
        const rel = new Set((anchor.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
        rel.add("noopener");
        rel.add("noreferrer");
        anchor.setAttribute("rel", Array.from(rel).join(" "));
      }
    });
  }

  function setYear() {
    const year = document.getElementById("year");
    if (year) {
      year.textContent = String(new Date().getFullYear());
    }
  }
})();
