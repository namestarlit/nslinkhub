export function Avatar({ userId, large = false }: { userId: string; large?: boolean }) {
  return (
    // biome-ignore lint/performance/noImgElement: Same-origin avatar resolver owns image selection and fallback.
    <img
      className={`avatar${large ? " avatar-large" : ""}`}
      src={`/api/v1/users/${encodeURIComponent(userId)}/avatar`}
      width={large ? 64 : 36}
      height={large ? 64 : 36}
      alt=""
      aria-hidden="true"
    />
  );
}
