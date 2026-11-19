/* =====================================================================
 * Social Bridge — share this day out, follow the work, data stays home.
 *
 * Aaron's direction (Nov 19, 2026): build the site so social media can
 * connect as well — under his standing rules. The shape those rules give:
 *
 *   - SHARE OUT, keeper-fired only. The door turns the current moment
 *     into a share card and offers it through the keeper's own share
 *     sheet (navigator.share — the phone's real sheet: Facebook,
 *     Instagram, X, messages, whatever the keeper already has). Where
 *     there is no share sheet, plain compose links open the platform's
 *     own composer with the words prefilled. The keeper always sees
 *     the words and sends them. Nothing posts by itself.
 *   - NO third-party SDKs, no trackers, no embedded widgets, nothing
 *     uploaded by the site. This module makes no network calls of its
 *     own; the compose doors are plain anchors the keeper may tap.
 *   - FOLLOW doors point only at Aaron's own public profiles, using
 *     the exact links his About page already carries. Read-only doors
 *     out; nothing is pulled in or scraped.
 *
 * The day itself comes from the canonical pipeline only: the page's
 * PatternCalendar (single temporal authority) plus DayTelling, the
 * site's own telling module. Where a page carries no calendar, the
 * card falls back to the civil date and the page's own name — a
 * coordinate or a telling is never invented.
 *
 * The prefilled words follow the adopted posting style (Aaron approved
 * the frame Nov 18, 2026): the Living Time coordinate first, the
 * moon's name second, the civil date third, an Anchor line and a
 * Practice line from the day's own telling, the closing ritual
 * "Observe. Breathe. Align. Return.", the site address, and three
 * hashtags. Plain punctuation, no em-dashes.
 * ===================================================================== */
