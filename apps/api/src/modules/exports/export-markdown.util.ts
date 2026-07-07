import { ResourceKind } from "src/common/enums/resource-kind.enum";
import { Collection, Resource } from "src/generated/prisma/client";

export type ResourceForExport = Resource & {
  linkedCollection: Collection | null;
};

export function buildMarkdown(collection: Collection, resources: ResourceForExport[]) {
  const lines: string[] = [];
  lines.push(`# ${collection.title}`);

  if (collection.description) {
    lines.push("");
    lines.push(collection.description);
  }

  lines.push("");
  lines.push(`- Published: ${collection.published ? "yes" : "no"}`);
  lines.push(`- Updated: ${collection.updatedAt.toISOString()}`);

  lines.push("");
  lines.push("## Resources");

  for (const resource of resources) {
    if ((resource.kind as ResourceKind) === ResourceKind.EXTERNAL_LINK) {
      const url = resource.url ?? "";
      const title = resource.titleOverride ?? (url || "Untitled Link");
      lines.push(`- [${title}](${url})`);
    } else {
      const title = resource.titleOverride ?? resource.linkedCollection?.title ?? "Collection";
      lines.push(`- [Collection] ${title}`);
    }

    if (resource.tags.length > 0) {
      lines.push(`  - Tags: ${resource.tags.join(", ")}`);
    }
  }

  return lines.join("\n");
}
