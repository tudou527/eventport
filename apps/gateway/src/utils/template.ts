/**
 * Subscription instructions template rendering.
 *
 * Users write an instruction template per subscription (e.g. "Review the PR
 * on {{repository.full_name}}, branch {{pull_request.head.ref}}"). GET /events
 * renders it against each event and returns the result as `text`, so consumer
 * agents receive a ready-to-act instruction instead of the raw payload.
 */

/** Placeholder shape: {{a.b.c}} — dot-path with optional surrounding spaces. */
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Rendering context: payload fields plus the event envelope's messageId/timestamp. */
function buildContext(event: { messageId: string; payload: unknown; timestamp: number }): Record<string, unknown> {
  const payload =
    event.payload !== null && typeof event.payload === 'object' && !Array.isArray(event.payload)
      ? (event.payload as Record<string, unknown>)
      : {};
  return { messageId: event.messageId, timestamp: event.timestamp, ...payload };
}

/** Resolve a dot-path against the context. Returns undefined when any segment is missing. */
function lookup(context: Record<string, unknown>, path: string): unknown {
  let current: unknown = context;
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Render the template against one event. Unresolvable placeholders are kept
 * as-is so template mistakes stay visible to the user's agent. Objects are
 * JSON-stringified; other values go through String().
 */
export function renderInstructions(
  template: string,
  event: { messageId: string; payload: unknown; timestamp: number }
): string {
  const context = buildContext(event);
  return template.replace(PLACEHOLDER, (placeholder, path: string) => {
    const value = lookup(context, path);
    if (value === undefined) {
      return placeholder;
    }
    return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
  });
}
