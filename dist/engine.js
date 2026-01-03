/**
 * SCXQ2 Compression Calculus Engine (CC-v1)
 *
 * A deterministic, proof-generating compression engine that produces
 * content-addressable language packs. Implements the frozen SCXQ2 specification.
 *
 * Features:
 * - Single-lane and multi-lane compression
 * - CC operators: NORM, DICT, FIELD, LANE, EDGE
 * - Cryptographic proof of reversibility
 * - Universal runtime (Node.js, Browser, Worker)
 *
 * @module @asx/scxq2-cc/engine
 * @version 1.0.0
 */

import { canon, strip } from "./canon.js";
import { sha256HexUtf8, sha256HexUtf8Sync, getNodeCrypto } from "./sha.js";
import { bytesToBase64, base64ToBytes } from "./base64.js";

/* =============================================================================
   Engine Identity (FROZEN)
============================================================================= */

export const CC_ENGINE = Object.freeze({
  "@id": "asx://cc/engine/scxq2.v1",
  "@type": "cc.engine",
  "@version": "1.0.0",
  "@status": "frozen",
  "$schema": "xjson://schema/core/v1"
});

export const SCXQ2_ENCODING = Object.freeze({
  mode: "SCXQ2-DICT16-B64",
  encoding: "SCXQ2-1"
});

export const CC_OPS = Object.freeze({
  NORM: "cc.norm.v1",
  DICT: "cc.dict.v1",
  FIELD: "cc.field.v1",
  LANE: "cc.lane.v1",
  EDGE: "cc.edge.v1"
});

/* =============================================================================
   Public API - Single Lane Compression
============================================================================= */

/**
 * Compresses input text into an SCXQ2 language pack.
 * Async version uses WebCrypto for universal compatibility.
 *
 * @param {string|Uint8Array} input - Source text to compress
 * @param {Object} [opts] - Compression options
 * @param {number} [opts.maxDict=1024] - Maximum dictionary entries (1-65535)
 * @param {number} [opts.minLen=3] - Minimum token length (2-128)
 * @param {boolean} [opts.noStrings] - Skip string literal tokens
 * @param {boolean} [opts.noWS] - Skip whitespace tokens
 * @param {boolean} [opts.noPunct] - Skip punctuation tokens
 * @param {boolean} [opts.enableFieldOps] - Enable JSON key extraction
 * @param {boolean} [opts.enableEdgeOps] - Enable edge witnesses
 * @param {string} [opts.created_utc] - ISO timestamp (auto-generated if omitted)
 * @param {string} [opts.source_file] - Source file identifier
 * @returns {Promise<CCResult>} Compression result with dict, block, proof, audit
 */
export async function ccCompress(input, opts = {}) {
  const o = normalizeOpts(opts);
  const src = canonicalizeInput(input, o);

  const srcSha = await sha256HexUtf8(src);
  const tokenStats = collectTokens(src, o);
  const dict = buildDict(tokenStats, o);

  const enc = encodeSCXQ2(src, dict, { enableEdgeOps: o.enableEdgeOps });
  const b64 = enc.b64;

  const dictJson = makeDictJson(dict, srcSha, o);
  dictJson.dict_sha256_canon = await sha256HexUtf8(
    canon(strip(dictJson, ["dict_sha256_canon"]))
  );

  const blockJson = makeBlockJson(
    b64,
    srcSha,
    dictJson.dict_sha256_canon,
    src,
    o,
    enc.edges
  );
  blockJson.block_sha256_canon = await sha256HexUtf8(
    canon(strip(blockJson, ["block_sha256_canon"]))
  );

  const roundtrip = ccDecompress(dictJson, blockJson);
  const rtSha = await sha256HexUtf8(roundtrip);

  const proof = makeProof(srcSha, rtSha, dictJson, blockJson, o);
  const audit = makeAudit(src, tokenStats, dictJson, blockJson, o);

  return { dict: dictJson, block: blockJson, proof, audit };
}

