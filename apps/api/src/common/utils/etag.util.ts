export function toVersionEtag(version: number | string) {
  return `W/"v${String(version)}"`;
}

export function ifNoneMatchHit(headerValue: string | undefined, etag: string) {
  if (!headerValue) {
    return false;
  }

  if (headerValue.trim() === '*') {
    return true;
  }

  return headerValue
    .split(',')
    .map((value) => value.trim())
    .includes(etag);
}

export function parseIfMatchVersion(headerValue: string | undefined) {
  if (!headerValue) {
    return null;
  }

  const trimmed = headerValue.trim();
  const versionTagMatch = trimmed.match(/v(\d+)/);
  if (versionTagMatch) {
    return Number(versionTagMatch[1]);
  }

  const numericMatch = trimmed.match(/(\d+)/);
  if (numericMatch) {
    return Number(numericMatch[1]);
  }

  return null;
}
