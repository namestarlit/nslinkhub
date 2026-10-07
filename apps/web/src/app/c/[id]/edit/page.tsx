import type { Collection } from "@nslinkhub/types";
import type { Metadata } from "next";
import { CollectionEditForm } from "../../../../components/collection-editor";
import { CollectionFeedback } from "../../../../components/collection-feedback";
import { saveCollection } from "../../../../lib/collection-actions";
import { collectionPath, failure, permalink } from "../../../../lib/http";
import { serverRead } from "../../../../lib/server-api";

export const metadata: Metadata = { title: "Edit collection" };
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unavailable = (
    <CollectionFeedback error={failure("not_found", 404)} returnTo={permalink(id)} />
  );
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))
    return unavailable;
  const result = await serverRead<Collection>(collectionPath(id));
  if (!result.ok) return <CollectionFeedback error={result} returnTo={`/c/${id}/edit`} />;
  // The API owns the capability; this only avoids showing a form that would be refused.
  if (!result.data.capabilities?.canManage) return unavailable;
  return (
    <section className="reader account-flow edit-page">
      <nav className="context" aria-label="Collection context">
        <a href={permalink(id)}>{result.data.title}</a>
      </nav>
      <h1>Edit collection</h1>
      <CollectionEditForm collection={result.data} saveAction={saveCollection} />
    </section>
  );
}
