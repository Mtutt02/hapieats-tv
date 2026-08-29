/**
 * PostgREST types every embedded relation as an array, even when the foreign
 * key is many-to-one and a single object is what actually comes back. Casting
 * straight to the object shape is a type error; casting through `unknown`
 * silences it but breaks if the shape is ever an array.
 *
 * `one()` normalizes either shape to a single row (or null), so the call site
 * is correct whichever PostgREST returns.
 */
export function one<T>(rel: T | T[] | null | undefined): T | null {
  if (rel == null) return null
  if (Array.isArray(rel)) return rel[0] ?? null
  return rel
}
