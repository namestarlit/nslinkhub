// The app-owned session principal. Downstream code consumes this, never
// better-auth types. Identity is the immutable userId; the display name and the
// hub handle are looked up per request when needed, not carried here.
export interface AuthUser {
  userId: string;
}