/**
 * Synchronous compression (Node.js only).
 * Uses Node.js crypto module for hashing.
 *
 * @param {string|Uint8Array} input - Source text to compress
 * @param {Object} [opts] - Compression options (same as ccCompress)
 * @returns {CCResult} Compression result
 */
export function ccCompressSync(input, opts = {}) {
  const node = getNodeCrypto();
  if (!node) {
    throw new Error("SCXQ2: ccCompressSync requires Node.js crypto module");
  }

  const o = normalizeOpts(opts);
  const src = canonicalizeInput(input, o);

  const srcSha = sha256HexUtf8Sync(src, node);
  const tokenStats = collectTokens(src, o);
  const dict = buildDict(tokenStats, o);

  const enc = encodeSCXQ2(src, dict, { enableEdgeOps: o.enableEdgeOps });
  const b64 = enc.b64;

  const dictJson = makeDictJson(dict, srcSha, o);
  dictJson.dict_sha256_canon = sha256HexUtf8Sync(
    canon(strip(dictJson, ["dict_sha256_canon"])),
    node
  );

  const blockJson = makeBlockJson(
    b64,
    srcSha,
    dictJson.dict_sha256_canon,
    src,
    o,
    enc.edges
  );
  blockJson.block_sha256_canon = sha256HexUtf8Sync(
    canon(strip(blockJson, ["block_sha256_canon"])),
    node
  );

  const roundtrip = ccDecompress(dictJson, blockJson);
  const rtSha = sha256HexUtf8Sync(roundtrip, node);

  const proof = makeProof(srcSha, rtSha, dictJson, blockJson, o);
  const audit = makeAudit(src, tokenStats, dictJson, blockJson, o);

  return { dict: dictJson, block: blockJson, proof, audit };
}

/* =============================================================================
   Public API - Multi-Lane Compression
============================================================================= */

/**
 * Compresses multiple lanes sharing a single dictionary.
 *
 * @param {Object} laneInput - Lane input object
 * @param {Array<{lane_id: string, text: string|Uint8Array}>} laneInput.lanes
 * @param {Object} [opts] - Compression options
 * @returns {Promise<CCLanesResult>} Multi-lane compression result
 */
export async function ccCompressLanes(laneInput, opts = {}) {
  const o = normalizeOpts(opts);
  const lanes = normalizeLanes(laneInput);

  // Build shared dictionary from all lanes
  const joined = lanes
    .map((l) => canonicalizeInput(l.text, o))
    .join("\n\n/*__LANE_BREAK__*/\n\n");
  const joinedSha = await sha256HexUtf8(joined);

  const tokenStats = collectTokens(joined, o);
  const dict = buildDict(tokenStats, o);

  const dictJson = makeDictJson(dict, joinedSha, {
    ...o,
    source_file: o.source_file ?? "lanes"
  });
  dictJson.dict_sha256_canon = await sha256HexUtf8(
    canon(strip(dictJson, ["dict_sha256_canon"]))
  );

  // Encode each lane
  const laneBlocks = [];
  for (const lane of lanes) {
    const src = canonicalizeInput(lane.text, o);
    const srcSha = await sha256HexUtf8(src);

    const enc = encodeSCXQ2(src, dict, { enableEdgeOps: o.enableEdgeOps });
    const blockJson = makeLaneBlockJson(
      lane.lane_id,
      enc.b64,
      srcSha,
      dictJson.dict_sha256_canon,
      src,
      o,
      enc.edges
    );
    blockJson.block_sha256_canon = await sha256HexUtf8(
      canon(strip(blockJson, ["block_sha256_canon"]))
    );

    // Verify roundtrip
    const rt = ccDecompress(dictJson, blockJson);
    const rtSha = await sha256HexUtf8(rt);
    if (rtSha !== srcSha) {
      throw new Error(`SCXQ2: lane roundtrip mismatch: ${lane.lane_id}`);
    }

    laneBlocks.push(blockJson);
  }

  const proof = {
    "@type": "cc.lanes.proof",
    "@version": "1.0.0",
    engine: CC_ENGINE["@id"],
    created_utc: o.created_utc,
    dict_sha256_canon: dictJson.dict_sha256_canon,
    lanes: laneBlocks.map((b) => ({
      lane_id: b.lane_id,
      source_sha256_utf8: b.source_sha256_utf8,
      block_sha256_canon: b.block_sha256_canon
    })),
    ok: true,
    steps: [
      { op: CC_OPS.LANE, lanes: laneBlocks.length },
      { op: CC_OPS.DICT, dict_entries: dictJson.dict.length }
    ]
  };

  const audit = {
    "@type": "cc.lanes.audit",
    "@version": "1.0.0",
    engine: CC_ENGINE["@id"],
    created_utc: o.created_utc,
    dict_entries: dictJson.dict.length,
    lane_count: laneBlocks.length
  };

  return { dict: dictJson, lanes: laneBlocks, proof, audit };
}

