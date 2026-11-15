export function formatLocalTime(iso, locale, timeZone) {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}
