/**
 * SCXQ2 Base64 Utilities
 *
 * Universal base64 encoding/decoding that works in Node.js, browsers, and workers.
 * Handles the "base64:" prefix format used in some SCXQ2 contexts.
 *
 * @module @asx/scxq2-cc/base64
 * @version 1.0.0
 */

/**
 * Encodes bytes to base64 string.
 *
 * @param {Uint8Array|number[]} bytes - Bytes to encode
 * @returns {string} Base64-encoded string
 */
export function bytesToBase64(bytes) {
  // Ensure we have a proper array-like
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  // Node.js Buffer
  if (typeof Buffer !== "undefined" && Buffer.from) {
    return Buffer.from(arr).toString("base64");
  }

  // Browser/Worker: use btoa
  if (typeof btoa === "function") {
    let binary = "";
    for (let i = 0; i < arr.length; i++) {
      binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary);
  }

  throw new Error("SCXQ2: no base64 encoder available");
}

/**
 * Decodes base64 string to bytes.
 * Automatically strips "base64:" prefix if present.
 *
 * @param {string} b64 - Base64-encoded string
 * @returns {Uint8Array} Decoded bytes
 */
export function base64ToBytes(b64) {
  // Strip optional "base64:" prefix
  const clean = String(b64).startsWith("base64:")
    ? String(b64).slice(7)
    : String(b64);

  // Node.js Buffer
  if (typeof Buffer !== "undefined" && Buffer.from) {
    return new Uint8Array(Buffer.from(clean, "base64"));
  }

  // Browser/Worker: use atob
  if (typeof atob === "function") {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  throw new Error("SCXQ2: no base64 decoder available");
}

/**
 * Validates that a string is valid base64.
 *
 * @param {string} b64 - String to validate
 * @returns {boolean} True if valid base64
 */
export function isValidBase64(b64) {
  const clean = String(b64).startsWith("base64:")
    ? String(b64).slice(7)
    : String(b64);

  // Standard base64 regex
  const regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return regex.test(clean) && clean.length % 4 === 0;
}
