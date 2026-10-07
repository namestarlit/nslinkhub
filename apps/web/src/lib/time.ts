// Each unit applies while the value is below its limit, then converts upward.
const units: [Intl.RelativeTimeFormatUnit, number, number][] = [
  ["minute", 60, 60],
  ["hour", 24, 24],
  ["day", 7, 7],
  ["week", 5, 1],
];
// GitHub-style recency ("3 hours ago"); after a month the date itself is
// clearer, shown in `timeZone` (UTC on the server, local in the browser).
export function relativeTime(at: string, timeZone?: string) {
  const date = new Date(at);
  let value = (Date.now() - date.getTime()) / 60000;
  if (value < 1) return "just now";
  for (const [unit, limit, next] of units) {
    if (value < limit)
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        -Math.floor(value),
        unit,
      );
    value /= next;
  }
  return `on ${date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  })}`;
}
