(() => {
  "use strict";

  function copyText(text) {
    return (globalThis.navigator?.clipboard?.writeText(text)
      ? globalThis.navigator.clipboard.writeText(text)
      : Promise.reject(new Error("Clipboard unavailable")));
  }

  function composeParts(parts = []) {
    return parts.filter(Boolean).join("\n");
  }

  function nativeShare(payload) {
    if (!globalThis.navigator?.share) {
      return Promise.reject(new Error("Native share unavailable"));
    }
    return globalThis.navigator.share(payload);
  }

  globalThis.RemnantShare = Object.freeze({
    copySignal(text, link) {
      return copyText(composeParts([text, link]));
    },
    copyStandard(text, link, tags = []) {
      return copyText(composeParts([text, link, tags.join(" ")]));
    },
    copyFullScroll(text, link, tags = []) {
      return copyText(composeParts([text, "", link, "", tags.join(" ")]));
    },
    copyPermanentLink(link) {
      return copyText(String(link || ""));
    },
    nativeShare,
    composeParts
  });
})();
