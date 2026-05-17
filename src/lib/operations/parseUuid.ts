/**
 * UUID format validation predicate.
 *
 * Accepts any UUID version/variant matching the canonical 8-4-4-4-12 hex format.
 * Case-insensitive (the DB column accepts mixed case; we normalize on insert).
 *
 * Use at route entry points after auth, before passing client-provided UUIDs
 * into Prisma queries. Closes the Citadel-posture gap where malformed UUIDs
 * would otherwise surface as Prisma P2023 errors → 500 Internal Server Error.
 *
 * Caller pattern:
 *   if (!isValidUuid(taskId)) {
 *     return NextResponse.json(
 *       { error: 'Validation', field: 'taskId', message: 'Invalid UUID format' },
 *       { status: 400 }
 *     );
 *   }
 */
export function isValidUuid(s: unknown): s is string {
  return typeof s === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
