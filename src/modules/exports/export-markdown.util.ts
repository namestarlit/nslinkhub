import { EntryKind } from 'src/common/enums/entry-kind.enum';
import {
  Entry,
  EntryTag,
  Link,
  Repository,
  Tag,
} from 'src/generated/prisma/client';

export type EntryForExport = Entry & {
  link: Link | null;
  linkedRepository: Repository | null;
  entryTags: (EntryTag & { tag: Tag | null })[];
};

export function buildMarkdown(
  repository: Repository,
  entries: EntryForExport[],
) {
  const lines: string[] = [];
  lines.push(`# ${repository.title}`);

  if (repository.description) {
    lines.push('');
    lines.push(repository.description);
  }

  lines.push('');
  lines.push(`- Visibility: ${repository.visibility}`);
  lines.push(`- Updated: ${repository.updatedAt.toISOString()}`);

  lines.push('');
  lines.push('## Resources');

  for (const entry of entries) {
    if ((entry.kind as EntryKind) === EntryKind.EXTERNAL_LINK) {
      const title =
        entry.titleOverride ?? entry.link?.canonicalUrl ?? 'Untitled Link';
      const url = entry.link?.canonicalUrl ?? '';
      lines.push(`- [${title}](${url})`);
    } else {
      const title =
        entry.titleOverride ?? entry.linkedRepository?.title ?? 'Repository';
      lines.push(`- [Repository] ${title}`);
    }

    if (entry.description) {
      lines.push(`  - Description: ${entry.description}`);
    }

    if (entry.note) {
      lines.push(`  - Note: ${entry.note}`);
    }

    const tagNames = entry.entryTags
      ?.map((entryTag) => entryTag.tag?.name)
      .filter(Boolean);
    if (tagNames && tagNames.length > 0) {
      lines.push(`  - Tags: ${tagNames.join(', ')}`);
    }
  }

  return lines.join('\n');
}
