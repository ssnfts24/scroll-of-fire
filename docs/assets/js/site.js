/* Scroll of Fire — Shared front-end helpers
   File: docs/assets/js/site.js
*/

(function () {
  "use strict";

  const MOBILE_BREAKPOINT = 760;

  document.documentElement.classList.add("js-ready");
  const navManagedExternally = document.documentElement.hasAttribute("data-sof-nav-managed");

  document.addEventListener("DOMContentLoaded", function () {
    setHeaderHeight();
    markActiveNav();
    if (!navManagedExternally) {
      setupSiteNavigation();
    }
    setupTheoryNavigation();
    enableCopyButtons();
    enhanceMediaLoading();
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

      syncDropdownAlignment();
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

        // Mark "Theory" link active when inside theory/ sub-pages
        const isTheorySection =
          currentPath.startsWith("/theory/") &&
          targetPath === "/theory.html";

        // Mark relevant Explore links active when in a theory/ equation page
        const isEquationsSection =
          currentPath.startsWith("/theory/equations/") &&
          targetPath.startsWith("/theory/");

        // Mark "Systems Archive" active for systems/ pages
        const isSystemsSection =
          currentPath.startsWith("/systems/") &&
          targetPath === "/systems/archive.html";

        const isActive =
          isHome || isExact || isTheorySection || isEquationsSection || isSystemsSection;

        if (isActive) {
          anchor.setAttribute("aria-current", "page");

          // Mark parent dropdown as having an active child
          const parentDropdown = anchor.closest("[data-dropdown]");
          if (parentDropdown) {
            parentDropdown.classList.add("has-active-child");
          }
        } else {
          anchor.removeAttribute("aria-current");
        }

        anchor.classList.toggle(
          "is-current-section",
          isTheorySection || isEquationsSection || isSystemsSection
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
        const dropdown = button.closest("[data-dropdown]");
        const menu = dropdown?.querySelector(".nav-drop-menu");

        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();

          if (!dropdown) return;

          const willOpen =
            !dropdown.classList.contains("is-dropdown-open");

          if (willOpen) {
            openDropdown(dropdown);
          } else {
            closeDropdown(dropdown);
          }
        });

        button.addEventListener("keydown", function (event) {
          if (!dropdown || !menu) return;

          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openDropdown(dropdown);
            focusDropdownItem(
              dropdown,
              event.key === "ArrowUp" ? "last" : "first"
            );
          }

          if (
            (event.key === "Enter" || event.key === " ") &&
            window.innerWidth > MOBILE_BREAKPOINT
          ) {
            event.preventDefault();
            openDropdown(dropdown);
            focusDropdownItem(dropdown, "first");
          }
        });

        if (menu) {
          menu.addEventListener("keydown", function (event) {
            handleDropdownMenuKeydown(event, dropdown);
          });
        }

        dropdown?.addEventListener("mouseenter", function () {
          if (window.innerWidth > MOBILE_BREAKPOINT) {
            openDropdown(dropdown);
          }
        });

        dropdown?.addEventListener("mouseleave", function () {
          if (window.innerWidth > MOBILE_BREAKPOINT) {
            closeDropdown(dropdown);
          }
        });

        dropdown?.addEventListener("focusin", function () {
          if (window.innerWidth > MOBILE_BREAKPOINT) {
            openDropdown(dropdown);
          }
        });

        dropdown?.addEventListener("focusout", function (event) {
          if (
            window.innerWidth > MOBILE_BREAKPOINT &&
            !dropdown.contains(event.relatedTarget)
          ) {
            closeDropdown(dropdown);
          }
        });
      });

    syncDropdownAlignment();
  }

  function openDropdown(dropdown) {
    if (!dropdown) return;

    closeAllDropdowns(dropdown);
    dropdown.classList.add("is-dropdown-open");

    const button = dropdown.querySelector("[data-dropdown-toggle]");

    if (button) {
      button.setAttribute("aria-expanded", "true");
    }

    syncDropdownAlignment();
  }

  function closeDropdown(dropdown) {
    if (!dropdown) return;

    dropdown.classList.remove("is-dropdown-open");

    const button = dropdown.querySelector("[data-dropdown-toggle]");

    if (button) {
      button.setAttribute("aria-expanded", "false");
    }
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

  function closeAllDropdowns(exceptDropdown) {
    document
      .querySelectorAll("[data-dropdown]")
      .forEach(function (dropdown) {
        if (dropdown !== exceptDropdown) {
          closeDropdown(dropdown);
        }
      });
  }

  function focusDropdownItem(dropdown, position) {
    const items = getDropdownItems(dropdown);

    if (!items.length) return;

    (position === "last"
      ? items[items.length - 1]
      : items[0]
    ).focus();
  }

  function getDropdownItems(dropdown) {
    return Array.from(
      dropdown?.querySelectorAll(".nav-drop-menu a[href]") || []
    );
  }

  function handleDropdownMenuKeydown(event, dropdown) {
    const items = getDropdownItems(dropdown);

    if (!items.length) return;

    const currentIndex = items.indexOf(document.activeElement);

    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown(dropdown);
      dropdown
        ?.querySelector("[data-dropdown-toggle]")
        ?.focus();
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      (event.key === "End"
        ? items[items.length - 1]
        : items[0]
      ).focus();
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    event.preventDefault();

    const delta = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + delta + items.length) % items.length;

    items[nextIndex].focus();
  }

  function syncDropdownAlignment() {
    if (window.innerWidth <= MOBILE_BREAKPOINT) return;

    document
      .querySelectorAll("[data-dropdown]")
      .forEach(function (dropdown) {
        dropdown.removeAttribute("data-drop-align");

        const menu = dropdown.querySelector(".nav-drop-menu");

        if (!menu) return;

        const rect = menu.getBoundingClientRect();

        if (rect.right > window.innerWidth - 16) {
          dropdown.setAttribute("data-drop-align", "end");
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

  function enhanceMediaLoading() {
    const main = document.querySelector("main");

    if (!main) return;

    const primaryImage = main.querySelector("img");

    main.querySelectorAll("img").forEach(function (image) {
      if (!image.hasAttribute("decoding")) {
      image.setAttribute("decoding", "async");
      }

      if (!image.hasAttribute("loading")) {
      const isPrimary =
        image === primaryImage ||
        image.closest(
          ".page-hero-figure, .hero-image-card, .theory-hero-visual, .shop-hero-card, .tensor-media"
        );

      image.setAttribute("loading", isPrimary ? "eager" : "lazy");

      if (!isPrimary && !image.hasAttribute("fetchpriority")) {
        image.setAttribute("fetchpriority", "low");
      }
      }
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

  function prefersReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  }

  window.ScrollOfFire = Object.assign(window.ScrollOfFire || {}, {
    normalizePath,
    getAnchorPath,
    debounce,
    copyText,
    prefersReducedMotion
  });
})();
