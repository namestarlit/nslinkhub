import { ResourceKind } from "src/common/enums/resource-kind.enum";
import { Collection, Link, Resource, ResourceTag, Tag } from "src/generated/prisma/client";

export type ResourceForExport = Resource & {
  link: Link | null;
  linkedCollection: Collection | null;
  resourceTags: (ResourceTag & { tag: Tag | null })[];
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
      const title = resource.titleOverride ?? resource.link?.canonicalUrl ?? "Untitled Link";
      const url = resource.link?.canonicalUrl ?? "";
      lines.push(`- [${title}](${url})`);
    } else {
      const title = resource.titleOverride ?? resource.linkedCollection?.title ?? "Collection";
      lines.push(`- [Collection] ${title}`);
    }

    const tagNames = resource.resourceTags
      ?.map((resourceTag) => resourceTag.tag?.name)
      .filter(Boolean);
    if (tagNames && tagNames.length > 0) {
      lines.push(`  - Tags: ${tagNames.join(", ")}`);
    }
  }

  return lines.join("\n");
}
