(() => {
  "use strict";

  async function copyText(text) {
    const value = String(text || "");
    if (globalThis.navigator?.clipboard?.writeText) {
      try {
        await globalThis.navigator.clipboard.writeText(value);
        return true;
      } catch {}
    }

    const doc = globalThis.document;
    if (!doc?.body) {
      throw new Error("Clipboard unavailable");
    }

    const temp = doc.createElement("textarea");
    temp.value = value;
    temp.setAttribute("readonly", "");
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    temp.style.pointerEvents = "none";
    doc.body.appendChild(temp);
    temp.select();
    const copied = doc.execCommand?.("copy");
    doc.body.removeChild(temp);
    if (!copied) {
      throw new Error("Clipboard denied");
    }
    return true;
  }

  function composeParts(parts = []) {
    return parts.filter(Boolean).join("\n");
  }

  async function nativeShare(payload) {
    if (!globalThis.navigator?.share) {
      throw new Error("Native share unavailable");
    }
    await globalThis.navigator.share(payload);
    return true;
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