/**
 * Synchronous multi-lane compression (Node.js only).
 *
 * @param {Object} laneInput - Lane input object
 * @param {Object} [opts] - Compression options
 * @returns {CCLanesResult} Multi-lane compression result
 */
export function ccCompressLanesSync(laneInput, opts = {}) {
  const node = getNodeCrypto();
  if (!node) {
    throw new Error("SCXQ2: ccCompressLanesSync requires Node.js crypto");
  }

  const o = normalizeOpts(opts);
  const lanes = normalizeLanes(laneInput);

  const joined = lanes
    .map((l) => canonicalizeInput(l.text, o))
    .join("\n\n/*__LANE_BREAK__*/\n\n");
  const joinedSha = sha256HexUtf8Sync(joined, node);

  const tokenStats = collectTokens(joined, o);
  const dict = buildDict(tokenStats, o);

  const dictJson = makeDictJson(dict, joinedSha, {
    ...o,
    source_file: o.source_file ?? "lanes"
  });
  dictJson.dict_sha256_canon = sha256HexUtf8Sync(
    canon(strip(dictJson, ["dict_sha256_canon"])),
    node
  );

  const laneBlocks = [];
  for (const lane of lanes) {
    const src = canonicalizeInput(lane.text, o);
    const srcSha = sha256HexUtf8Sync(src, node);

    const enc = encodeSCXQ2(src, dict, { enableEdgeOps: o.enableEdgeOps });
    const blockJson = makeLaneBlockJson(
      lane.lane_id,
      enc.b64,
      srcSha,
      dictJson.dict_sha256_canon,
      src,
      o,
      enc.edges
    );
    blockJson.block_sha256_canon = sha256HexUtf8Sync(
      canon(strip(blockJson, ["block_sha256_canon"])),
      node
    );

    const rt = ccDecompress(dictJson, blockJson);
    const rtSha = sha256HexUtf8Sync(rt, node);
    if (rtSha !== srcSha) {
      throw new Error(`SCXQ2: lane roundtrip mismatch: ${lane.lane_id}`);
    }

    laneBlocks.push(blockJson);
  }

  const proof = {
    "@type": "cc.lanes.proof",
    "@version": "1.0.0",
    engine: CC_ENGINE["@id"],
    created_utc: o.created_utc,
    dict_sha256_canon: dictJson.dict_sha256_canon,
    lanes: laneBlocks.map((b) => ({
      lane_id: b.lane_id,
      source_sha256_utf8: b.source_sha256_utf8,
      block_sha256_canon: b.block_sha256_canon
    })),
    ok: true
  };

  const audit = {
    "@type": "cc.lanes.audit",
    "@version": "1.0.0",
    engine: CC_ENGINE["@id"],
    created_utc: o.created_utc,
    dict_entries: dictJson.dict.length,
    lane_count: laneBlocks.length
  };

  return { dict: dictJson, lanes: laneBlocks, proof, audit };
}

/* =============================================================================
   Public API - Decompression
============================================================================= */

