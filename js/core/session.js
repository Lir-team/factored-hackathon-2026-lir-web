/*
 * The customer's sign-in token for the bank API.
 *
 * With signInEndpoint set, the token comes from the bank's sign-in (mocked by the demo
 * sign-in, POST /v1/demo/sign-in) and is renewed shortly before it expires. Without it,
 * the fixed authToken from the configuration is used as is (local runs).
 */
import { withApiKey } from "./submit.js";

export class SignInError extends Error {
  constructor(status) {
    super(`sign-in failed: ${status}`);
    this.status = status;
  }
}

/** A session that hands out a valid token; `token()` signs in again when it is about to expire. */
export function createSession(
  { signInEndpoint = null, authToken = null, apiKey = null } = {},
  { fetchImpl = globalThis.fetch, now = () => Date.now(), renewBeforeMs = 120000, timeoutMs = 15000 } = {},
) {
  let current = null; // { token, expiresAt } from the last sign-in
  return {
    async token() {
      if (!signInEndpoint) return authToken;
      if (current && current.expiresAt - renewBeforeMs > now()) return current.token;
      const response = await fetchImpl(withApiKey(signInEndpoint, apiKey), {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new SignInError(response.status);
      const body = await response.json();
      current = { token: body.token, expiresAt: Date.parse(body.expires_at) };
      return current.token;
    },
  };
}