(() => {
  "use strict";

  const VERSION = "social-bridge/1.0.0";

  /* Aaron's own public profiles, exactly as linked from the Follow
   * section of docs/about-aaron.html (checked Nov 19, 2026). */
  const FOLLOW = Object.freeze([
    { label: "Instagram", href: "https://www.instagram.com/theremnentrising" },
    { label: "Facebook", href: "https://www.facebook.com/share/1GAyMTSX2g/" },
    { label: "X", href: "https://x.com/SS_NFTs" },
    { label: "YouTube", href: "https://www.youtube.com/@aaronlaird1036" },
    { label: "All links", href: "https://linktr.ee/AaronPaulLairdScrollOfFire" }
  ]);

  /* Moon tint for the card, keyed by the moon's element as the
   * calendar data states it. Presentation only. */
  const ELEMENT_TINTS = Object.freeze({
    Fire: "#e08a4c",
    Water: "#57b7d6",
    Air: "#a8cf8f",
    Earth: "#b49b6d",
    Aether: "#b9a7e6"
  });

  function todayISOInZone(timeZone) {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    } catch (error) {
      return null;
    }
  }

  function civilLineFor(dateISO, timeZone) {
    try {
      const parts = String(dateISO || "").split("-").map(Number);
      if (parts.length !== 3 || parts.some(Number.isNaN)) return "";
      const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12));
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: timeZone || "UTC"
      }).format(date);
    } catch (error) {
      return "";
    }
  }

  /* Aaron's posts carry no em-dashes (his rule, Nov 18, 2026). The
   * telling's own sentences sometimes use one; the share words do not. */
  function plain(value) {
    return String(value || "").replace(/\s*—\s*/g, ", ");
  }

  function pageName() {
    const heading = document.querySelector("h1");
    let name = heading ? (heading.innerText || heading.textContent || "") : "";
    name = (name || "").replace(/\s+/g, " ").trim();
    if (!name) name = (document.title || "").split(/[·|—–-]/)[0].trim();
    return name;
  }

  /* Build the share moment for a civil date (defaults to today in the
   * visitor's zone). Pure with respect to the canonical engines: same
   * date, same words. Returns null coordinate/telling when the page
   * carries no calendar — never a guessed one. */
  function buildMoment(dateISO, options = {}) {
    const timeZone =
      options.timeZone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "UTC";
    const iso = dateISO || todayISOInZone(timeZone);
    const civil = civilLineFor(iso, timeZone);
    const url = options.url || (typeof location !== "undefined" ? location.href : "");
    const name = options.pageName || pageName();

    let coordinate = null;
    let moonName = null;
    let moonElement = null;
    let anchor = null;
    let practice = null;

    try {
      const telling =
        globalThis.DayTelling &&
        typeof globalThis.DayTelling.tellForDate === "function"
          ? globalThis.DayTelling.tellForDate(iso, {
              timeZone,
              boundaryMode: "midnight"
            })
          : null;
      const data = globalThis.PatternCalendarData;
      if (telling && telling.coordinate && telling.coordinate.moon) {
        const c = telling.coordinate;
        coordinate =
          "Moon " + c.moon + " · Day " + c.day + " · Pattern Day " + c.patternDay;
        moonName = c.moonName;
        const moons = data && Array.isArray(data.moons) ? data.moons : [];
        const record = moons[c.moon - 1] || {};
        moonElement = record.element || null;
        if (record.practice) practice = record.practice;
        const reading = Array.isArray(telling.reading) ? telling.reading : [];
        const archetypeLine = reading.find((line) =>
          String(line).startsWith("The Codex names each day")
        );
        anchor = archetypeLine || reading[0] || telling.headline || null;
      } else if (telling) {
        // Day Out of Time / Deep Time Day: outside the count, named.
        moonName = telling.coordinate ? telling.coordinate.moonName : null;
        anchor =
          (Array.isArray(telling.position) && telling.position[1]) ||
          telling.headline ||
          null;
      }
    } catch (error) {
      coordinate = null;
    }

    const lines = [];
    if (coordinate) lines.push(coordinate);
    if (moonName && coordinate) lines.push("Moon of " + moonName);
    else if (moonName) lines.push(moonName);
    if (civil) lines.push(civil);
    lines.push("");
    if (name) lines.push(plain(name));
    if (anchor) lines.push("Anchor: " + plain(anchor));
    if (practice) lines.push("Practice: " + plain(practice));
    lines.push("");
    lines.push("Observe. Breathe. Align. Return.");
    lines.push("codexofreality.org");
    lines.push("#13Moons #LivingTime #CodexOfReality");

    return {
      version: VERSION,
      dateISO: iso,
      civil,
      coordinate,
      moonName,
      moonElement,
      pageName: name,
      anchor,
      practice,
      url,
      text: lines.join("\n")
    };
  }

  function composeLinks(moment) {
    const text = encodeURIComponent(moment.text + "\n" + moment.url);
    const urlOnly = encodeURIComponent(moment.url);
    const subject = encodeURIComponent(
      (moment.coordinate || moment.civil || "A day in Living Time") +
        " · Codex of Reality"
    );
    const body = encodeURIComponent(moment.text + "\n\n" + moment.url);
    return Object.freeze({
      facebook: "https://www.facebook.com/sharer/sharer.php?u=" + urlOnly,
      x: "https://twitter.com/intent/tweet?text=" + text,
      email: "mailto:?subject=" + subject + "&body=" + body
    });
  }

  /* The card: drawn on-device on a canvas, in the Codex colors with
   * the day's moon tint. Nothing is uploaded to draw it. */
  function drawCard(moment) {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    const tint = ELEMENT_TINTS[moment.moonElement] || "#7af3ff";

    const grad = ctx.createLinearGradient(0, 0, 0, 630);
    grad.addColorStop(0, "#101725");
    grad.addColorStop(0.7, "#0b0f1a");
    grad.addColorStop(1, "#05070d");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 630);

    // The gold seam.
    ctx.strokeStyle = "#f3c97a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(72, 556);
    ctx.lineTo(430, 556);
    ctx.lineTo(452, 528);
    ctx.lineTo(700, 528);
    ctx.stroke();

    // The spiral eye, in the moon's tint.
    ctx.strokeStyle = tint;
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let t = 0; t < Math.PI * 6.2; t += 0.08) {
      const r = 4 + t * 4.4;
      const x = 1050 + Math.cos(t) * r;
      const y = 130 + Math.sin(t) * r;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#f3c97a";
    ctx.beginPath();
    ctx.arc(1050, 130, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f3c97a";
    ctx.font = "600 30px Georgia, serif";
    ctx.fillText("CODEX OF REALITY", 72, 104);

    ctx.fillStyle = "#f4f1e8";
    ctx.font = "700 64px Georgia, serif";
    ctx.fillText(moment.coordinate || moment.civil || "Living Time", 72, 196);

    ctx.fillStyle = tint;
    ctx.font = "italic 40px Georgia, serif";
    if (moment.moonName) {
      ctx.fillText(
        moment.coordinate ? "Moon of " + moment.moonName : moment.moonName,
        72,
        258
      );
    }

    ctx.fillStyle = "#a7b4c7";
    ctx.font = "32px Georgia, serif";
    if (moment.coordinate && moment.civil) ctx.fillText(moment.civil, 72, 312);

    ctx.fillStyle = "#d6deea";
    ctx.font = "30px Georgia, serif";
    wrapText(
      ctx,
      moment.pageName || "A day in Living Time",
      72,
      392,
      1050,
      40
    );
    if (moment.practice) {
      ctx.fillStyle = "#9ecff2";
      ctx.font = "italic 28px Georgia, serif";
      wrapText(ctx, "Practice: " + moment.practice, 72, 452, 1050, 38);
    }

    ctx.fillStyle = "#f3c97a";
    ctx.font = "600 30px Georgia, serif";
    ctx.fillText("Observe. Breathe. Align. Return.", 72, 600 - 78);
    ctx.fillStyle = "#a7b4c7";
    ctx.font = "26px Georgia, serif";
    ctx.fillText("codexofreality.org", 760, 600 - 78 + 8);
    return canvas;
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(/\s+/);
    let line = "";
    let yy = y;
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineHeight;
        if (yy > y + lineHeight * 2) return;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  function canvasFile(canvas, moment) {
    return new Promise((resolve) => {
      if (!canvas.toBlob) return resolve(null);
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null);
        try {
          resolve(
            new File([blob], "codex-share-" + (moment.dateISO || "day") + ".png", {
              type: "image/png"
            })
          );
        } catch (error) {
          resolve(null);
        }
      }, "image/png");
    });
  }

  /* Share through the keeper's own sheet first; the card rides along
   * where the platform supports files. Returns how it went so the UI
   * can fall back to the compose doors honestly. */
  async function shareOut(moment) {
    const nav = globalThis.navigator;
    if (nav && typeof nav.share === "function") {
      const canvas = drawCard(moment);
      const file = await canvasFile(canvas, moment);
      if (file && typeof nav.canShare === "function") {
        try {
          if (nav.canShare({ files: [file] })) {
            await nav.share({
              files: [file],
              title: "Codex of Reality",
              text: moment.text,
              url: moment.url
            });
            return "sheet-with-card";
          }
        } catch (error) {
          if (error && error.name === "AbortError") return "cancelled";
        }
      }
      await nav.share({ title: "Codex of Reality", text: moment.text, url: moment.url });
      return "sheet";
    }
    return "no-sheet";
  }

  globalThis.CodexSocialBridge = Object.freeze({
    version: VERSION,
    follow: FOLLOW,
    buildMoment,
    composeLinks,
    drawCard,
    shareOut
  });

  /* -------------------------------------------------------------- */
  /* The door itself: injected into the shared living chrome.        */
  /* -------------------------------------------------------------- */

  if (typeof document === "undefined" || !document.body) return;
  if (!document.body.classList.contains("living-ui")) return;
  if (document.querySelector("[data-social-bridge]")) return;

  const bar = document.createElement("div");
  bar.className = "social-bridge";
  bar.setAttribute("data-social-bridge", "");

  const shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.className = "social-bridge-share";
  shareBtn.textContent = "Share this day";
  shareBtn.setAttribute("aria-haspopup", "dialog");
  bar.appendChild(shareBtn);

  const followWrap = document.createElement("nav");
  followWrap.className = "social-bridge-follow";
  followWrap.setAttribute("aria-label", "Follow the work");
  const followLabel = document.createElement("span");
  followLabel.className = "social-bridge-follow-label";
  followLabel.textContent = "Follow the work:";
  followWrap.appendChild(followLabel);
  for (const door of FOLLOW) {
    const a = document.createElement("a");
    a.href = door.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = door.label;
    followWrap.appendChild(a);
  }
  bar.appendChild(followWrap);

  const panel = document.createElement("div");
  panel.className = "social-bridge-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Share this day");

  const preview = document.createElement("pre");
  preview.className = "social-bridge-text";
  panel.appendChild(preview);

  const doors = document.createElement("div");
  doors.className = "social-bridge-doors";
  const sheetBtn = document.createElement("button");
  sheetBtn.type = "button";
  sheetBtn.textContent = "Open the share sheet";
  doors.appendChild(sheetBtn);
  const links = composeLinks(buildMoment());
  const doorDefs = [
    ["Post on Facebook", links.facebook],
    ["Post on X", links.x],
    ["Send by email", links.email]
  ];
  for (const [label, href] of doorDefs) {
    const a = document.createElement("a");
    a.textContent = label;
    a.href = href;
    if (!href.startsWith("mailto:")) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    doors.appendChild(a);
  }
  const cardBtn = document.createElement("button");
  cardBtn.type = "button";
  cardBtn.textContent = "Save the card image";
  doors.appendChild(cardBtn);
  panel.appendChild(doors);

  const note = document.createElement("p");
  note.className = "social-bridge-note";
  note.textContent =
    "You send it yourself, from your own accounts. Nothing posts on its own, and nothing about your visit leaves this page.";
  panel.appendChild(note);

  const status = document.createElement("p");
  status.className = "social-bridge-status";
  status.setAttribute("aria-live", "polite");
  panel.appendChild(status);
  bar.appendChild(panel);

  const navHost = document.querySelector(".living-nav");
  if (navHost && navHost.parentNode) {
    navHost.parentNode.insertBefore(bar, navHost.nextSibling);
  } else if (document.querySelector("main")) {
    document.querySelector("main").prepend(bar);
  } else {
    document.body.prepend(bar);
  }

  let moment = null;
  shareBtn.addEventListener("click", () => {
    const opening = panel.hidden;
    if (opening) {
      moment = buildMoment();
      preview.textContent = moment.text + "\n" + moment.url;
      status.textContent = "";
    }
    panel.hidden = !opening;
    shareBtn.setAttribute("aria-expanded", String(opening));
  });

  sheetBtn.addEventListener("click", async () => {
    moment = moment || buildMoment();
    try {
      const how = await shareOut(moment);
      status.textContent =
        how === "no-sheet"
          ? "This device has no share sheet. Use one of the doors below; each opens with the words ready."
          : how === "cancelled"
            ? "Share sheet closed. Nothing was sent."
            : "Shared through your own sheet. What you sent was yours to send.";
    } catch (error) {
      status.textContent =
        "The share sheet did not open. Use one of the doors below; each opens with the words ready.";
    }
  });

  cardBtn.addEventListener("click", async () => {
    moment = moment || buildMoment();
    const canvas = drawCard(moment);
    const file = await canvasFile(canvas, moment);
    if (!file) {
      status.textContent = "This browser could not draw the card. The words above still copy into any post.";
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = "Card saved. It is yours to post where you choose.";
  });
})();
