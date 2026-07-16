(() => {
  "use strict";

  if (window.ScrollOfFireNavigation) return;

  const BREAKPOINT = 760;

  function trapFocus(event, container, toggle) {
    const focusable = Array.from(container.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(node => !node.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function initNavigation() {
    if (window.__SOF_NAVIGATION_INITIALIZED__) return;
    window.__SOF_NAVIGATION_INITIALIZED__ = true;

    const toggle = document.querySelector('[data-nav-toggle]');
    const nav = document.querySelector('[data-site-nav]');
    const backdrop = document.querySelector('[data-nav-backdrop]');
    const dropdowns = Array.from(document.querySelectorAll('[data-dropdown]'));
    if (!toggle || !nav) return;

    const closeDropdowns = except => {
      dropdowns.forEach(dropdown => {
        if (dropdown === except) return;
        dropdown.classList.remove('is-dropdown-open');
        dropdown.querySelector('[data-dropdown-toggle]')?.setAttribute('aria-expanded', 'false');
      });
    };

    const closeMenu = ({ returnFocus = false } = {}) => {
      nav.classList.remove('is-site-nav-open');
      document.body.classList.remove('site-menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation');
      backdrop?.setAttribute('hidden', '');
      closeDropdowns();
      if (returnFocus) toggle.focus();
    };

    const openMenu = () => {
      nav.classList.add('is-site-nav-open');
      document.body.classList.add('site-menu-open');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close navigation');
      backdrop?.removeAttribute('hidden');
      if (window.innerWidth <= BREAKPOINT) {
        nav.querySelector('a[href], button:not([disabled])')?.focus();
      }
    };

    const toggleDropdown = dropdown => {
      const button = dropdown.querySelector('[data-dropdown-toggle]');
      const willOpen = !dropdown.classList.contains('is-dropdown-open');
      closeDropdowns(willOpen ? dropdown : null);
      dropdown.classList.toggle('is-dropdown-open', willOpen);
      button?.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    };

    toggle.addEventListener('click', () => {
      if (nav.classList.contains('is-site-nav-open')) closeMenu({ returnFocus: true });
      else openMenu();
    });

    backdrop?.addEventListener('click', () => closeMenu({ returnFocus: true }));

    nav.addEventListener('click', event => {
      const dropdownButton = event.target.closest('[data-dropdown-toggle]');
      if (dropdownButton) {
        event.preventDefault();
        event.stopPropagation();
        toggleDropdown(dropdownButton.closest('[data-dropdown]'));
        return;
      }
      if (event.target.closest('a[href]')) closeMenu();
    });

    dropdowns.forEach(dropdown => {
      const button = dropdown.querySelector('[data-dropdown-toggle]');
      const menu = dropdown.querySelector('.nav-drop-menu');
      if (!button || !menu) return;

      dropdown.addEventListener('mouseenter', () => {
        if (window.innerWidth > BREAKPOINT) {
          closeDropdowns(dropdown);
          dropdown.classList.add('is-dropdown-open');
          button.setAttribute('aria-expanded', 'true');
        }
      });
      dropdown.addEventListener('mouseleave', () => {
        if (window.innerWidth > BREAKPOINT) {
          dropdown.classList.remove('is-dropdown-open');
          button.setAttribute('aria-expanded', 'false');
        }
      });

      button.addEventListener('keydown', event => {
        if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) return;
        event.preventDefault();
        dropdown.classList.add('is-dropdown-open');
        button.setAttribute('aria-expanded', 'true');
        const items = Array.from(menu.querySelectorAll('a[href]'));
        if (!items.length) return;
        (event.key === 'ArrowUp' ? items[items.length - 1] : items[0]).focus();
      });

      menu.addEventListener('keydown', event => {
        const items = Array.from(menu.querySelectorAll('a[href]'));
        if (!items.length) return;
        const index = items.indexOf(document.activeElement);
        if (event.key === 'Escape') {
          event.preventDefault();
          dropdown.classList.remove('is-dropdown-open');
          button.setAttribute('aria-expanded', 'false');
          button.focus();
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const direction = event.key === 'ArrowDown' ? 1 : -1;
          items[(index + direction + items.length) % items.length].focus();
        }
      });
    });

    document.addEventListener('click', event => {
      if (!event.target.closest('[data-site-nav]') && !event.target.closest('[data-nav-toggle]')) {
        closeDropdowns();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMenu({ returnFocus: true });
      if (event.key === 'Tab' && document.body.classList.contains('site-menu-open') && window.innerWidth <= BREAKPOINT) {
        trapFocus(event, nav, toggle);
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > BREAKPOINT) {
        backdrop?.setAttribute('hidden', '');
        document.body.classList.remove('site-menu-open');
        nav.classList.remove('is-site-nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  window.ScrollOfFireNavigation = { init: initNavigation };
})();
