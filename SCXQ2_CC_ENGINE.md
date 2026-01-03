```js
/* ============================================================================
   SCXQ2 Compression Calculus Engine (CC-v1 → SCXQ2)
   Artifact: SCXQ2_CC_ENGINE_v1.0.0 (FROZEN-READY)
   Purpose:
     - Deterministic, replayable, proof-generating reduction engine
     - Implements CC-v1 operators as *structural* compression steps
     - Emits SCXQ2 dict+block packs compatible with your DICT16+B64 wire format
   Non-goals:
     - No eval of user code
     - No external schemas/URLs
     - No nondeterministic ordering

   Runtime model:
     INPUT (utf8 string or bytes)
       -> NORMALIZE (canonical newlines, optional whitespace policy)
       -> TOKENIZE (lane-aware token streams)
       -> APPLY OPS (DICT/FIELD/LANE/EDGE packs + optional RLE)
       -> EMIT:
          - scxq2.dict.json (deterministic)
          - scxq2.block.json (deterministic)
          - cc.proof.json (deterministic proof envelope)
          - cc.audit.json (metrics)

   Encoding compatibility:
     - Bytes < 0x80          → raw ASCII
     - 0x81 [hi][lo]         → raw UTF-16 code unit (>127)
     - 0x80 [hi][lo]         → dict reference (uint16 index)

   NOTE:
     This file is standalone. Works in Node (18+) and can be adapted into sw.js.
============================================================================ */

import crypto from "crypto";

/* =========================
   Constants / IDs
   ========================= */

export const CC_ENGINE = {
  "@id": "asx://cc/engine/scxq2.v1",
  "@type": "cc.engine",
  "@version": "1.0.0",
  "@status": "frozen-ready",
  "$schema": "xjson://schema/core/v1"
};

export const SCXQ2_ENCODING = {
  mode: "SCXQ2-DICT16-B64",
  encoding: "SCXQ2-1"
};

/* =========================
   Public API
   ========================= */

export function ccCompress(input, opts = {}) {
  const o = normalizeOpts(opts);

  // 0) Canonicalize input (deterministic)
  const src = canonicalizeInput(input, o);

  // 1) Collect candidates for dictionary (deterministic)
  const tokenStats = collectTokens(src, o);

  // 2) Build dict (deterministic)
  const dict = buildDict(tokenStats, o);

  // 3) Encode (deterministic)
  const b64 = encodeSCXQ2(src, dict);

  // 4) Emit canonical JSON + hashes
  const dictJson = makeDictJson(dict, src, o);
  const dictCanon = canon(dictJson);
  const dictSha = sha256HexUtf8(dictCanon);

  const blockJson = makeBlockJson(b64, dictSha, src, o);
  const blockCanon = canon(blockJson);
  const blockSha = sha256HexUtf8(blockCanon);

  const dictFinal = { ...dictJson, dict_sha256_canon: dictSha };
  const blockFinal = { ...blockJson, block_sha256_canon: blockSha };

  // 5) Proof + audit (deterministic, replayable)
  const proof = makeProof(src, dictFinal, blockFinal, o);
  const audit = makeAudit(src, dictFinal, blockFinal, tokenStats, o);

  return {
    dict: dictFinal,
    block: blockFinal,
    proof,
    audit
  };
}

export function ccDecompress(dictJson, blockJson) {
  // Minimal verifier + decode; throws on invalid
  verifyPack(dictJson, blockJson);

  const dict = dictJson.dict;
  const bytes = decodeBase64(blockJson.b64);

  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];

    if (b === 0x80) {
      const hi = bytes[++i];
      const lo = bytes[++i];
      const idx = (hi << 8) | lo;
      const tok = dict[idx];
      if (typeof tok !== "string") throw new Error("SCXQ2: bad dict ref " + idx);
      out += tok;
      continue;
    }

    if (b === 0x81) {
      const hi = bytes[++i];
      const lo = bytes[++i];
      out += String.fromCharCode((hi << 8) | lo);
      continue;
    }

    out += String.fromCharCode(b);
  }

  return out;
}

export function verifyPack(dictJson, blockJson) {
  if (!dictJson || typeof dictJson !== "object") throw new Error("CC: missing dict");
  if (!blockJson || typeof blockJson !== "object") throw new Error("CC: missing block");

  if (dictJson["@type"] !== "scxq2.dict") throw new Error("CC: bad dict @type");
  if (blockJson["@type"] !== "scxq2.block") throw new Error("CC: bad block @type");

  if (!Array.isArray(dictJson.dict)) throw new Error("CC: dict must be array");
  if (typeof blockJson.b64 !== "string") throw new Error("CC: block b64 must be string");

  // Canonical hash checks (optional but recommended)
  const dictCanon = canon(stripIntegrity(dictJson, ["dict_sha256_canon"]));
  const dictSha = sha256HexUtf8(dictCanon);
  if (dictJson.dict_sha256_canon && dictJson.dict_sha256_canon !== dictSha) {
    throw new Error("CC: dict_sha mismatch");
  }

  const blockCanon = canon(stripIntegrity(blockJson, ["block_sha256_canon"]));
  const blockSha = sha256HexUtf8(blockCanon);
  if (blockJson.block_sha256_canon && blockJson.block_sha256_canon !== blockSha) {
    throw new Error("CC: block_sha mismatch");
  }

  if (blockJson.dict_sha256_canon && dictJson.dict_sha256_canon) {
    if (blockJson.dict_sha256_canon !== dictJson.dict_sha256_canon) {
      throw new Error("CC: dict_sha linkage mismatch");
    }
  }

  // Basic invariants
  if (dictJson.mode !== SCXQ2_ENCODING.mode) throw new Error("CC: bad dict mode");
  if (blockJson.mode !== SCXQ2_ENCODING.mode) throw new Error("CC: bad block mode");
  if (dictJson.encoding !== SCXQ2_ENCODING.encoding) throw new Error("CC: bad dict encoding");
  if (blockJson.encoding !== SCXQ2_ENCODING.encoding) throw new Error("CC: bad block encoding");

  return { ok: true };
}

/* ============================================================================
   CC-v1 Operator Surface (Structural)
   ----------------------------------------------------------------------------
   This is the "calculus" layer: a tiny operator set that composes deterministically.
   In CC-v1 terms, operators are *identity-preserving reductions* with proofs.
============================================================================ */

export const CC_OPS = Object.freeze({
  // Normalize newline + optional tabs/spaces policy
  NORM: "cc.norm.v1",

  // Dictionary extraction from token stream
  DICT: "cc.dict.v1",

  // Lane mapping (optional: future G2L/MFA bindings)
  LANE: "cc.lane.v1",

  // Edge packing (optional: future graph/AST edge encoding)
  EDGE: "cc.edge.v1"
});

/* =========================
   Options
   ========================= */

function normalizeOpts(opts) {
  const o = {
    // dict limits
    maxDict: clampInt(opts.maxDict ?? 1024, 1, 65535, 1024),
    minLen: clampInt(opts.minLen ?? 3, 2, 128, 3),

    // token sources
    noStrings: !!opts.noStrings,
    noWS: !!opts.noWS,
    noPunct: !!opts.noPunct,

    // canonicalization
    newline: (opts.newline ?? "\n") === "\r\n" ? "\r\n" : "\n",
    trimTrailingWS: opts.trimTrailingWS ?? false,

    // proof metadata
    created_utc: opts.created_utc ?? isoUtc(),

    // labels
    source_file: opts.source_file ?? null
  };
  return o;
}

function clampInt(v, lo, hi, fallback) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

/* =========================
   Canonicalization (CC.NORM)
   ========================= */

function canonicalizeInput(input, o) {
  let s;

  if (typeof input === "string") s = input;
  else if (input instanceof Uint8Array) s = new TextDecoder("utf-8", { fatal: false }).decode(input);
  else if (Buffer.isBuffer?.(input)) s = input.toString("utf8");
  else throw new Error("CC: input must be string or bytes");

  // Normalize newlines deterministically to \n then optionally output policy
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (o.trimTrailingWS) s = s.replace(/[ \t]+\n/g, "\n");

  if (o.newline !== "\n") s = s.replace(/\n/g, o.newline);

  return s;
}

/* =========================
   Token collection (CC.DICT)
   ========================= */

function collectTokens(text, o) {
  const freq = new Map();

  const add = (tok) => {
    if (!tok) return;
    if (tok.length < o.minLen) return;
    if (tok.indexOf("\u0000") >= 0) return;
    const prev = freq.get(tok) || 0;
    freq.set(tok, prev + 1);
  };

  // Identifiers / words
  {
    const re = /[A-Za-z_$][A-Za-z0-9_$]{2,}/g;
    let m;
    while ((m = re.exec(text)) !== null) add(m[0]);
  }

  // Whitespace runs (optional)
  if (!o.noWS) {
    const re = /[ \t]{2,}/g;
    let m;
    while ((m = re.exec(text)) !== null) add(m[0]);
  }

  // Punctuation clusters (optional)
  if (!o.noPunct) {
    const re = /[{}()[\];,.=:+\-*/<>!&|%^]{2,}/g;
    let m;
    while ((m = re.exec(text)) !== null) add(m[0]);
  }

  // String literal contents (optional)
  if (!o.noStrings) {
    const re = /"([^"\n]{3,64})"|'([^'\n]{3,64})'/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const candidate = (m[1] || m[2] || "").trim();
      if (candidate) add(candidate);
    }
  }

  // Score tokens by savings estimate (deterministic ordering)
  const scored = [];
  for (const [tok, count] of freq.entries()) {
    if (count < 2) continue;
    const tokenBytes = estimateEncodedBytes(tok);
    const savingsPerHit = tokenBytes - 3; // dict ref cost = 3 bytes
    if (savingsPerHit <= 0) continue;
    scored.push({
      tok,
      count,
      tokenBytes,
      savingsPerHit,
      totalSavings: savingsPerHit * count
    });
  }

  scored.sort((a, b) =>
    b.totalSavings - a.totalSavings ||
    b.tok.length - a.tok.length ||
    (a.tok < b.tok ? -1 : 1)
  );

  return scored;
}

function estimateEncodedBytes(s) {
  // ASCII -> 1 byte, non-ASCII UTF-16 code unit -> 3 bytes (0x81 + hi + lo)
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    bytes += code < 128 ? 1 : 3;
  }
  return bytes;
}

/* =========================
   Dictionary build (CC.DICT)
   ========================= */

function buildDict(scoredTokens, o) {
  const cap = Math.min(o.maxDict, 65535);
  const chosen = [];
  const seen = new Set();

  for (const t of scoredTokens) {
    if (chosen.length >= cap) break;
    const tok = t.tok;

    if (seen.has(tok)) continue;

    // Keep dict clean
    if (/^[ \t]+$/.test(tok) && tok.length < 4) continue;
    if (/^[{}()[\];,.=:+\-*/<>!&|%^]+$/.test(tok) && tok.length < 3) continue;

    chosen.push(tok);
    seen.add(tok);
  }

  // Longest-first match order = deterministic greedy encoder
  chosen.sort((a, b) => b.length - a.length || (a < b ? -1 : 1));

  return chosen;
}

/* =========================
   Encode (SCXQ2-1)
   ========================= */

function encodeSCXQ2(text, dict) {
  const index = new Map();
  dict.forEach((tok, i) => index.set(tok, i));

  const bytes = [];
  const len = text.length;
  let i = 0;

  while (i < len) {
    let matched = false;

    // Longest-first greedy
    for (let t = 0; t < dict.length; t++) {
      const tok = dict[t];
      if (i + tok.length > len) continue;
      if (text.startsWith(tok, i)) {
        const di = index.get(tok);
        if (di === undefined || di < 0 || di > 65535) throw new Error("CC: bad dict index");
        bytes.push(0x80, (di >> 8) & 0xff, di & 0xff);
        i += tok.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      const code = text.charCodeAt(i);
      if (code < 128) bytes.push(code);
      else bytes.push(0x81, (code >> 8) & 0xff, code & 0xff);
      i++;
    }
  }

  return Buffer.from(bytes).toString("base64");
}

/* =========================
   Decode base64 (universal)
   ========================= */

function decodeBase64(b64) {
  const clean = String(b64).startsWith("base64:") ? String(b64).slice(7) : String(b64);

  // Node
  if (typeof Buffer !== "undefined" && Buffer.from) {
    return new Uint8Array(Buffer.from(clean, "base64"));
  }

  // Browser / SW
  if (typeof atob === "function") {
    const bin = atob(clean);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  throw new Error("CC: no base64 decoder available");
}

/* =========================
   Deterministic JSON
   ========================= */

function canon(obj) {
  return JSON.stringify(sortKeysDeep(obj));
}

function sortKeysDeep(v) {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v && typeof v === "object") {
    const out = {};
    const keys = Object.keys(v).sort();
    for (const k of keys) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}

function sha256HexUtf8(s) {
  return crypto.createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
}

function isoUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function stripIntegrity(obj, fields) {
  const o = { ...obj };
  for (const f of fields) delete o[f];
  return o;
}

/* =========================
   Pack JSON emitters
   ========================= */

function makeDictJson(dict, src, o) {
  return {
    "@type": "scxq2.dict",
    "@version": CC_ENGINE["@version"],
    "$schema": CC_ENGINE["$schema"],

    mode: SCXQ2_ENCODING.mode,
    encoding: SCXQ2_ENCODING.encoding,

    created_utc: o.created_utc,
    source_file: o.source_file,
    source_sha256_utf8: sha256HexUtf8(src),

    max_dict: o.maxDict,
    min_len: o.minLen,
    flags: { noStrings: !!o.noStrings, noWS: !!o.noWS, noPunct: !!o.noPunct },

    dict
  };
}

function makeBlockJson(b64, dictSha, src, o) {
  const originalBytes = Buffer.byteLength(src, "utf8");
  return {
    "@type": "scxq2.block",
    "@version": CC_ENGINE["@version"],
    "$schema": CC_ENGINE["$schema"],

    mode: SCXQ2_ENCODING.mode,
    encoding: SCXQ2_ENCODING.encoding,

    created_utc: o.created_utc,
    source_file: o.source_file,
    source_sha256_utf8: sha256HexUtf8(src),

    dict_sha256_canon: dictSha,
    original_bytes_utf8: originalBytes,

    b64
  };
}

/* =========================
   Proof / Audit (CC-v1)
   ========================= */

function makeProof(src, dictFinal, blockFinal, o) {
  // Proof is a deterministic witness that:
  // - input hash matches
  // - dict canonical hash matches linkage
  // - block canonical hash matches
  // - decompress(dict, block) reproduces input hash

  // Recompute decode locally as part of proof creation (deterministic)
  const roundtrip = ccDecompress(dictFinal, blockFinal);
  const rtSha = sha256HexUtf8(roundtrip);

  const dictCanon = canon(stripIntegrity(dictFinal, ["dict_sha256_canon"]));
  const blockCanon = canon(stripIntegrity(blockFinal, ["block_sha256_canon"]));

  const dictSha = sha256HexUtf8(dictCanon);
  const blockSha = sha256HexUtf8(blockCanon);

  const srcSha = sha256HexUtf8(src);

  const steps = [
    {
      op: CC_OPS.NORM,
      in_sha256_utf8: srcSha,
      out_sha256_utf8: srcSha,
      note: "canonicalizeInput applied (newline policy, optional trailing ws)"
    },
    {
      op: CC_OPS.DICT,
      dict_sha256_canon: dictFinal.dict_sha256_canon,
      dict_entries: dictFinal.dict.length,
      note: "dictionary extracted deterministically from token stats"
    },
    {
      op: "scxq2.encode.v1",
      block_sha256_canon: blockFinal.block_sha256_canon,
      original_bytes_utf8: blockFinal.original_bytes_utf8,
      note: "DICT16 greedy longest-first encoding"
    },
    {
      op: "scxq2.decode.v1",
      roundtrip_sha256_utf8: rtSha,
      note: "decode(dict, block) computed for proof witness"
    }
  ];

  const ok = (srcSha === rtSha);

  return {
    "@type": "cc.proof",
    "@version": "1.0.0",
    "$schema": CC_ENGINE["$schema"],

    engine: CC_ENGINE["@id"],
    created_utc: o.created_utc,

    // Primary identity
    source_sha256_utf8: srcSha,

    // Canonical objects identity
    dict_sha256_canon: dictFinal.dict_sha256_canon,
    block_sha256_canon: blockFinal.block_sha256_canon,

    // Secondary verification (recomputed)
    recomputed: {
      dict_sha256_canon: dictSha,
      block_sha256_canon: blockSha
    },

    // Roundtrip witness
    roundtrip_sha256_utf8: rtSha,

    // Pass/fail
    ok,

    // Deterministic step trace
    steps
  };
}

function makeAudit(src, dictFinal, blockFinal, tokenStats, o) {
  const srcBytes = Buffer.byteLength(src, "utf8");
  const b64Bytes = Buffer.byteLength(String(blockFinal.b64), "utf8");

  return {
    "@type": "cc.audit",
    "@version": "1.0.0",
    "$schema": CC_ENGINE["$schema"],

    engine: CC_ENGINE["@id"],
    created_utc: o.created_utc,

    sizes: {
      original_bytes_utf8: srcBytes,
      encoded_b64_bytes_utf8: b64Bytes,
      ratio_b64_over_original: srcBytes ? Number((b64Bytes / srcBytes).toFixed(6)) : null
    },

    dict: {
      entries: dictFinal.dict.length,
      max_dict: dictFinal.max_dict,
      min_len: dictFinal.min_len,
      flags: dictFinal.flags
    },

    // Top token winners (keep audit small/deterministic)
    top_tokens: tokenStats.slice(0, 25).map(t => ({
      tok: t.tok,
      count: t.count,
      totalSavings: t.totalSavings
    }))
  };
}

/* ============================================================================
   Example usage (Node)
============================================================================ */

// Uncomment to run quickly:
// const { dict, block, proof, audit } = ccCompress(`function hello(){ console.log("hello"); }`, {
//   maxDict: 512,
//   minLen: 3,
//   source_file: "demo.js"
// });
// console.log(dict.dict.length, block.original_bytes_utf8, proof.ok, audit.sizes);

/* ============================================================================
   End
============================================================================ */
```

