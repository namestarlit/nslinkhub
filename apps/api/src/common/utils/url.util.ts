export function canonicalizeUrl(url: string) {
  const parsed = new URL(url);

  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();

  if (
    (parsed.protocol === "http:" && parsed.port === "80") ||
    (parsed.protocol === "https:" && parsed.port === "443")
  ) {
    parsed.port = "";
  }

  if (parsed.pathname === "") {
    parsed.pathname = "/";
  }

  const params = [...parsed.searchParams.entries()]
    .filter(([key]) => !/^utm_/i.test(key) && !["fbclid", "gclid"].includes(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));

  parsed.search = "";
  for (const [key, value] of params) {
    parsed.searchParams.append(key, value);
  }

  return parsed.toString();
}
