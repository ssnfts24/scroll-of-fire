(() => {
  "use strict";

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function percent(value) {
    return `${(Math.max(0, Math.min(1, Number(value) || 0)) * 100).toFixed(1)}%`;
  }

  function precisionLabel(seconds) {
    return Number(seconds) === 1 ? "±1 second" : `±${Number(seconds)} seconds`;
  }

  function durationParts(milliseconds) {
    const total = Math.max(0, Math.round(Number(milliseconds) || 0));
    const days = Math.floor(total / 86400000);
    const hours = Math.floor((total % 86400000) / 3600000);
    const minutes = Math.floor((total % 3600000) / 60000);
    const seconds = Math.floor((total % 60000) / 1000);
    return { days, hours, minutes, seconds };
  }

  function durationText(milliseconds) {
    const parts = durationParts(milliseconds);
    const values = [];
    if (parts.days) values.push(`${parts.days} day${parts.days === 1 ? "" : "s"}`);
    if (parts.hours || values.length) values.push(`${parts.hours} hour${parts.hours === 1 ? "" : "s"}`);
    if (parts.minutes || values.length) values.push(`${parts.minutes} minute${parts.minutes === 1 ? "" : "s"}`);
    if (!values.length) values.push(`${parts.seconds} second${parts.seconds === 1 ? "" : "s"}`);
    return values.join(", ");
  }

  function compactDuration(milliseconds) {
    const parts = durationParts(milliseconds);
    return `${parts.days}d ${pad(parts.hours)}h ${pad(parts.minutes)}m`;
  }

  globalThis.EquinoxPassageFormat = Object.freeze({
    percent,
    precisionLabel,
    durationParts,
    durationText,
    compactDuration
  });
})();
