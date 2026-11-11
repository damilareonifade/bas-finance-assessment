/** One key per user intent. Reuse it on retry; create a new one only after success or when the inputs change. */
export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}
