/**
 * Word-study pages — tappable citations (Page Evolution Batch
 * E2, Aaron's order, Nov 25, 2026: "Start all").
 *
 * The seven word studies were the site's last pure reading
 * walls: superb content, no doing. Their verse citations stood
 * as prose — "Gen 2:7" told the reader where a word lives but
 * could not take them there. This runtime walks the study's own
 * text and wraps every Genesis/Exodus citation in a link to the
 * chapter reader at that verse.
 *
 * A tap goes one step further than the anchor: the chapter
 * reader opens its word panel when the address carries a word
 * (#Gen.2.7/<word-id>), so before navigating, this script asks
 * the chapter's own data for the verse's first word and rides
 * in with it — the citation opens the word panel, as the plan
 * names. Any failure along that road (no data, no verse) falls
 * back to the plain verse anchor, which still lands the reader
 * on the verse, highlighted. Citations outside Genesis and
 * Exodus (Psalms, Jeremiah, …) have no chapter pages here and
 * are left as the prose they are — a link that cannot land
 * honestly is not made.
 *
 * Nothing is rewritten in the studies' files: the wrapping
 * happens at runtime over the text as written, and with
 * JavaScript off the studies read exactly as they did.
 */
(function () {
  "use strict";

  var BOOKS = {
    Gen: { slug: "genesis", code: "Gen", chapters: 50 },
    Genesis: { slug: "genesis", code: "Gen", chapters: 50 },
    Ex: { slug: "exodus", code: "Exod", chapters: 40 },
    Exod: { slug: "exodus", code: "Exod", chapters: 40 },
    Exodus: { slug: "exodus", code: "Exod", chapters: 40 }
  };
  var CITATION = /\b(Genesis|Gen|Exodus|Exod|Ex)\s+(\d{1,2}):(\d{1,3})(?![\d:])/g;

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function wrapCitations(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !/\d/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        var parent = node.parentElement;
        if (!parent || /^(A|SCRIPT|STYLE|BUTTON)$/.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest && parent.closest("nav, .pn, .recall-strip")) return NodeFilter.FILTER_REJECT;
        CITATION.lastIndex = 0;
        return CITATION.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var text = node.nodeValue;
      var fragment = document.createDocumentFragment();
      var last = 0;
      CITATION.lastIndex = 0;
      var match;
      while ((match = CITATION.exec(text))) {
        var book = BOOKS[match[1]];
        var chapter = parseInt(match[2], 10);
        var verse = parseInt(match[3], 10);
        if (!book || chapter < 1 || chapter > book.chapters) continue;
        fragment.appendChild(document.createTextNode(text.slice(last, match.index)));
        var link = document.createElement("a");
        link.className = "ws-cite";
        link.textContent = match[0];
        link.href = "../" + book.slug + "/" + pad(chapter) + ".html#" + book.code + "." + chapter + "." + verse;
        link.dataset.book = book.code;
        link.dataset.slug = book.slug;
        link.dataset.chapter = String(chapter);
        link.dataset.verse = String(verse);
        link.setAttribute("aria-label", "See " + match[0] + " in the chapter reader, word panel open");
        fragment.appendChild(link);
        last = match.index + match[0].length;
      }
      fragment.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(fragment, node);
    });
  }

  /* Ride in with the verse's first word, so the panel opens. */
  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("a.ws-cite") : null;
    if (!link) return;
    event.preventDefault();
    var fallback = link.href;
    var url = "../data/chapters/" + link.dataset.book + "-" + pad(parseInt(link.dataset.chapter, 10)) + ".json";
    fetch(url)
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        var verseId = link.dataset.book + "." + link.dataset.chapter + "." + link.dataset.verse;
        var verse = data && data.verses ? data.verses.filter(function (v) { return v.id === verseId; })[0] : null;
        var wid = verse && verse.w && verse.w[0] ? verse.w[0].id : null;
        window.location.href = wid ? fallback + "/" + wid : fallback;
      })
      .catch(function () { window.location.href = fallback; });
  });

  function init() {
    var main = document.getElementById("main");
    if (main) wrapCitations(main);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