/**
 * Decompresses an SCXQ2 block using its dictionary.
 *
 * @param {SCXQ2Dict} dictJson - SCXQ2 dictionary object
 * @param {SCXQ2Block} blockJson - SCXQ2 block object
 * @returns {string} Decompressed text
 */
export function ccDecompress(dictJson, blockJson) {
  verifyPack(dictJson, blockJson);

  const dict = dictJson.dict;
  const bytes = base64ToBytes(blockJson.b64);

  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];

    // Dictionary reference: 0x80 [hi] [lo]
    if (b === 0x80) {
      const idx = (bytes[++i] << 8) | bytes[++i];
      const tok = dict[idx];
      if (typeof tok !== "string") {
        throw new Error(`SCXQ2: invalid dict reference at index ${idx}`);
      }
      out += tok;
      continue;
    }

    // UTF-16 literal: 0x81 [hi] [lo]
    if (b === 0x81) {
      out += String.fromCharCode((bytes[++i] << 8) | bytes[++i]);
      continue;
    }

    // ASCII literal: byte < 128
    out += String.fromCharCode(b);
  }

  return out;
}

/* =============================================================================
   Public API - Verification
============================================================================= */

/**
 * Verifies structural validity of an SCXQ2 pack.
 *
 * @param {SCXQ2Dict} dictJson - Dictionary object
 * @param {SCXQ2Block} blockJson - Block object
 * @returns {{ok: true}} Success indicator
 * @throws {Error} On verification failure
 */
export function verifyPack(dictJson, blockJson) {
  if (!dictJson || typeof dictJson !== "object") {
    throw new Error("SCXQ2: missing dict");
  }
  if (!blockJson || typeof blockJson !== "object") {
    throw new Error("SCXQ2: missing block");
  }

  if (dictJson["@type"] !== "scxq2.dict") {
    throw new Error("SCXQ2: invalid dict @type");
  }
  if (blockJson["@type"] !== "scxq2.block") {
    throw new Error("SCXQ2: invalid block @type");
  }

  if (!Array.isArray(dictJson.dict)) {
    throw new Error("SCXQ2: dict must be array");
  }
  if (typeof blockJson.b64 !== "string") {
    throw new Error("SCXQ2: block b64 must be string");
  }

  if (dictJson.mode !== SCXQ2_ENCODING.mode) {
    throw new Error("SCXQ2: invalid dict mode");
  }
  if (blockJson.mode !== SCXQ2_ENCODING.mode) {
    throw new Error("SCXQ2: invalid block mode");
  }

  if (dictJson.encoding !== SCXQ2_ENCODING.encoding) {
    throw new Error("SCXQ2: invalid dict encoding");
  }
  if (blockJson.encoding !== SCXQ2_ENCODING.encoding) {
    throw new Error("SCXQ2: invalid block encoding");
  }

  // Verify dictionary linkage
  if (
    blockJson.dict_sha256_canon &&
    dictJson.dict_sha256_canon &&
    blockJson.dict_sha256_canon !== dictJson.dict_sha256_canon
  ) {
    throw new Error("SCXQ2: dict linkage mismatch");
  }

  return { ok: true };
}

/* =============================================================================
   Internal - Options Normalization
============================================================================= */

function normalizeOpts(opts) {
  return {
    maxDict: clamp(opts.maxDict ?? 1024, 1, 65535),
    minLen: clamp(opts.minLen ?? 3, 2, 128),
    created_utc: opts.created_utc ?? isoUtc(),
    source_file: opts.source_file ?? null,
    enableFieldOps: !!opts.enableFieldOps,
    enableEdgeOps: !!opts.enableEdgeOps,
    flags: {
      noStrings: !!opts.noStrings,
      noWS: !!opts.noWS,
      noPunct: !!opts.noPunct
    }
  };
}

