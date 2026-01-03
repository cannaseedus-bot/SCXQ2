/**
 * SCXQ2 Fuzz Tests
 *
 * Tests decoder and verifier against adversarial and random inputs.
 * Uses Node.js built-in test runner (node:test).
 *
 * Run: node --test test/fuzz_decode.test.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { scxq2DecodeUtf16, scxq2PackVerify, SCXQ2_DEFAULT_POLICY, canon } from "../dist/verify.js";

/* =============================================================================
   Test Utilities
============================================================================= */

function randInt(n) {
  return crypto.randomInt(0, n);
}

function randAsciiString(maxLen = 2000) {
  const len = randInt(maxLen + 1);
  let s = "";
  for (let i = 0; i < len; i++) {
    s += String.fromCharCode(randInt(128));
  }
  return s;
}

function makeRandomBytes(maxLen = 4096) {
  const len = randInt(maxLen + 1);
  return crypto.randomBytes(len);
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
}

/* =============================================================================
   Decoder Fuzz Tests
============================================================================= */

test("SCXQ2 decode: never throws on random bytes (fails closed)", () => {
  const dict = ["a", "test", "hello", "world", "SCXQ2", "::::", " { } ", "\n"];

  for (let i = 0; i < 2000; i++) {
    const bytes = makeRandomBytes(2048);
    assert.doesNotThrow(() => {
      const r = scxq2DecodeUtf16(dict, bytes, { maxOutputUnits: 1 << 20 });
      assert.ok(typeof r.ok === "boolean");
      if (!r.ok) {
        assert.ok(typeof r.kind === "string");
      } else {
        assert.ok(typeof r.value === "string");
      }
    });
  }
});

test("SCXQ2 decode: handles empty input", () => {
  const dict = ["test"];
  const r = scxq2DecodeUtf16(dict, Buffer.from([]), { maxOutputUnits: 1000 });
  assert.equal(r.ok, true);
  assert.equal(r.value, "");
});

test("SCXQ2 decode: handles empty dictionary", () => {
  const dict = [];
  // Just ASCII bytes
  const bytes = Buffer.from([0x41, 0x42, 0x43]); // "ABC"
  const r = scxq2DecodeUtf16(dict, bytes, { maxOutputUnits: 1000 });
  assert.equal(r.ok, true);
  assert.equal(r.value, "ABC");
});

test("SCXQ2 decode: rejects invalid byte (0x82-0xFF standalone)", () => {
  const dict = ["test"];
  const bytes = Buffer.from([0x82]); // Invalid marker
  const r = scxq2DecodeUtf16(dict, bytes, { maxOutputUnits: 1000 });
  assert.equal(r.ok, false);
  assert.equal(r.kind, "invalid_byte");
});

test("SCXQ2 decode: rejects truncated dict reference", () => {
  const dict = ["test"];
  const bytes = Buffer.from([0x80, 0x00]); // Missing third byte
  const r = scxq2DecodeUtf16(dict, bytes, { maxOutputUnits: 1000 });
  assert.equal(r.ok, false);
  assert.equal(r.kind, "truncated_sequence");
});

test("SCXQ2 decode: rejects truncated UTF-16 literal", () => {
  const dict = [];
  const bytes = Buffer.from([0x81, 0x00]); // Missing third byte
  const r = scxq2DecodeUtf16(dict, bytes, { maxOutputUnits: 1000 });
  assert.equal(r.ok, false);
  assert.equal(r.kind, "truncated_sequence");
});

test("SCXQ2 decode: rejects out-of-bounds dict index", () => {
  const dict = ["only"];
  const bytes = Buffer.from([0x80, 0x00, 0x05]); // Index 5, but dict has 1 entry
  const r = scxq2DecodeUtf16(dict, bytes, { maxOutputUnits: 1000 });
  assert.equal(r.ok, false);
  assert.equal(r.kind, "dict_index_oob");
});

