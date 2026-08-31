/** Common interface implemented by every source-specific webhook verifier. */
export interface WebhookVerifier {
  /** Source identifier this verifier handles (e.g. "github", "linear"). */
  source: string;
  /** Name of the HTTP request header that carries the signature. */
  headerName: string;
  /** Name of the header that identifies the event type (used for logging only). */
  eventNameHeader?: string;
  /** Name of the header carrying the delivery ID (used for logging only). */
  deliveryIdHeader?: string;

  /**
   * Verify the signature of an incoming webhook.
   *
   * Implementations MUST:
   *   - Be side-effect free (no DB writes, no logging).
   *   - Use constant-time comparison to defend against timing attacks.
   *   - Return `valid: false` with a human-readable `reason` on failure so the
   *     caller can log it without leaking the secret.
   *
   * Implementations MUST NOT:
   *   - Mutate `headers` or `rawBody`.
   *   - Throw — wrap any internal error into `{ valid: false, reason }`.
   *
   * The function is async because some platforms (notably Cloudflare Workers'
   * Web Crypto SubtleCrypto) only expose HMAC asynchronously. Callers must
   * `await` the result before accepting or rejecting the webhook.
   */
  verify(params: {
    secret: string | null;
    rawBody: string;
    headers: Headers;
    /** Full request URL (e.g. `https://host/hooks/key`). Required so that
     * providers that include the URL in the signed payload (HubSpot v3)
     * can reconstruct it. Ignored by providers that don't sign the URL. */
    url: string;
    /** HTTP method of the incoming request. Used by HubSpot v3. */
    method: string;
  }): Promise<{ valid: boolean; reason?: string }>;
}
