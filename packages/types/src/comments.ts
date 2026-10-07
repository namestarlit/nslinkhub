import type { IsoTimestamp, PersonRef } from "./envelope.js";

// Who wrote a comment: the universal person reference (name only when the
// author shows it) plus a role marking the collection's owner or an editor.
export interface CommentAuthor extends PersonRef {
  id: string;
  role: "owner" | "editor" | null;
}

export interface CommentView {
  id: string;
  parentId: string | null;
  // Null for hidden (to non-moderators) or deleted comments kept for their replies.
  body: string | null;
  state: "visible" | "hidden" | "deleted";
  // A reply the owner or an editor marked as the answer to its question.
  accepted: boolean;
  author: CommentAuthor | null;
  version: number;
  createdAt: IsoTimestamp;
  editedAt: IsoTimestamp | null;
  canEdit: boolean;
  canModerate: boolean;
  replies: CommentView[];
  // Continue this thread with replyTo=id and replyCursor on the same question page.
  repliesNextCursor: string | null;
}

export interface CommentThreads {
  comments: CommentView[];
  // Comments are switched on for this collection.
  enabled: boolean;
  // The viewer may post (signed in, has access, comments on, not on hold).
  canComment: boolean;
}