function normalizeLanes(laneInput) {
  if (!laneInput || typeof laneInput !== "object") {
    throw new Error("SCXQ2: lanes input invalid");
  }
  const lanes = laneInput.lanes;
  if (!Array.isArray(lanes) || lanes.length === 0) {
    throw new Error("SCXQ2: lanes missing");
  }

  const out = [];
  for (const l of lanes) {
    const lane_id = String(l?.lane_id ?? "").trim();
    if (!lane_id) {
      throw new Error("SCXQ2: lane_id missing");
    }
    const text = l?.text;
    if (typeof text !== "string" && !(text instanceof Uint8Array)) {
      throw new Error("SCXQ2: lane text invalid");
    }
    out.push({ lane_id, text });
  }

  // Deterministic lane order
  out.sort((a, b) =>
    a.lane_id < b.lane_id ? -1 : a.lane_id > b.lane_id ? 1 : 0
  );
  return out;
}

/* =============================================================================
   Internal - Input Canonicalization (CC.NORM)
============================================================================= */

function canonicalizeInput(input, o) {
  let s;
  if (typeof input === "string") {
    s = input;
  } else if (input instanceof Uint8Array) {
    s = new TextDecoder("utf-8", { fatal: false }).decode(input);
  } else {
    throw new Error("SCXQ2: input must be string or Uint8Array");
  }

  // Normalize newlines deterministically
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return s;
}

/* =============================================================================
   Internal - Token Collection (CC.DICT + CC.FIELD)
============================================================================= */

function collectTokens(text, o) {
  const freq = new Map();

  const add = (tok) => {
    if (!tok || tok.length < o.minLen) return;
    if (tok.indexOf("\u0000") >= 0) return;
    freq.set(tok, (freq.get(tok) || 0) + 1);
  };

  // Identifiers / words
  for (const m of text.matchAll(/[A-Za-z_$][A-Za-z0-9_$]{2,}/g)) {
    add(m[0]);
  }

  // Whitespace runs
  if (!o.flags.noWS) {
    for (const m of text.matchAll(/[ \t]{2,}/g)) {
      add(m[0]);
    }
  }

  // Punctuation clusters
  if (!o.flags.noPunct) {
    for (const m of text.matchAll(/[{}()[\];,.=:+\-*/<>!&|%^]{2,}/g)) {
      add(m[0]);
    }
  }

  // String literal contents
  if (!o.flags.noStrings) {
    for (const m of text.matchAll(/"([^"\n]{3,64})"|'([^'\n]{3,64})'/g)) {
      const candidate = (m[1] || m[2] || "").trim();
      if (candidate) add(candidate);
    }
  }

  // FIELD operator: JSON keys
  if (o.enableFieldOps) {
    for (const m of text.matchAll(/"([^"\\\n]{1,64})"\s*:/g)) {
      const k = m[1];
      if (k) {
        add(k);
        add(`"${k}"`);
      }
    }
  }

  // Score by estimated savings
  const scored = [];
  for (const [tok, count] of freq.entries()) {
    if (count < 2) continue;
    const tokenBytes = estimateBytes(tok);
    const savings = (tokenBytes - 3) * count;
    if (savings > 0) {
      scored.push({ tok, count, totalSavings: savings });
    }
  }

  scored.sort(
    (a, b) =>
      b.totalSavings - a.totalSavings ||
      b.tok.length - a.tok.length ||
      (a.tok < b.tok ? -1 : 1)
  );

  return scored;
}

/* =============================================================================
   Internal - Dictionary Build
============================================================================= */

function buildDict(scored, o) {
  const dict = [];
  for (const t of scored) {
    if (dict.length >= o.maxDict) break;
    dict.push(t.tok);
  }
  // Longest-first for greedy matching
  dict.sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  return dict;
}

/* =============================================================================
   Internal - SCXQ2 Encoding
============================================================================= */

