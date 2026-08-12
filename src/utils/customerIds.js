/**
 * Customer ID formatting / normalisation utilities.
 *
 * Canonical format: `ADB` followed by exactly 6 digits, e.g. `ADB550023`.
 * The numeric portion starts at 550000 (so the first real customer is ADB550001)
 * which keeps every ID at a fixed width and leaves room for legacy-numeric
 * mappings (CUST-0001 -> ADB550001) to be deterministic.
 */
export const CUSTOMER_ID_PREFIX = "ADB";
export const CUSTOMER_ID_BASE = 550000;
export const CUSTOMER_ID_REGEX = /^ADB\d{6}$/;

/**
 * Build a canonical customer ID from a 1-based sequence number.
 * @param {number|string} seq
 * @returns {string|null}
 */
export function formatCustomerId(seq) {
  const n = Number(seq);
  if (!Number.isFinite(n) || n < 0) return null;
  return `${CUSTOMER_ID_PREFIX}${CUSTOMER_ID_BASE + n}`;
}

export function isValidCustomerId(id) {
  return CUSTOMER_ID_REGEX.test(id || "");
}

/**
 * Simple deterministic string hash -> positive integer.
 * Used to derive a stable sequence number for non-numeric legacy IDs.
 */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Convert any legacy / inconsistent customer ID into the canonical
 * `ADB\d{6}` format. Values that are already canonical pass through.
 *
 * Recognised legacy shapes:
 *  - `CUST-0001`            -> `ADB550001`   (numeric suffix)
 *  - `CUST-BIJOY`           -> `ADB55XXXX`   (slug -> stable hash range)
 *  - `0001` / `1`           -> `ADB550001`
 *
 * Anything unrecognisable is returned unchanged so callers can decide.
 */
export function normalizeCustomerId(id) {
  if (!id) return id;
  const str = String(id).trim();

  if (isValidCustomerId(str)) return str;

  // Pure numeric id -> treat as a sequence number.
  if (/^\d+$/.test(str)) {
    return formatCustomerId(Number(str));
  }

  // CUST-<digits>
  const numericMatch = str.match(/^CUST-(\d+)$/i);
  if (numericMatch) {
    return formatCustomerId(Number(numericMatch[1]));
  }

  // CUST-<slug> (non-numeric) -> stable deterministic id in a safe range
  // (551000-559999) so it never collides with sequential 550001-550999 ids.
  const slugMatch = str.match(/^CUST-([A-Za-z0-9_-]+)$/);
  if (slugMatch) {
    const seq = 1000 + (hashCode(slugMatch[1]) % 9000);
    return formatCustomerId(seq);
  }

  // Unknown shape - leave untouched.
  return str;
}
