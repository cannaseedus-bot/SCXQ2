/**
 * SCXQ2 SHA-256 Utilities
 *
 * Universal SHA-256 hashing that works in Node.js, browsers, and workers.
 * Provides both async (WebCrypto) and sync (Node crypto) implementations.
 *
 * @module @asx/scxq2-cc/sha
 * @version 1.0.0
 */

/**
 * Computes SHA-256 hash of UTF-8 text, returning hex string.
 * Uses WebCrypto when available, falls back to Node crypto.
 *
 * @param {string} text - UTF-8 text to hash
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
export async function sha256HexUtf8(text) {
  // WebCrypto (browser / worker)
  if (globalThis.crypto?.subtle) {
    const data = new TextEncoder().encode(text);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)]
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Node.js
  const { createHash } = await import("crypto");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Synchronous SHA-256 hash (Node.js only).
 * Throws if crypto module is not available.
 *
 * @param {string} text - UTF-8 text to hash
 * @param {Object} [nodeCrypto] - Pre-imported crypto module (optional)
 * @returns {string} Hex-encoded SHA-256 hash
 */
export function sha256HexUtf8Sync(text, nodeCrypto = null) {
  if (nodeCrypto) {
    return nodeCrypto.createHash("sha256").update(text, "utf8").digest("hex");
  }

  // Dynamic require for Node.js environments
  if (typeof process !== "undefined" && process.versions?.node) {
    // Use dynamic import trick for sync context
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(text, "utf8").digest("hex");
  }

  throw new Error("SCXQ2: sync hashing requires Node.js crypto module");
}

/**
 * Gets Node.js crypto module if available.
 * Returns null in browser/worker environments.
 *
 * @returns {Object|null} Node crypto module or null
 */
export function getNodeCrypto() {
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      return require("crypto");
    } catch {
      return null;
    }
  }
  return null;
}
