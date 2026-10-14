/** Shared state shape for the auth forms (kept out of the "use server" file). */
export interface AuthActionState {
  /** Human-readable failure to show under the form. */
  error?: string;
  /** Success note that does not navigate (e.g. "confirm your email"). */
  notice?: string;
}

export const EMPTY_AUTH_STATE: AuthActionState = {};
