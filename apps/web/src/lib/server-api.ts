import "server-only";
import { webServerConfig } from "@nslinkhub/config/web-server";
import { headers } from "next/headers";
import { type ApiPath, readJson, safePath, sessionCookie } from "./http";

export async function serverRead<T>(path: ApiPath, shareToken?: string) {
  const incoming = await headers();
  const outgoing = new Headers({ Accept: "application/json" });
  const source = incoming.get("x-web-read-source");
  if (!source) throw new Error("Web server source attribution is missing");
  outgoing.set("x-web-read-source", source);
  const cookie = sessionCookie(incoming.get("cookie") ?? "");
  if (cookie) outgoing.set("cookie", cookie);
  if (shareToken) outgoing.set("x-share-token", shareToken);
  return readJson<T>(`${webServerConfig().apiOrigin}${safePath(path)}`, {
    headers: outgoing,
    timeout: 8000,
  });
}