test("SCXQ2 decode: output limit triggers correctly", () => {
  const dict = ["A".repeat(1000)];
  // Three dict refs -> 3000 chars output
  const bytes = Buffer.from([
    0x80, 0x00, 0x00,
    0x80, 0x00, 0x00,
    0x80, 0x00, 0x00
  ]);
  const r = scxq2DecodeUtf16(dict, bytes, { maxOutputUnits: 1500 });
  assert.equal(r.ok, false);
  assert.equal(r.kind, "output_limit");
});

test("SCXQ2 decode: valid mixed encoding roundtrip", () => {
  const dict = ["hello", "world"];
  // "hello" (dict 0) + " " (ascii 32) + "world" (dict 1)
  const bytes = Buffer.from([
    0x80, 0x00, 0x00, // dict[0] = "hello"
    0x20,             // space
    0x80, 0x00, 0x01  // dict[1] = "world"
  ]);
  const r = scxq2DecodeUtf16(dict, bytes, { maxOutputUnits: 1000 });
  assert.equal(r.ok, true);
  assert.equal(r.value, "hello world");
});

test("SCXQ2 decode: UTF-16 literal encoding", () => {
  const dict = [];
  // Encode "é" (U+00E9) as UTF-16 literal
  const bytes = Buffer.from([0x81, 0x00, 0xe9]);
  const r = scxq2DecodeUtf16(dict, bytes, { maxOutputUnits: 1000 });
  assert.equal(r.ok, true);
  assert.equal(r.value, "é");
});

/* =============================================================================
   Verifier Fuzz Tests
============================================================================= */

test("Verifier: rejects null pack", () => {
  const res = scxq2PackVerify(null);
  assert.equal(res.ok, false);
  assert.equal(res.error.code, "scxq2.error.pack_missing");
});

test("Verifier: rejects wrong @type", () => {
  const pack = { "@type": "wrong", "@version": "1.0.0" };
  const res = scxq2PackVerify(pack);
  assert.equal(res.ok, false);
  assert.equal(res.error.code, "scxq2.error.pack_type_invalid");
});

test("Verifier: rejects unsupported version", () => {
  const pack = { "@type": "scxq2.pack", "@version": "2.0.0" };
  const res = scxq2PackVerify(pack);
  assert.equal(res.ok, false);
  assert.equal(res.error.code, "scxq2.error.pack_version_unsupported");
});

test("Verifier: rejects mutated pack_sha256_canon", () => {
  // Minimal fake pack (structure valid but hashes wrong)
  const pack = {
    "@type": "scxq2.pack",
    "@version": "1.0.0",
    mode: "SCXQ2-DICT16-B64",
    encoding: "SCXQ2-1",
    created_utc: "2026-01-03T00:00:00Z",
    dict: {
      "@type": "scxq2.dict",
      "@version": "1.0.0",
      mode: "SCXQ2-DICT16-B64",
      encoding: "SCXQ2-1",
      source_sha256_utf8: "00",
      dict: ["a"],
      dict_sha256_canon: "00"
    },
    blocks: [{
      "@type": "scxq2.block",
      "@version": "1.0.0",
      mode: "SCXQ2-DICT16-B64",
      encoding: "SCXQ2-1",
      lane_id: "x",
      source_sha256_utf8: "00",
      dict_sha256_canon: "00",
      b64: Buffer.from([0]).toString("base64"),
      block_sha256_canon: "00"
    }],
    proof: {
      "@type": "cc.proof",
      "@version": "1.0.0",
      engine: "asx://cc/engine/scxq2.v1",
      source_sha256_utf8: "00",
      dict_sha256_canon: "00",
      block_sha256_canon: "00",
      roundtrip_sha256_utf8: "00",
      ok: true
    },
    pack_sha256_canon: "deadbeef"
  };

  const res = scxq2PackVerify(pack, { ...SCXQ2_DEFAULT_POLICY, requireRoundtrip: false });
  assert.equal(res.ok, false);
  assert.equal(res.error.code, "scxq2.error.pack_sha_mismatch");
});

