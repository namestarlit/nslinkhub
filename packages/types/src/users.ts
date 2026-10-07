import type { IsoTimestamp } from "./envelope.js";

// The authenticated user's own profile (GET/PATCH /profile). `handle`/`hubId`
// describe the user's one hub; `hubId` is the client's entry point to every
// hub-scoped call.
export interface Profile {
  id: string;
  displayName: string;
  showNameOnHub: boolean;
  handle: string | null;
  hubId: string | null;
  hubName: string | null;
  email: string;
  hubDescription: string | null;
  image: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface UpdateProfileRequest {
  hubName?: string;
  displayName?: string;
  showNameOnHub?: boolean;
  handle?: string;
  hubDescription?: string;
}

export interface HandleAvailability {
  handle: string;
  status: "available" | "current" | "invalid" | "reserved" | "taken";
}