function encodeSCXQ2(text, dict, opts = {}) {
  const map = new Map(dict.map((t, i) => [t, i]));
  const bytes = [];
  const edges = opts.enableEdgeOps ? [] : null;
  let lastDictIdx = -1;

  for (let i = 0; i < text.length; ) {
    let matched = false;

    for (const tok of dict) {
      if (text.startsWith(tok, i)) {
        const idx = map.get(tok);
        bytes.push(0x80, idx >> 8, idx & 255);
        i += tok.length;
        matched = true;

        // Edge witness
        if (edges && lastDictIdx >= 0) {
          edges.push([lastDictIdx, idx]);
        }
        lastDictIdx = idx;
        break;
      }
    }

    if (!matched) {
      const c = text.charCodeAt(i++);
      if (c < 128) {
        bytes.push(c);
      } else {
        bytes.push(0x81, c >> 8, c & 255);
      }
      lastDictIdx = -1;
    }
  }

  return { bytes, b64: bytesToBase64(bytes), edges };
}

/* =============================================================================
   Internal - Utilities
============================================================================= */

function estimateBytes(s) {
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    bytes += s.charCodeAt(i) < 128 ? 1 : 3;
  }
  return bytes;
}

function utf8Bytes(s) {
  return new TextEncoder().encode(s).length;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function isoUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/* =============================================================================
   Internal - JSON Emitters
============================================================================= */

function makeDictJson(dict, srcSha, o) {
  return {
    "@type": "scxq2.dict",
    "@version": "1.0.0",
    mode: SCXQ2_ENCODING.mode,
    encoding: SCXQ2_ENCODING.encoding,
    created_utc: o.created_utc,
    source_sha256_utf8: srcSha,
    max_dict: o.maxDict,
    min_len: o.minLen,
    flags: o.flags,
    dict
  };
}

function makeBlockJson(b64, srcSha, dictSha, src, o, edges) {
  const block = {
    "@type": "scxq2.block",
    "@version": "1.0.0",
    mode: SCXQ2_ENCODING.mode,
    encoding: SCXQ2_ENCODING.encoding,
    created_utc: o.created_utc,
    source_sha256_utf8: srcSha,
    dict_sha256_canon: dictSha,
    original_bytes_utf8: utf8Bytes(src),
    b64
  };
  if (edges && edges.length > 0) {
    block.edges = edges.slice(0, 1000); // Limit edge witnesses
  }
  return block;
}

function makeLaneBlockJson(laneId, b64, srcSha, dictSha, src, o, edges) {
  const block = makeBlockJson(b64, srcSha, dictSha, src, o, edges);
  block.lane_id = laneId;
  return block;
}

function makeProof(srcSha, rtSha, dictJson, blockJson, o) {
  return {
    "@type": "cc.proof",
    "@version": "1.0.0",
    engine: CC_ENGINE["@id"],
    created_utc: o.created_utc,
    source_sha256_utf8: srcSha,
    dict_sha256_canon: dictJson.dict_sha256_canon,
    block_sha256_canon: blockJson.block_sha256_canon,
    roundtrip_sha256_utf8: rtSha,
    ok: srcSha === rtSha,
    steps: [
      { op: CC_OPS.NORM, sha: srcSha },
      { op: CC_OPS.DICT, dict_entries: dictJson.dict.length },
      { op: "scxq2.encode.v1", block_sha: blockJson.block_sha256_canon },
      { op: "scxq2.decode.v1", roundtrip_sha: rtSha }
    ]
  };
}

function makeAudit(src, tokenStats, dictJson, blockJson, o) {
  const srcBytes = utf8Bytes(src);
  const b64Bytes = utf8Bytes(blockJson.b64);

  return {
    "@type": "cc.audit",
    "@version": "1.0.0",
    engine: CC_ENGINE["@id"],
    created_utc: o.created_utc,
    sizes: {
      original_bytes_utf8: srcBytes,
      encoded_b64_bytes_utf8: b64Bytes,
      ratio: srcBytes ? Number((b64Bytes / srcBytes).toFixed(6)) : null
    },
    dict: {
      entries: dictJson.dict.length,
      max_dict: dictJson.max_dict,
      min_len: dictJson.min_len,
      flags: dictJson.flags
    },
    top_tokens: tokenStats.slice(0, 25).map((t) => ({
      tok: t.tok,
      count: t.count,
      totalSavings: t.totalSavings
    }))
  };
}
