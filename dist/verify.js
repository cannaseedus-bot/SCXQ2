/**
 * SCXQ2 Pack Verifier (v1) — Deterministic Fail-First Ordering (FROZEN)
 *
 * Implements the reference verification algorithm from the SCXQ2 specification.
 * All error codes and ordering are normative and must not change.
 *
 * @module @asx/scxq2-cc/verify
 * @version 1.0.0
 */

import crypto from "crypto";

/* =============================================================================
   Known Field Sets (Normative)
============================================================================= */

const KNOWN_PACK_FIELDS = new Set([
  "@type", "@version", "mode", "encoding", "created_utc",
  "dict", "blocks", "proof", "pack_sha256_canon"
]);

const KNOWN_DICT_FIELDS = new Set([
  "@type", "@version", "mode", "encoding",
  "source_sha256_utf8", "dict", "dict_sha256_canon", "ops",
  "created_utc", "max_dict", "min_len", "flags"
]);

const KNOWN_BLOCK_FIELDS = new Set([
  "@type", "@version", "mode", "encoding",
  "lane_id", "source_sha256_utf8", "dict_sha256_canon",
  "b64", "block_sha256_canon", "edges", "ops",
  "created_utc", "original_bytes_utf8"
]);

const KNOWN_PROOF_FIELDS = new Set([
  "@type", "@version", "engine", "source_sha256_utf8",
  "dict_sha256_canon", "block_sha256_canon", "roundtrip_sha256_utf8", "ok",
  "created_utc", "steps", "recomputed"
]);

/* =============================================================================
   Default Policy Profile (Canonical)
============================================================================= */

export const SCXQ2_DEFAULT_POLICY = Object.freeze({
  requireRoundtrip: true,
  requireProof: true,
  maxDictEntries: 65535,
  maxDictEntryUnits: 1048576,
  maxBlocks: 1024,
  maxBlockB64Bytes: 67108864,
  maxOutputUnits: 134217728,
  allowEdges: true,
  allowUnknownPackFields: true,
  allowUnknownBlockFields: true,
  allowedModes: ["SCXQ2-DICT16-B64"],
  allowedEncodings: ["SCXQ2-1"],
  failOnFirstError: true
});

/* =============================================================================
   Error Helpers (Normative Shape)
============================================================================= */

function err(code, phase, message, at = {}) {
  return {
    "@type": "scxq2.error",
    "@version": "1.0.0",
    code,
    phase,
    severity: "fatal",
    message,
    at
  };
}

function fail(e) {
  return {
    "@type": "scxq2.verify.result",
    "@version": "1.0.0",
    ok: false,
    error: e
  };
}

function ok(packSha, dictSha, blocks) {
  return {
    "@type": "scxq2.verify.result",
    "@version": "1.0.0",
    ok: true,
    pack_sha256_canon: packSha,
    dict_sha256_canon: dictSha,
    blocks
  };
}

/* =============================================================================
   Utilities
============================================================================= */

function sha256HexUtf8(s) {
  return crypto.createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
}

function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}

export function canon(obj) {
  return JSON.stringify(sortKeysDeep(obj));
}

function copyMinus(obj, field) {
  const o = { ...obj };
  delete o[field];
  return o;
}

function hasUnknownFields(obj, knownSet) {
  for (const k of Object.keys(obj)) {
    if (!knownSet.has(k)) return true;
  }
  return false;
}

function isoUtcLike(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(s);
}

function strictB64Decode(b64) {
  if (typeof b64 !== "string" || b64.length === 0) return null;
  if (!/^[A-Za-z0-9+/=]+$/.test(b64)) return null;
  try {
    return Buffer.from(b64, "base64");
  } catch {
    return null;
  }
}

/* =============================================================================
   SCXQ2 Decode (JS Reference Implementation)
============================================================================= */

/**
 * Decodes SCXQ2 byte stream to UTF-16 string.
 *
 * @param {string[]} dictArr - Dictionary array
 * @param {Uint8Array|Buffer} bytes - Encoded bytes
 * @param {Object} limits - Decode limits
 * @returns {{ok: true, value: string}|{ok: false, kind: string, byte_offset: number}}
 */
