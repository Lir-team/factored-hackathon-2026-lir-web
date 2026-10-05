/* Locale-aware formatting helpers. Pure: Intl only, no DOM. */

export function formatMoney(amount, currency, locale) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

export function formatDay(iso, locale, timeZone) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone }).format(
    new Date(iso),
  );
}

export function formatTime(iso, locale, timeZone) {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(
    new Date(iso),
  );
}

export function formatDateTime(iso, locale, timeZone) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    new Date(iso),
  );
}

export function countryName(code, locale) {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** [{currency, amount}] in first-seen order; amounts rounded to cents. */
export function sumByCurrency(transactions) {
  const totals = new Map();
  for (const t of transactions) {
    totals.set(t.currency, (totals.get(t.currency) ?? 0) + t.amount);
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }));
}