test("Verifier: rejects missing dict", () => {
  const pack = {
    "@type": "scxq2.pack",
    "@version": "1.0.0",
    mode: "SCXQ2-DICT16-B64",
    encoding: "SCXQ2-1"
  };
  const res = scxq2PackVerify(pack);
  assert.equal(res.ok, false);
  assert.equal(res.error.code, "scxq2.error.dict_missing");
});

test("Verifier: rejects missing blocks", () => {
  const pack = {
    "@type": "scxq2.pack",
    "@version": "1.0.0",
    mode: "SCXQ2-DICT16-B64",
    encoding: "SCXQ2-1",
    dict: {
      "@type": "scxq2.dict",
      "@version": "1.0.0",
      mode: "SCXQ2-DICT16-B64",
      encoding: "SCXQ2-1",
      dict: [],
      dict_sha256_canon: "test"
    }
  };
  const res = scxq2PackVerify(pack);
  assert.equal(res.ok, false);
  assert.equal(res.error.code, "scxq2.error.pack_blocks_missing");
});

test("Verifier: rejects dict size exceeding limit", () => {
  const bigDict = Array(65536).fill("x"); // One more than max
  const pack = {
    "@type": "scxq2.pack",
    "@version": "1.0.0",
    mode: "SCXQ2-DICT16-B64",
    encoding: "SCXQ2-1",
    dict: {
      "@type": "scxq2.dict",
      "@version": "1.0.0",
      mode: "SCXQ2-DICT16-B64",
      encoding: "SCXQ2-1",
      dict: bigDict,
      dict_sha256_canon: "test"
    },
    blocks: [{
      "@type": "scxq2.block",
      "@version": "1.0.0",
      mode: "SCXQ2-DICT16-B64",
      encoding: "SCXQ2-1",
      b64: "AA==",
      dict_sha256_canon: "test",
      block_sha256_canon: "test"
    }]
  };
  const res = scxq2PackVerify(pack);
  assert.equal(res.ok, false);
  assert.equal(res.error.code, "scxq2.error.dict_size_exceeds_limit");
});

/* =============================================================================
   Policy Tests
============================================================================= */

test("Verifier: respects allowEdges=false policy", () => {
  const pack = {
    "@type": "scxq2.pack",
    "@version": "1.0.0",
    mode: "SCXQ2-DICT16-B64",
    encoding: "SCXQ2-1",
    dict: {
      "@type": "scxq2.dict",
      "@version": "1.0.0",
      mode: "SCXQ2-DICT16-B64",
      encoding: "SCXQ2-1",
      dict: [],
      dict_sha256_canon: "test"
    },
    blocks: [{
      "@type": "scxq2.block",
      "@version": "1.0.0",
      mode: "SCXQ2-DICT16-B64",
      encoding: "SCXQ2-1",
      b64: "AA==",
      dict_sha256_canon: "test",
      block_sha256_canon: "test",
      edges: [[0, 1]]
    }],
    proof: { "@type": "cc.proof", "@version": "1.0.0", ok: true },
    pack_sha256_canon: "test"
  };

  const res = scxq2PackVerify(pack, { ...SCXQ2_DEFAULT_POLICY, allowEdges: false });
  assert.equal(res.ok, false);
  assert.equal(res.error.code, "scxq2.error.policy_disabled_feature");
});

/* =============================================================================
   Canonical JSON Tests
============================================================================= */

test("canon: produces deterministic output", () => {
  const obj1 = { b: 2, a: 1, c: { z: 26, y: 25 } };
  const obj2 = { c: { y: 25, z: 26 }, a: 1, b: 2 };

  assert.equal(canon(obj1), canon(obj2));
  assert.equal(canon(obj1), '{"a":1,"b":2,"c":{"y":25,"z":26}}');
});

test("canon: handles arrays correctly", () => {
  const obj = { arr: [3, 1, 2], b: "test" };
  assert.equal(canon(obj), '{"arr":[3,1,2],"b":"test"}');
});

console.log("All fuzz tests defined. Run with: node --test test/fuzz_decode.test.mjs");
