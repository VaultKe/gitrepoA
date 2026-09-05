// Hermes' bundled ICU data on an installed Android release build does not
// reliably cover every locale tag this app uses -- 'en-KE' in particular --
// even though the exact same call works fine in a dev client (which shows a
// recoverable redbox on any JS error) and on web (V8 ships full ICU data).
// When the locale isn't recognized, `new Intl.NumberFormat('en-KE', ...)`
// throws a RangeError, and since nothing wrapped the post-login dashboard in
// an error boundary, that throw took down the whole release APK the instant
// the dashboard tried to format a currency value -- right after login.
//
// Patching the constructor here fixes every one of the 30+ scattered
// `new Intl.NumberFormat('en-KE', ...)` call sites at once, and keeps working
// for any new ones added later.
const OriginalNumberFormat = Intl.NumberFormat;

function formatWithoutIntl(value, options) {
  const num = Number(value) || 0;
  const fractionDigits = options?.minimumFractionDigits ?? 2;
  const fixed = num.toFixed(fractionDigits);

  const [whole, fraction] = fixed.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const withFraction = fraction ? `${withCommas}.${fraction}` : withCommas;

  const prefix = options?.style === 'currency' ? `${options.currency || ''} ` : '';
  return `${prefix}${withFraction}`.trim();
}

function safeNumberFormat(locales, options) {
  try {
    return new OriginalNumberFormat(locales, options);
  } catch (error) {
    console.warn('[IntlSafety] Intl.NumberFormat failed for locale', locales, '-- falling back to en-US:', error?.message);
    try {
      return new OriginalNumberFormat('en-US', options);
    } catch (fallbackError) {
      console.warn('[IntlSafety] en-US fallback also failed, using a manual formatter:', fallbackError?.message);
      return { format: (value) => formatWithoutIntl(value, options) };
    }
  }
}

// Deliberately not a class/arrow function: calling `new safeNumberFormat(...)`
// still works correctly, because a constructor that explicitly returns an
// object short-circuits `new`'s implicit `this` -- so every existing
// `new Intl.NumberFormat(...)` call site keeps working unmodified.
Intl.NumberFormat = safeNumberFormat;
