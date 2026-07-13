/* Scroll of Fire — Shared front-end helpers
   File: docs/assets/js/site.js
*/

(function () {
  "use strict";

  const MOBILE_BREAKPOINT = 760;

  document.documentElement.classList.add("js-ready");

  document.addEventListener("DOMContentLoaded", function () {
    setHeaderHeight();
    markActiveNav();
    setupSiteNavigation();
    setupTheoryNavigation();
    enableCopyButtons();
    enableImageFallbacks();
    updateCopyrightYear();
  });

  window.addEventListener(
    "resize",
    debounce(function () {
      setHeaderHeight();

      if (window.innerWidth > MOBILE_BREAKPOINT) {
        closeSiteMenu();
      }
    }, 120)
  );

  function setHeaderHeight() {
    const header = document.querySelector("[data-sof-header]");

    if (!header) return;

    document.documentElement.style.setProperty(
      "--header-h",
      header.offsetHeight + "px"
    );
  }

  function normalizePath(path) {
    let normalized = String(path || "")
      .split("#")[0]
      .split("?")[0]
      .replace(/\/+/g, "/")
      .replace(/\/$/, "");

    if (normalized.startsWith("/scroll-of-fire")) {
      normalized = normalized.replace(/^\/scroll-of-fire/, "");
    }

    if (!normalized) {
      normalized = "/";
    }

    return normalized;
  }

  function getAnchorPath(anchor) {
    try {
      const url = new URL(anchor.getAttribute("href"), window.location.href);
      return normalizePath(url.pathname);
    } catch (error) {
      return "";
    }
  }

  function markActiveNav() {
    const currentPath = normalizePath(window.location.pathname);

    document
      .querySelectorAll(".site-nav a[href], .theory-nav-links a[href]")
      .forEach(function (anchor) {
        const targetPath = getAnchorPath(anchor);

        const isHome =
          currentPath === "/" &&
          (targetPath === "/" || targetPath === "/index.html");

        const isExact =
          currentPath !== "/" &&
          targetPath !== "/" &&
          targetPath === currentPath;

        const isTheorySection =
          currentPath.startsWith("/theory/") &&
          targetPath === "/theory.html";

        const isSystemsSection =
          currentPath.startsWith("/systems/") &&
          targetPath === "/hub.html";

        const isActive =
          isHome || isExact || isTheorySection || isSystemsSection;

        if (isActive) {
          anchor.setAttribute("aria-current", "page");
        } else {
          anchor.removeAttribute("aria-current");
        }

        anchor.classList.toggle(
          "is-current-section",
          isTheorySection || isSystemsSection
        );
      });
  }

  function setupSiteNavigation() {
    const toggle = document.querySelector("[data-nav-toggle]");
    const nav = document.querySelector("[data-site-nav]");

    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      const isOpen = nav.classList.contains("is-site-nav-open");

      if (isOpen) {
        closeSiteMenu();
      } else {
        openSiteMenu(toggle, nav);
      }
    });

    nav.addEventListener("click", function (event) {
      const link = event.target.closest("a[href]");

      if (link && window.innerWidth <= MOBILE_BREAKPOINT) {
        closeSiteMenu();
      }
    });

    document.addEventListener("click", function (event) {
      const clickedInsideDropdown = event.target.closest("[data-dropdown]");
      const clickedToggle = event.target.closest("[data-nav-toggle]");
      const clickedNav = event.target.closest("[data-site-nav]");

      if (
        !clickedInsideDropdown &&
        !clickedToggle &&
        !clickedNav
      ) {
        closeAllDropdowns();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeAllDropdowns();

        if (document.body.classList.contains("site-menu-open")) {
          closeSiteMenu();
          toggle.focus();
        }
      }

      if (
        event.key === "Tab" &&
        document.body.classList.contains("site-menu-open") &&
        window.innerWidth <= MOBILE_BREAKPOINT
      ) {
        trapFocus(event, nav, toggle);
      }
    });

    document
      .querySelectorAll("[data-dropdown-toggle]")
      .forEach(function (button) {
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();

          const dropdown = button.closest("[data-dropdown]");

          if (!dropdown) return;

          const willOpen =
            !dropdown.classList.contains("is-dropdown-open");

          closeAllDropdowns();

          dropdown.classList.toggle(
            "is-dropdown-open",
            willOpen
          );

          button.setAttribute(
            "aria-expanded",
            String(willOpen)
          );
        });
      });
  }

  function openSiteMenu(toggle, nav) {
    nav.classList.add("is-site-nav-open");
    document.body.classList.add("site-menu-open");

    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close navigation");
  }

  function closeSiteMenu() {
    const toggle = document.querySelector("[data-nav-toggle]");
    const nav = document.querySelector("[data-site-nav]");

    if (nav) {
      nav.classList.remove("is-site-nav-open");
    }

    document.body.classList.remove("site-menu-open");
    closeAllDropdowns();

    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation");
    }
  }

  function closeAllDropdowns() {
    document
      .querySelectorAll("[data-dropdown]")
      .forEach(function (dropdown) {
        dropdown.classList.remove("is-dropdown-open");

        const button = dropdown.querySelector(
          "[data-dropdown-toggle]"
        );

        if (button) {
          button.setAttribute("aria-expanded", "false");
        }
      });
  }

  function setupTheoryNavigation() {
    document
      .querySelectorAll("[data-theory-nav-toggle]")
      .forEach(function (button) {
        const shell = button.closest(".theory-subnav");

        if (!shell) return;

        button.addEventListener("click", function () {
          const willOpen =
            !shell.classList.contains("is-theory-nav-open");

          shell.classList.toggle(
            "is-theory-nav-open",
            willOpen
          );

          button.setAttribute(
            "aria-expanded",
            String(willOpen)
          );
        });

        shell
          .querySelectorAll("a[href]")
          .forEach(function (link) {
            link.addEventListener("click", function () {
              shell.classList.remove("is-theory-nav-open");
              button.setAttribute("aria-expanded", "false");
            });
          });
      });
  }

  function enableCopyButtons() {
    document
      .querySelectorAll("[data-copy-target]")
      .forEach(function (button) {
        button.addEventListener("click", async function () {
          const selector = button.getAttribute("data-copy-target");

          if (!selector) return;

          const target = document.querySelector(selector);

          if (!target) return;

          const value =
            target.value ||
            target.textContent ||
            "";

          const originalText = button.textContent;

          try {
            await copyText(value.trim());

            button.textContent =
              button.getAttribute("data-copy-success") ||
              "Copied";
          } catch (error) {
            button.textContent = "Copy failed";
          }

          window.setTimeout(function () {
            button.textContent = originalText;
          }, 1400);
        });
      });
  }

  async function copyText(value) {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");

    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    const successful = document.execCommand("copy");

    textarea.remove();

    if (!successful) {
      throw new Error("Copy command failed");
    }
  }

  function enableImageFallbacks() {
    document
      .querySelectorAll("img[data-fallbacks]")
      .forEach(function (image) {
        const fallbackString =
          image.getAttribute("data-fallbacks") || "";

        const fallbacks = fallbackString
          .split(",")
          .map(function (item) {
            return item.trim();
          })
          .filter(Boolean);

        let fallbackIndex = 0;

        function tryNextFallback() {
          if (fallbackIndex >= fallbacks.length) {
            image.removeEventListener(
              "error",
              tryNextFallback
            );

            image.classList.add("image-fallback-failed");
            image.hidden = true;
            return;
          }

          const nextSource = fallbacks[fallbackIndex];
          fallbackIndex += 1;

          image.src = nextSource;
        }

        image.addEventListener("error", tryNextFallback);
      });
  }

  function updateCopyrightYear() {
    const year = String(new Date().getFullYear());

    document
      .querySelectorAll(
        "#year, #yr, [data-current-year]"
      )
      .forEach(function (node) {
        node.textContent = year;
      });
  }

  function trapFocus(event, container, fallback) {
    const focusable = Array.from(
      container.querySelectorAll(
        [
          "a[href]",
          "button:not([disabled])",
          "input:not([disabled])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          '[tabindex]:not([tabindex="-1"])'
        ].join(",")
      )
    ).filter(function (node) {
      return (
        !node.hasAttribute("hidden") &&
        node.offsetParent !== null
      );
    });

    if (!focusable.length) {
      event.preventDefault();
      fallback.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (
      event.shiftKey &&
      document.activeElement === first
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === last
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  function debounce(callback, wait) {
    let timer;

    return function () {
      const context = this;
      const args = arguments;

      window.clearTimeout(timer);

      timer = window.setTimeout(function () {
        callback.apply(context, args);
      }, wait);
    };
  }
})();
