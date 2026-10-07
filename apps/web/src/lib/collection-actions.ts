"use server";
import { webServerConfig } from "@nslinkhub/config/web-server";
import type { Collection } from "@nslinkhub/types";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { CollectionEditState } from "../components/collection-editor";
import { formPost } from "./form-server";
import { serverRead } from "./server-api";
import { isUuid, splitTags } from "./validation";

export async function saveCollection(
  _previous: CollectionEditState,
  data: FormData,
): Promise<CollectionEditState> {
  const incoming = await headers();
  if (incoming.get("origin") !== webServerConfig().publicOrigin)
    throw new Error("Invalid form origin");
  const id = String(data.get("id") ?? "");
  if (!isUuid(id)) throw new Error("Invalid collection");
  const draft = {
    title: String(data.get("title") ?? "").slice(0, 255),
    description: String(data.get("description") ?? "").slice(0, 5000),
    tags: String(data.get("tags") ?? "").slice(0, 2430),
    comments: data.get("comments") === "on",
  };
  const tags = splitTags(draft.tags);
  const patch = {
    title: draft.title.trim(),
    description: draft.description,
    tags,
    commentsEnabled: draft.comments,
  };
  const result = await formPost<Collection>(
    new Request(webServerConfig().publicOrigin, { headers: incoming }),
    `/api/v1/collections/${id}`,
    {
      ...patch,
      version: Number(data.get("version")),
    },
    false,
    "PATCH",
  );
  if (result.ok) redirect(`/c/${id}?notice=collection-saved`);
  const latest =
    result.status === 409 ? await serverRead<Collection>(`/api/v1/collections/${id}`) : null;
  return {
    ...draft,
    ...(latest?.ok ? { latest: latest.data } : {}),
    error:
      result.status === 401
        ? "Your session ended. Sign in again, then retry saving."
        : result.status === 409
          ? "This collection changed elsewhere since you opened it. Your draft is still here."
          : result.status === 400
            ? "Check the collection name and tags. Use up to 30 tags, each 80 characters or fewer."
            : "We couldn't save your collection. Your edits are still here; try again.",
  };
}
