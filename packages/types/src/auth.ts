/** App-owned codes-only HTTP inputs; auth-library internals stay API-private. */
export interface SendSignInCodeRequest {
  email: string;
}
export interface VerifySignInCodeRequest {
  email: string;
  code: string;
  /** Optional display name, used only when the verified address creates an account. */
  name?: string;
}
export interface StartEmailChangeRequest {
  newEmail: string;
}
export interface ConfirmEmailChangeRequest {
  code: string;
}
export interface AuthActionSuccess {
  success: true;
}
