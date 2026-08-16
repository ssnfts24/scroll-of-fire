(() => {
  "use strict";

  const SEARCH_ABORTS = new WeakMap();
  const ATTACHED_ROOTS = new WeakSet();

  function setText(root, selector, value) {
    const el = root.querySelector(selector);
    if (el) el.textContent = value;
  }

  function clearChildren(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function formatPlace(place) {
    if (!place) return "LOCATION NOT SET";
    const parts = [place.name, place.region, place.country].filter(Boolean);
    return parts.join(", ") || "Device location";
  }

  function attach(root) {
    const adapter = globalThis.OpenMeteoAdapter;
    if (!adapter || !root || ATTACHED_ROOTS.has(root)) return;
    ATTACHED_ROOTS.add(root);

    const stateEl = root.querySelector("[data-location-state]");
    const statusEl = root.querySelector("[data-location-status]");
    const resultsEl = root.querySelector("[data-location-results]");
    const searchInput = root.querySelector("[data-location-search-input]");
    const latInput = root.querySelector("[data-location-lat]");
    const lonInput = root.querySelector("[data-location-lon]");
    const nameInput = root.querySelector("[data-location-name]");

    const refreshState = () => {
      const place = adapter.getActivePlace?.() || null;
      root.classList.toggle("has-active-place", !!place);
      if (!place) root.classList.add("is-editing-place");
      else if (!root.dataset.userEditing) root.classList.remove("is-editing-place");
      if (stateEl) stateEl.textContent = place ? formatPlace(place) : "LOCATION NOT SET";
      if (statusEl) statusEl.textContent = place
        ? "Active place ready. Weather is shared across the homepage, calendar, and Observatory."
        : "Choose a location to enable environmental layers.";
      let change = root.querySelector("[data-location-change]");
      if (place && !change) {
        change = document.createElement("button");
        change.type = "button";
        change.className = "sphere-chip-btn sphere-location-change";
        change.dataset.locationChange = "";
        change.textContent = "Change location";
        change.addEventListener("click", () => { root.dataset.userEditing = "true"; root.classList.toggle("is-editing-place"); });
        stateEl?.insertAdjacentElement("afterend", change);
      }
      if (!place && change) change.remove();
    };

    const broadcast = () => {
      window.dispatchEvent(new CustomEvent("sof:location-changed", { detail: { place: adapter.getActivePlace?.() || null } }));
    };

    const setBusy = (button, busyText) => {
      if (!button) return () => {};
      const old = button.textContent;
      button.disabled = true;
      button.textContent = busyText;
      return () => {
        button.disabled = false;
        button.textContent = old;
      };
    };

    root.querySelector("[data-location-use-device]")?.addEventListener("click", async event => {
      const done = setBusy(event.currentTarget, "Locating…");
      if (statusEl) statusEl.textContent = "Requesting permission…";
      try {
        await adapter.requestDeviceLocation();
        if (statusEl) statusEl.textContent = "Location found. Loading weather…";
        const result = await adapter.requestRefresh?.({ force: true });
        if (statusEl) statusEl.textContent = result?.current
          ? "Location set from device. Live weather is ready."
          : "Location saved. Weather is temporarily unavailable.";
        refreshState();
        broadcast();
      } catch (error) {
        const code = Number(error?.code);
        if (code === 1) {
          if (statusEl) statusEl.textContent = "Location permission denied. You can search or enter coordinates.";
        } else if (code === 3) {
          if (statusEl) statusEl.textContent = "Location timed out. Please retry.";
        } else {
          if (statusEl) statusEl.textContent = "Unable to use device location. Please retry or use search.";
        }
      } finally {
        done();
      }
    });

    root.querySelector("[data-location-continue-without]")?.addEventListener("click", () => {
      adapter.continueWithoutLocation?.();
      if (statusEl) statusEl.textContent = "Continuing without weather.";
      refreshState();
      broadcast();
    });

    root.querySelector("[data-location-search-submit]")?.addEventListener("click", async event => {
      const query = String(searchInput?.value || "").trim();
      if (!query) {
        if (statusEl) statusEl.textContent = "Enter a place name to search.";
        return;
      }
      clearChildren(resultsEl);
      const old = SEARCH_ABORTS.get(root);
      old?.abort();
      const controller = new AbortController();
      SEARCH_ABORTS.set(root, controller);
      const done = setBusy(event.currentTarget, "Searching…");
      try {
        const results = await adapter.searchCity(query, controller.signal);
        if (!results.length) {
          if (statusEl) statusEl.textContent = "No places found.";
          return;
        }
        if (statusEl) statusEl.textContent = "Select a place.";
        clearChildren(resultsEl);
        results.forEach(place => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "sphere-location-result";
          button.textContent = `${place.name}${place.region ? `, ${place.region}` : ""}${place.country ? `, ${place.country}` : ""} · ${place.latitude.toFixed(3)}, ${place.longitude.toFixed(3)} · ${place.timezone || "timezone unknown"}`;
          button.addEventListener("click", async () => {
            const doneSelecting = setBusy(button, "Loading…");
            try {
              adapter.setActivePlace(place);
              if (statusEl) statusEl.textContent = "Location selected. Loading weather…";
              const result = await adapter.requestRefresh?.({ force: true });
              if (statusEl) statusEl.textContent = result?.current
                ? "Location selected. Live weather is ready."
                : "Location saved. Weather is temporarily unavailable.";
              refreshState();
              broadcast();
            } catch {
              if (statusEl) statusEl.textContent = "Location saved, but weather could not be loaded. Please retry.";
            } finally {
              doneSelecting();
            }
          });
          resultsEl?.appendChild(button);
        });
      } catch (error) {
        if (error?.name !== "AbortError" && statusEl) {
          statusEl.textContent = "Place search failed. Please retry.";
        }
      } finally {
        done();
      }
    });

    root.querySelector("[data-location-coords-submit]")?.addEventListener("click", async event => {
      const lat = Number(latInput?.value);
      const lon = Number(lonInput?.value);
      const name = String(nameInput?.value || "Manual coordinates").trim();
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        if (statusEl) statusEl.textContent = "Latitude must be between -90 and 90.";
        return;
      }
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
        if (statusEl) statusEl.textContent = "Longitude must be between -180 and 180.";
        return;
      }
      const ok = adapter.setManualCoordinates(lat, lon, name || "Manual coordinates");
      if (!ok) {
        if (statusEl) statusEl.textContent = "Invalid coordinates.";
        return;
      }
      const done = setBusy(event.currentTarget, "Loading…");
      try {
        if (statusEl) statusEl.textContent = "Coordinates saved. Loading weather…";
        const result = await adapter.requestRefresh?.({ force: true });
        if (statusEl) statusEl.textContent = result?.current
          ? "Manual coordinates saved. Live weather is ready."
          : "Coordinates saved. Weather is temporarily unavailable.";
        refreshState();
        broadcast();
      } catch {
        if (statusEl) statusEl.textContent = "Coordinates saved, but weather could not be loaded. Please retry.";
      } finally {
        done();
      }
    });

    refreshState();
  }

  function mountAll() {
    document.querySelectorAll("[data-sof-location-command]").forEach(attach);
  }

  document.addEventListener("DOMContentLoaded", mountAll, { once: true });

  globalThis.SofLocationCommand = Object.freeze({ mountAll, attach });
})();
