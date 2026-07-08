import type { Collection } from "./collections";

// One hub per user (Google-Drive model): no memberships, no roles beyond the
// owner; sharing happens per collection (see collections.ts).
export interface HubSummary {
  id: string;
  handle: string;
  description: string | null;
}

export interface HubPage {
  hub: HubSummary;
  collections: Collection[];
}
