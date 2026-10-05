import type { IsoTimestamp } from "./envelope.js";

// The authenticated user's own profile (GET/PATCH /profile). `handle`/`hubId`
// describe the user's one hub; `hubId` is the client's entry point to every
// hub-scoped call.
export interface Profile {
  id: string;
  displayName: string;
  handle: string | null;
  hubId: string | null;
  email: string;
  bio: string | null;
  image: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface UpdateProfileRequest {
  displayName?: string;
  handle?: string;
  bio?: string;
}