export function scxq2DecodeUtf16(dictArr, bytes, limits = {}) {
  const maxOut = limits?.maxOutputUnits ?? SCXQ2_DEFAULT_POLICY.maxOutputUnits;
  let out = "";
  let outUnits = 0;

  const m = bytes.length;
  for (let i = 0; i < m; ) {
    const b = bytes[i];

    // ASCII literal
    if (b <= 0x7f) {
      out += String.fromCharCode(b);
      outUnits += 1;
      i += 1;
    }
    // DICT ref
    else if (b === 0x80) {
      if (i + 2 >= m) {
        return { ok: false, kind: "truncated_sequence", byte_offset: i };
      }
      const j = (bytes[i + 1] << 8) | bytes[i + 2];
      if (j < 0 || j >= dictArr.length) {
        return { ok: false, kind: "dict_index_oob", byte_offset: i, index: j };
      }
      const tok = dictArr[j];
      if (typeof tok !== "string") {
        return { ok: false, kind: "dict_entry_invalid", byte_offset: i, index: j };
      }
      out += tok;
      outUnits += tok.length;
      i += 3;
    }
    // UTF-16 literal
    else if (b === 0x81) {
      if (i + 2 >= m) {
        return { ok: false, kind: "truncated_sequence", byte_offset: i };
      }
      const u = (bytes[i + 1] << 8) | bytes[i + 2];
      out += String.fromCharCode(u);
      outUnits += 1;
      i += 3;
    }
    // Invalid byte
    else {
      return { ok: false, kind: "invalid_byte", byte_offset: i, byte: b };
    }

    if (outUnits > maxOut) {
      return { ok: false, kind: "output_limit", byte_offset: Math.min(m - 1, i) };
    }
  }

  return { ok: true, value: out };
}

function mapDecodeErr(de, lane_id, index) {
  const at = { lane_id: lane_id ?? undefined, index, byte_offset: de.byte_offset };
  switch (de.kind) {
    case "invalid_byte":
      return err("scxq2.error.decode_invalid_byte", "decode", "invalid byte", at);
    case "truncated_sequence":
      return err("scxq2.error.decode_truncated_sequence", "decode", "truncated sequence", at);
    case "dict_index_oob":
      return err("scxq2.error.decode_dict_index_oob", "decode", "dict index out of bounds", at);
    case "dict_entry_invalid":
      return err("scxq2.error.decode_dict_entry_invalid", "decode", "dict entry invalid", at);
    case "output_limit":
      return err("scxq2.error.decode_output_limit", "decode", "output limit exceeded", at);
    default:
      return err("scxq2.error.decode_internal", "decode", "decode internal error", at);
  }
}

/* =============================================================================
   Pack Verifier (Reference Algorithm)
============================================================================= */

/**
 * Verifies an SCXQ2 pack according to the frozen v1 specification.
 * Follows deterministic fail-first ordering.
 *
 * @param {Object} pack - SCXQ2 pack object
 * @param {Object} [opts] - Policy options (merged with SCXQ2_DEFAULT_POLICY)
 * @returns {Object} Verification result
 */
