(function () {
  'use strict';

  const STORAGE_KEY = 'sof-unit-preferences';

  const defaults = {
    temperature: 'fahrenheit',
    windSpeed: 'mph',
    distance: 'miles'
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

      return {
        ...defaults,
        ...saved
      };
    } catch (_) {
      return { ...defaults };
    }
  }

  function save(preferences) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...defaults,
        ...preferences
      })
    );
  }

  function celsiusToFahrenheit(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return null;
    }

    return (number * 9 / 5) + 32;
  }

  function fahrenheitToCelsius(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return null;
    }

    return (number - 32) * 5 / 9;
  }

  function formatTemperature(valueCelsius, options = {}) {
    const preferences = load();

    const unit = options.unit || preferences.temperature;

    if (!Number.isFinite(Number(valueCelsius))) {
      return '—';
    }

    if (unit === 'celsius') {
      return `${Math.round(Number(valueCelsius))}°C`;
    }

    const fahrenheit = celsiusToFahrenheit(valueCelsius);

    return `${Math.round(fahrenheit)}°F`;
  }

  window.SOFUnitPreferences = {
    defaults,
    load,
    save,
    formatTemperature,
    celsiusToFahrenheit,
    fahrenheitToCelsius
  };
})();
