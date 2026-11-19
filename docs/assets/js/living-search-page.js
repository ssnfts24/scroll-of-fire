"use strict";

/* =======================================================================
   Living Search — the search page's own extras.
   The counts on the door, and Surprise me. Both read the same sealed
   manifest the search itself is built from, so what this page says
   about the index can never drift from the index. Local files only:
   nothing here leaves the visitor's device.
   ======================================================================= */

(function (global) {
  function formatCounts(counts) {
    var fmt = function (n) { return Number(n).toLocaleString("en-US"); };
    return fmt(counts.total) + " things to find — " +
      fmt(counts.pages) + " pages · " +
      fmt(counts.scrolls) + " scroll passages · " +
      fmt(counts.lexicon) + " Hebrew words · " +
      fmt(counts.atlas) + " atlas entries · " +
      fmt(counts.claims) + " claims, each one graded.";
  }

  /* Pick an area with probability proportional to how much it holds. */
  function pickArea(areas, counts, rng) {
    var total = 0;
    for (var i = 0; i < areas.length; i++) total += counts[areas[i].id] || 0;
    var roll = rng() * total;
    var acc = 0;
    for (var j = 0; j < areas.length; j++) {
      acc += counts[areas[j].id] || 0;
      if (roll < acc) return areas[j];
    }
    return areas[areas.length - 1];
  }

  function pickDoc(docs, rng) {
    return docs[Math.floor(rng() * docs.length)];
  }

  function shardFile(manifest, area) {
    if (area.shard) return area.shard;
    var entry = manifest.shards && manifest.shards[area.id];
    return entry && entry.file;
  }

  function init() {
    var countsEl = document.getElementById("ls-counts");
    var btn = document.getElementById("ls-surprise-btn");
    var note = document.getElementById("ls-surprise-note");
    if (!countsEl && !btn) return;

    var manifestPromise = null;
    function loadManifest() {
      if (!manifestPromise) {
        manifestPromise = fetch("assets/search/manifest.json").then(function (r) {
          if (!r.ok) throw new Error("manifest unavailable");
          return r.json();
        });
      }
      return manifestPromise;
    }

    if (countsEl) {
      loadManifest().then(function (manifest) {
        countsEl.textContent = formatCounts(manifest.counts);
        countsEl.hidden = false;
      }).catch(function () { /* the door simply stays unnumbered */ });
    }

    if (btn) {
      btn.addEventListener("click", function () {
        btn.disabled = true;
        loadManifest().then(function (manifest) {
          var area = pickArea(manifest.areas, manifest.counts, Math.random);
          return fetch("assets/search/" + shardFile(manifest, area)).then(function (r) {
            if (!r.ok) throw new Error("shard unavailable");
            return r.json();
          }).then(function (shard) {
            return pickDoc(shard.docs, Math.random);
          });
        }).then(function (doc) {
          if (doc && doc.u) {
            window.location.href = doc.u;
          } else {
            btn.disabled = false;
          }
        }).catch(function () {
          btn.disabled = false;
          if (note) {
            note.textContent = "The index did not answer just now — the search box above will take you anywhere in it.";
          }
        });
      });
    }
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }

  var api = { formatCounts: formatCounts, pickArea: pickArea, pickDoc: pickDoc, shardFile: shardFile };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.LivingSearchPage = api;
})(typeof window !== "undefined" ? window : globalThis);