export function scxq2PackVerify(pack, opts = {}) {
  const P = { ...SCXQ2_DEFAULT_POLICY, ...(opts || {}) };

  // =========================================================
  // STEP 1 — PACK STRUCTURE
  // =========================================================
  if (!pack || typeof pack !== "object") {
    return fail(err("scxq2.error.pack_missing", "pack", "pack missing"));
  }

  if (pack["@type"] !== "scxq2.pack") {
    return fail(err("scxq2.error.pack_type_invalid", "pack", "bad @type", { field: "@type" }));
  }

  if (pack["@version"] !== "1.0.0") {
    return fail(err("scxq2.error.pack_version_unsupported", "pack", "unsupported @version", { field: "@version" }));
  }

  if (!P.allowedModes.includes(pack["mode"])) {
    return fail(err("scxq2.error.pack_mode_mismatch", "pack", "mode not allowed", { field: "mode" }));
  }

  if (!P.allowedEncodings.includes(pack["encoding"])) {
    return fail(err("scxq2.error.pack_encoding_mismatch", "pack", "encoding not allowed", { field: "encoding" }));
  }

  if (P.allowUnknownPackFields === false && hasUnknownFields(pack, KNOWN_PACK_FIELDS)) {
    return fail(err("scxq2.error.pack_field_forbidden", "pack", "unknown pack field"));
  }

  if ("created_utc" in pack && !isoUtcLike(pack.created_utc)) {
    return fail(err("scxq2.error.pack_created_utc_invalid", "pack", "invalid created_utc", { field: "created_utc" }));
  }

  if (!pack.dict) {
    return fail(err("scxq2.error.dict_missing", "dict", "dict missing", { field: "dict" }));
  }

  if (!Array.isArray(pack.blocks) || pack.blocks.length < 1) {
    return fail(err("scxq2.error.pack_blocks_missing", "pack", "blocks missing/empty", { field: "blocks" }));
  }

  if (pack.blocks.length > P.maxBlocks) {
    return fail(err("scxq2.error.decode_input_limit", "pack", "too many blocks", { field: "blocks" }));
  }

  if (P.requireProof && !pack.proof) {
    return fail(err("scxq2.error.pack_proof_missing", "pack", "proof required", { field: "proof" }));
  }

  // =========================================================
  // STEP 2 — DICT STRUCTURE
  // =========================================================
  const dict = pack.dict;

  if (!dict || typeof dict !== "object") {
    return fail(err("scxq2.error.dict_type_invalid", "dict", "dict not object", { field: "dict" }));
  }

  if (dict["@type"] !== "scxq2.dict") {
    return fail(err("scxq2.error.dict_type_invalid", "dict", "bad dict @type", { field: "dict.@type" }));
  }

  if (dict["@version"] !== "1.0.0") {
    return fail(err("scxq2.error.dict_version_unsupported", "dict", "unsupported dict @version", { field: "dict.@version" }));
  }

  if (!P.allowedModes.includes(dict.mode)) {
    return fail(err("scxq2.error.pack_mode_mismatch", "dict", "dict mode mismatch", { field: "dict.mode" }));
  }

  if (!P.allowedEncodings.includes(dict.encoding)) {
    return fail(err("scxq2.error.pack_encoding_mismatch", "dict", "dict encoding mismatch", { field: "dict.encoding" }));
  }

  if (!Array.isArray(dict.dict)) {
    return fail(err("scxq2.error.dict_entry_type_invalid", "dict", "dict.dict must be array", { field: "dict.dict" }));
  }

  if (dict.dict.length > P.maxDictEntries) {
    return fail(err("scxq2.error.dict_size_exceeds_limit", "dict", "dict too large", { field: "dict.dict" }));
  }

  for (let j = 0; j < dict.dict.length; j++) {
    const e = dict.dict[j];
    if (typeof e !== "string") {
      return fail(err("scxq2.error.dict_entry_type_invalid", "dict", "dict entry not string", { field: "dict.dict", index: j }));
    }
    if (e.length > P.maxDictEntryUnits) {
      return fail(err("scxq2.error.dict_entry_exceeds_limit", "dict", "dict entry too long", { field: "dict.dict", index: j }));
    }
  }

  if (!dict.dict_sha256_canon) {
    return fail(err("scxq2.error.dict_sha_missing", "canon", "dict sha missing", { field: "dict.dict_sha256_canon" }));
  }

  // =========================================================
  // STEP 3 — BLOCK STRUCTURE
  // =========================================================
  const dictSha = dict.dict_sha256_canon;

  for (let k = 0; k < pack.blocks.length; k++) {
    const b = pack.blocks[k];

    if (!b || typeof b !== "object" || b["@type"] !== "scxq2.block") {
      return fail(err("scxq2.error.block_type_invalid", "block", "bad block @type", { field: "blocks", index: k }));
    }

    if (!P.allowedModes.includes(b.mode)) {
      return fail(err("scxq2.error.block_mode_mismatch", "block", "block mode mismatch", { field: "blocks.mode", index: k }));
    }

    if (!P.allowedEncodings.includes(b.encoding)) {
      return fail(err("scxq2.error.block_encoding_mismatch", "block", "block encoding mismatch", { field: "blocks.encoding", index: k }));
    }

    if (typeof b.b64 !== "string" || b.b64.length === 0) {
      return fail(err("scxq2.error.block_b64_missing", "block", "b64 missing", { field: "blocks.b64", index: k }));
    }

    if (!b.dict_sha256_canon) {
      return fail(err("scxq2.error.block_dict_link_missing", "block", "missing dict link", { field: "blocks.dict_sha256_canon", index: k }));
    }

    if (b.dict_sha256_canon !== dictSha) {
      return fail(err("scxq2.error.block_dict_link_mismatch", "block", "dict link mismatch", { field: "blocks.dict_sha256_canon", index: k }));
    }

    if (!b.block_sha256_canon) {
      return fail(err("scxq2.error.block_sha_missing", "canon", "block sha missing", { field: "blocks.block_sha256_canon", index: k }));
    }

    if (P.requireRoundtrip && !b.source_sha256_utf8) {
      return fail(err("scxq2.error.block_source_sha_missing", "block", "source sha required", { field: "blocks.source_sha256_utf8", index: k }));
    }

    if (P.allowUnknownBlockFields === false && hasUnknownFields(b, KNOWN_BLOCK_FIELDS)) {
      return fail(err("scxq2.error.pack_field_forbidden", "block", "unknown block field", { field: "blocks", index: k }));
    }

    if (P.allowEdges === false && "edges" in b) {
      return fail(err("scxq2.error.policy_disabled_feature", "block", "edges not allowed", { field: "blocks.edges", index: k }));
    }
  }

  // =========================================================
  // STEP 4 — CANONICAL HASH VERIFICATION
  // =========================================================
  if (!pack.pack_sha256_canon) {
    return fail(err("scxq2.error.pack_sha_missing", "canon", "pack sha missing", { field: "pack_sha256_canon" }));
  }

  {
    const packSha = sha256HexUtf8(canon(copyMinus(pack, "pack_sha256_canon")));
    if (packSha !== pack.pack_sha256_canon) {
      return fail(err("scxq2.error.pack_sha_mismatch", "canon", "pack sha mismatch", { field: "pack_sha256_canon" }));
    }
  }

  {
    const dictSha2 = sha256HexUtf8(canon(copyMinus(dict, "dict_sha256_canon")));
    if (dictSha2 !== dict.dict_sha256_canon) {
      return fail(err("scxq2.error.dict_sha_mismatch", "canon", "dict sha mismatch", { field: "dict.dict_sha256_canon" }));
    }
  }

  for (let k = 0; k < pack.blocks.length; k++) {
    const b = pack.blocks[k];
    const bSha2 = sha256HexUtf8(canon(copyMinus(b, "block_sha256_canon")));
    if (bSha2 !== b.block_sha256_canon) {
      return fail(err("scxq2.error.block_sha_mismatch", "canon", "block sha mismatch", { field: "blocks.block_sha256_canon", index: k }));
    }
  }

  // =========================================================
  // STEP 5 — BASE64 DECODE + DECODE LAW + ROUNDTRIP
  // =========================================================
  for (let k = 0; k < pack.blocks.length; k++) {
    const b = pack.blocks[k];
    const bytes = strictB64Decode(b.b64);

    if (!bytes) {
      return fail(err("scxq2.error.block_b64_invalid", "block", "invalid base64", { field: "blocks.b64", index: k }));
    }

    if (bytes.length > P.maxBlockB64Bytes) {
      return fail(err("scxq2.error.decode_input_limit", "decode", "block bytes exceed limit", { field: "blocks.b64", index: k }));
    }

    const dec = scxq2DecodeUtf16(dict.dict, bytes, { maxOutputUnits: P.maxOutputUnits });
    if (!dec.ok) {
      return fail(mapDecodeErr(dec, b.lane_id, k));
    }

    if (P.requireRoundtrip) {
      const outSha = sha256HexUtf8(dec.value);
      if (outSha !== b.source_sha256_utf8) {
        return fail(err("scxq2.error.proof_roundtrip_sha_mismatch", "proof", "roundtrip sha mismatch", { lane_id: b.lane_id, index: k }));
      }
    }
  }

  // =========================================================
  // STEP 6 — PROOF OBJECT
  // =========================================================
  if (P.requireProof) {
    const proof = pack.proof;

    if (!proof || typeof proof !== "object") {
      return fail(err("scxq2.error.proof_type_invalid", "proof", "proof invalid", { field: "proof" }));
    }

    if (proof["@type"] !== "cc.proof") {
      return fail(err("scxq2.error.proof_type_invalid", "proof", "bad proof @type", { field: "proof.@type" }));
    }

    if (proof["@version"] !== "1.0.0") {
      return fail(err("scxq2.error.proof_version_unsupported", "proof", "unsupported proof version", { field: "proof.@version" }));
    }

    if (proof.ok !== true) {
      return fail(err("scxq2.error.proof_ok_false", "proof", "proof ok false", { field: "proof.ok" }));
    }

    // Witness presence check
    for (const f of ["engine", "source_sha256_utf8", "dict_sha256_canon", "block_sha256_canon", "roundtrip_sha256_utf8"]) {
      if (!proof[f]) {
        return fail(err("scxq2.error.proof_witness_missing", "proof", "missing proof witness", { field: `proof.${f}` }));
      }
    }
  }

  // =========================================================
  // SUCCESS
  // =========================================================
  return ok(pack.pack_sha256_canon, dict.dict_sha256_canon, pack.blocks.length);
}
