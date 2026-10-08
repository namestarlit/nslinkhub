"use client";
import { useRef } from "react";
import { useDismissible } from "./dismissible";

// On narrow screens a contributor's History and Edit fold behind one button and
// expand in place in the bar (no popup); the same button collapses them.
// Share stays out.
export function CollectionMoreMenu({ id, canManage }: { id: string; canManage: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useDismissible(menu);
  return (
    <details className="collection-more" ref={menu}>
      <summary className="button" aria-label="More actions">
        <span className="more-open" aria-hidden="true">
          ⋯
        </span>
        <span className="more-close" aria-hidden="true">
          ✕
        </span>
      </summary>
      <div className="collection-more-items">
        <a className="button" href={`/c/${id}/history`}>
          History
        </a>
        {canManage && (
          <a className="button" href={`/c/${id}/edit`}>
            Edit
          </a>
        )}
      </div>
    </details>
  );
}
