(function () {
  'use strict';

  const VERSION = '1.0.0';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function findSelectedDate() {
    const candidates = [
      window.SOF_SELECTED_DATE,
      window.SOF_SELECTED_INSTANT,
      window.SOFObservatoryState?.selectedDate,
      window.SOFObservatoryState?.date,
      window.LivingTimeSphereState?.selectedDate
    ];

    for (const value of candidates) {
      if (!value) continue;

      const date = value instanceof Date
        ? new Date(value.getTime())
        : new Date(value);

      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    return new Date();
  }

  function buildCoordinate(date) {
    const engine = window.SOFTemporalCoordinate;

    if (!engine?.buildTemporalCoordinate) {
      return null;
    }

    return engine.buildTemporalCoordinate(date, {
      timezone:
        window.SOFObservatoryState?.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone,

      boundary:
        window.SOFObservatoryState?.boundary ||
        'sunset'
    });
  }

  function makeMetric(label, value, extraClass = '') {
    return `
      <div class="temporal-coordinate-metric ${extraClass}">
        <span class="temporal-coordinate-metric__label">
          ${escapeHtml(label)}
        </span>

        <strong class="temporal-coordinate-metric__value">
          ${escapeHtml(value)}
        </strong>
      </div>
    `;
  }

  function render(container, coordinate) {
    if (!container || !coordinate) return;

    const g = coordinate.gregorian;
    const r = coordinate.remnant13Moons;

    const remnantPrimary = r?.isYearGate
      ? 'Year Gate'
      : `Moon ${r?.moon} · Day ${r?.moonDay}`;

    const remnantSecondary = r?.isYearGate
      ? 'Outside the 13 × 28 pattern'
      : `${r?.moonName} · Day ${r?.patternDay}/364`;

    container.innerHTML = `
      <section
        class="temporal-coordinate-panel"
        data-temporal-coordinate-version="${VERSION}"
        aria-label="Temporal coordinate"
      >
        <header class="temporal-coordinate-panel__header">
          <div>
            <div class="temporal-coordinate-panel__eyebrow">
              TEMPORAL COORDINATE
            </div>

            <h2 class="temporal-coordinate-panel__title">
              ${escapeHtml(g.labels.full)}
            </h2>

            <div class="temporal-coordinate-panel__paired">
              ${escapeHtml(remnantPrimary)}
              <span aria-hidden="true"> · </span>
              ${escapeHtml(remnantSecondary)}
            </div>
          </div>

          <div class="temporal-coordinate-panel__status">
            <span class="temporal-coordinate-panel__status-dot"></span>
            SYNCHRONIZED
          </div>
        </header>

        <div class="temporal-coordinate-grid">
          ${makeMetric(
            'Gregorian',
            g.labels.compact,
            'temporal-coordinate-metric--primary'
          )}

          ${makeMetric(
            '13 Moons',
            remnantPrimary,
            'temporal-coordinate-metric--primary'
          )}

          ${makeMetric(
            'Civil Day',
            `${g.weekdayName} · Day ${g.dayOfYear}/${g.daysInYear}`
          )}

          ${makeMetric(
            'Pattern Day',
            r?.isYearGate
              ? 'Outside Day'
              : `${r.patternDay}/364`
          )}

          ${makeMetric(
            'Month',
            `${g.monthName} · ${g.day}/${g.daysInMonth}`
          )}

          ${makeMetric(
            'Moon',
            r?.isYearGate
              ? 'Year Gate'
              : `${r.moon} · ${r.moonName}`
          )}

          ${makeMetric(
            'ISO Week',
            `${g.isoWeekNumber} · ${g.isoWeek.label}`
          )}

          ${makeMetric(
            'Pattern Week',
            r?.isYearGate
              ? 'Outside Week'
              : `Week ${r.week} · Day ${r.weekdayWithinPattern}`
          )}

          ${makeMetric(
            'Quarter',
            `${g.quarterLabel} ${g.year}`
          )}

          ${makeMetric(
            'Season',
            g.seasonApprox
          )}

          ${makeMetric(
            'Year Remaining',
            `${g.daysRemainingInYear} days`
          )}

          ${makeMetric(
            'Timezone',
            coordinate.timezone
          )}
        </div>

        <div class="temporal-progress-stack">
          <div class="temporal-progress">
            <div class="temporal-progress__label">
              <span>Gregorian year</span>
              <strong>
                ${Math.round(g.progress.year * 100)}%
              </strong>
            </div>

            <div class="temporal-progress__track">
              <div
                class="temporal-progress__fill"
                style="--temporal-progress:${Math.max(
                  0,
                  Math.min(100, g.progress.year * 100)
                )}%"
              ></div>
            </div>
          </div>

          <div class="temporal-progress">
            <div class="temporal-progress__label">
              <span>13 Moons pattern</span>
              <strong>
                ${Math.round((r?.progress?.pattern || 0) * 100)}%
              </strong>
            </div>

            <div class="temporal-progress__track">
              <div
                class="temporal-progress__fill"
                style="--temporal-progress:${Math.max(
                  0,
                  Math.min(
                    100,
                    (r?.progress?.pattern || 0) * 100
                  )
                )}%"
              ></div>
            </div>
          </div>
        </div>

        <details class="temporal-coordinate-details">
          <summary>
            Full coordinate
          </summary>

          <div class="temporal-coordinate-details__body">
            <div>
              <strong>Gregorian:</strong>
              ${escapeHtml(g.labels.full)}
            </div>

            <div>
              <strong>13 Moons:</strong>
              ${escapeHtml(r?.labels?.full || 'Unavailable')}
            </div>

            <div>
              <strong>ISO:</strong>
              ${escapeHtml(g.isoDate)}
            </div>

            <div>
              <strong>ISO week:</strong>
              ${escapeHtml(g.isoWeek.label)}
            </div>

            <div>
              <strong>Instant:</strong>
              ${escapeHtml(coordinate.instantISO)}
            </div>

            <div>
              <strong>Boundary:</strong>
              ${escapeHtml(coordinate.boundary)}
            </div>
          </div>
        </details>
      </section>
    `;
  }

  function ensureContainer() {
    let target = document.getElementById(
      'temporal-coordinate-root'
    );

    if (target) return target;

    const root = document.createElement('div');
    root.id = 'temporal-coordinate-root';
    root.className = 'temporal-coordinate-root';

    const possibleAnchors = [
      document.querySelector('.observatory-workspace'),
      document.querySelector('[data-observatory-workspace]'),
      document.querySelector('.living-time-workbench'),
      document.querySelector('main')
    ];

    const anchor = possibleAnchors.find(Boolean);

    if (!anchor) return null;

    if (anchor.firstChild) {
      anchor.insertBefore(root, anchor.firstChild);
    } else {
      anchor.appendChild(root);
    }

    return root;
  }

  function refresh(inputDate) {
    const container = ensureContainer();

    if (!container) return null;

    const date =
      inputDate instanceof Date
        ? inputDate
        : inputDate
          ? new Date(inputDate)
          : findSelectedDate();

    const coordinate = buildCoordinate(date);

    if (!coordinate) {
      container.innerHTML = `
        <div class="temporal-coordinate-panel temporal-coordinate-panel--waiting">
          Temporal engine loading…
        </div>
      `;

      return null;
    }

    render(container, coordinate);

    window.SOFCurrentTemporalCoordinate = coordinate;

    window.dispatchEvent(
      new CustomEvent('sof:temporal-coordinate-rendered', {
        detail: {
          version: VERSION,
          coordinate
        }
      })
    );

    return coordinate;
  }

  function extractDateFromEvent(event) {
    const detail = event?.detail || {};

    const values = [
      detail.date,
      detail.selectedDate,
      detail.instant,
      detail.timestamp,
      detail.isoDate
    ];

    for (const value of values) {
      if (!value) continue;

      const date = value instanceof Date
        ? value
        : new Date(value);

      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    return null;
  }

  [
    'sof:temporal-engine-ready',
    'sof:temporal-cursor-ready',
    'sof:temporal-cursor-change',
    'sof:remnant-calendar-bridge-ready',
    'sof:sphere-date-change',
    'sof:observatory-date-change',
    'sof:calendar-date-change',
    'sof:selected-date-change',
    'popstate'
  ].forEach(eventName => {
    window.addEventListener(eventName, event => {
      refresh(extractDateFromEvent(event));
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => refresh(),
      { once: true }
    );
  } else {
    refresh();
  }

  window.SOFTemporalCoordinateUI = {
    version: VERSION,
    refresh
  };
})();
