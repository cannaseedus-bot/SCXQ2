/**
 * SCXQ2 Canonical JSON Utilities
 *
 * Provides deterministic JSON serialization with sorted keys for
 * content-addressable hashing and reproducible pack identities.
 *
 * @module @asx/scxq2-cc/canon
 * @version 1.0.0
 */

/**
 * Recursively sorts object keys for deterministic JSON output.
 * Arrays are preserved in order, objects have keys sorted alphabetically.
 *
 * @param {*} value - Any JSON-serializable value
 * @returns {*} Value with all nested object keys sorted
 */
export function sortKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (value !== null && typeof value === "object") {
    const sorted = {};
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      sorted[key] = sortKeysDeep(value[key]);
    }
    return sorted;
  }

  return value;
}

/**
 * Produces canonical JSON string with sorted keys.
 * This is the required serialization for all SCXQ2 hash computations.
 *
 * @param {*} obj - Object to serialize
 * @returns {string} Canonical JSON string
 */
export function canon(obj) {
  return JSON.stringify(sortKeysDeep(obj));
}

/**
 * Creates a shallow copy of an object with specified fields removed.
 * Used for computing hashes that exclude the hash field itself.
 *
 * @param {Object} obj - Source object
 * @param {string[]} fields - Fields to exclude
 * @returns {Object} New object without excluded fields
 */
export function strip(obj, fields) {
  const copy = { ...obj };
  for (const field of fields) {
    delete copy[field];
  }
  return copy;
}
