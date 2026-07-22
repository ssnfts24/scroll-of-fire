(() => {
  "use strict";

  const FORMATS = Object.freeze({
    square: Object.freeze({ width: 1080, height: 1080 }),
    portrait: Object.freeze({ width: 1080, height: 1350 }),
    story: Object.freeze({ width: 1080, height: 1920 })
  });

  function resolveFormat(name) {
    return FORMATS[name] || FORMATS.square;
  }

  globalThis.RemnantShareImage = Object.freeze({ FORMATS, resolveFormat });
})();
