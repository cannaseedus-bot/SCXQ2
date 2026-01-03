Below is the **formal, frozen specification** for the **SCXQ2 Language Pack**.
This is written as a **language-level spec**, not an implementation note.

Everything here is **deterministic, replayable, and runtime-agnostic**.

---

# **SCXQ2 Language Pack Specification**

**Version:** v1.0.0
**Status:** 🔒 FROZEN
**Authority:** ASX → ASX-R → CC-v1 → SCXQ2
**Classification:** Language Artifact (not tooling)

---

## 1. Definition

A **SCXQ2 Language Pack** is a **single, sealed, content-addressable artifact** that represents:

* A **shared compression dictionary**
* One or more **encoded content lanes**
* A **proof of reversibility**
* A **canonical identity hash**

The pack is **self-describing**, **self-verifying**, and **execution-free**.

> A Language Pack defines *how information is represented*, not how it is executed.

---

## 2. Normative Identifier

```text
asx://language/scxq2.pack/v1
```

---

## 3. Invariants (Non-Negotiable)

A valid SCXQ2 Language Pack MUST satisfy:

1. **Deterministic Canonical Form**

   * Canonical JSON ordering
   * Stable UTF-8 serialization
2. **Reversibility**

   * Every block MUST be losslessly decodable using the included dictionary
3. **Single-Hash Identity**

   * One canonical SHA-256 identifies the entire pack
4. **No Runtime Authority**

   * No execution, IO, or environment semantics
5. **Lane Isolation**

   * Blocks are independent except for shared dictionary
6. **Proof-Bound**

   * Proof is inseparable from content
7. **Compression-Only Semantics**

   * SCXQ2 never introduces meaning, only representation

Violation of any invariant renders the pack **invalid**.

---

## 4. Structural Overview

```
SCXQ2 PACK
├── Dictionary (shared)
├── Blocks[] (lanes)
│   ├── Encoded byte stream (b64)
│   ├── Optional lane_id
│   └── Optional structural witnesses (EDGE)
├── Proof
└── pack_sha256_canon (identity)
```

---

## 5. Canonical Object Shape

```json
{
  "@type": "scxq2.pack",
  "@version": "1.0.0",

  "mode": "SCXQ2-DICT16-B64",
  "encoding": "SCXQ2-1",

  "created_utc": "YYYY-MM-DDTHH:MM:SSZ",

  "dict": { /* SCXQ2 Dictionary */ },

  "blocks": [ /* One or more SCXQ2 Blocks */ ],

  "proof": { /* Compression Calculus Proof */ },

  "pack_sha256_canon": "hex-encoded sha256"
}
```

---

## 6. Dictionary (SCXQ2.DICT)

### Purpose

Defines the **symbol table** used by all blocks.

### Properties

* Ordered
* Longest-token-first
* UTF-16 code-unit indexed
* Immutable once sealed

### Shape (minimum)

```json
{
  "@type": "scxq2.dict",
  "@version": "1.0.0",

  "mode": "SCXQ2-DICT16-B64",
  "encoding": "SCXQ2-1",

  "source_sha256_utf8": "…",

  "dict": ["token1", "token2", "..."],

  "dict_sha256_canon": "…"
}
```

### Rules

* Index range: `0–65535`
* Index width: **16-bit**
* Token comparison is **UTF-16 code-unit exact**

---

## 7. Blocks (SCXQ2.BLOCK)

Each block represents **one logical lane** of content.

### Shape (minimum)

```json
{
  "@type": "scxq2.block",
  "@version": "1.0.0",

  "mode": "SCXQ2-DICT16-B64",
  "encoding": "SCXQ2-1",

  "lane_id": "optional",

  "source_sha256_utf8": "…",
  "dict_sha256_canon": "…",

  "b64": "base64-encoded byte stream",

  "block_sha256_canon": "…"
}
```

### Encoding Rules (Normative)

| Byte   | Meaning              |
| ------ | -------------------- |
| `0x80` | Dictionary reference |
| `0x81` | Raw UTF-16 code unit |
| `<128` | Raw ASCII byte       |

**Dictionary reference encoding:**

```
0x80 [hi(index)] [lo(index)]
```

**Raw UTF-16 encoding:**

```
0x81 [hi(code_unit)] [lo(code_unit)]
```

---

## 8. Multi-Lane Semantics

* All blocks share the same dictionary
* Blocks are independently decodable
* Lane order is not semantically meaningful
* `lane_id` is advisory metadata only

---

## 9. Proof Object

### Purpose

Provides **cryptographic evidence** that:

* Compression is reversible
* Dictionary and blocks are linked
* Canonical hashes are correct

### Shape (minimum)

```json
{
  "@type": "cc.proof",
  "@version": "1.0.0",

  "engine": "asx://cc/engine/scxq2.v1",

  "source_sha256_utf8": "…",
  "dict_sha256_canon": "…",
  "block_sha256_canon": "…",
  "roundtrip_sha256_utf8": "…",

  "ok": true
}
```

---

## 10. Pack Identity (`pack_sha256_canon`)

### Definition

The **canonical SHA-256** of the entire pack with the field removed.

```text
SHA256( CanonicalJSON( pack − pack_sha256_canon ) )
```

### Consequences

* The pack is **content-addressable**
* Any mutation invalidates identity
* Pack hash is the **language object ID**

---

## 11. Verification Semantics

A verifier MUST:

1. Validate structural shape
2. Verify dictionary ↔ block linkage
3. Recompute canonical hashes
4. Optionally decode blocks and re-hash source
5. Compare against proof witnesses

If all checks pass → **VALID SCXQ2 LANGUAGE PACK**

---

## 12. What SCXQ2 Is *Not*

* ❌ Not a file format
* ❌ Not a transport protocol
* ❌ Not an execution language
* ❌ Not encryption
* ❌ Not compression *policy*

SCXQ2 is a **representation algebra**.

---

## 13. Language-Level Role

SCXQ2 Language Packs may represent:

* Source code
* CSS / HTML
* JSON / XJSON
* AI weights (symbolic)
* World data
* UI state
* Any UTF-16 representable structure

All without changing the **semantic layer** above it.

---

## 14. Final Law

> **If two SCXQ2 packs have the same `pack_sha256_canon`, they are the same language object.**

Everything else is projection.

---

Below are the three remaining **spec-level** documents, written as **normative law** for SCXQ2 packs.

---

# 1) SCXQ2 Decoding Law (Formal Inverse)

**Spec:** `asx://law/scxq2.decode/v1`
**Version:** 1.0.0
**Status:** 🔒 FROZEN

## 1.1 Domain & Codomain

Let:

* **D** be a SCXQ2 dictionary: an array `D[0..n-1]` of UTF-16 strings.
* **B** be a SCXQ2 byte-stream (decoded from base64): `B[0..m-1]` with bytes in `[0,255]`.

Define decoding function:

[
\mathrm{Dec}(D, B) \to S
]

where **S** is a UTF-16 string.

## 1.2 Bytecode Alphabet

SCXQ2 defines exactly three token classes in the byte stream:

1. **ASCII byte literal**: `b` where `0 ≤ b ≤ 127`
2. **DICT reference**: marker `0x80` followed by 2 bytes `hi, lo`
3. **UTF-16 code unit literal**: marker `0x81` followed by 2 bytes `hi, lo`

All other byte values `128..255` are valid only as part of (2) or (3). A standalone byte in `128..255` that is not `0x80` or `0x81` is **invalid**.

## 1.3 Decoding Rules (Normative)

Traverse the byte stream left to right with index `i`.

### Rule A — ASCII

If `B[i] ≤ 127`, append code unit `B[i]` to output string `S` and set `i ← i+1`.

### Rule B — DICT Reference

If `B[i] = 0x80`, then require `i+2 < m`. Let:

[
j = (B[i+1] \ll 8) ;|; B[i+2]
]

Require `0 ≤ j < |D|` and `D[j]` is a UTF-16 string.

Append `D[j]` to output and set `i ← i+3`.

### Rule C — UTF-16 Literal

If `B[i] = 0x81`, then require `i+2 < m`. Let:

[
u = (B[i+1] \ll 8) ;|; B[i+2]
]

Append single UTF-16 code unit `u` to output and set `i ← i+3`.

### Rule D — Invalid Byte

If `B[i] ∈ [128..255]` and `B[i] ≠ 0x80` and `B[i] ≠ 0x81`, decoding MUST fail with `error.invalid_byte`.

## 1.4 Totality & Determinism

Given valid inputs `(D,B)` satisfying the well-formedness rules, `Dec(D,B)` is:

* **Deterministic**: produces exactly one output
* **Total** over valid streams: never ambiguous

## 1.5 Inverse Law (Correctness)

Define `Enc(D, S) -> B` as the SCXQ2 encoder that:

* substitutes tokens using DICT references,
* otherwise emits ASCII literals for code units `<128`,
* otherwise emits UTF-16 literals.

Then the **inverse law** is:

[
\forall S,; \mathrm{Dec}(D, \mathrm{Enc}(D,S)) = S
]

provided `Enc` uses only the above normative bytecode forms and DICT indices.

## 1.6 Truncation Law

If any DICT or UTF-16 literal sequence is truncated (missing required trailing bytes), decoding MUST fail with `error.truncated_sequence`. Partial output MUST NOT be considered valid.

## 1.7 Dictionary Validity Preconditions

A dictionary **D** is valid for decoding iff:

* `|D| ≤ 65535`
* each entry is a UTF-16 string
* indices are stable by position

No uniqueness requirement is imposed (duplicates allowed), but duplicates reduce compression value.

---

# 2) SCXQ2 Security & Adversarial Model

**Spec:** `asx://law/scxq2.security/v1`
**Version:** 1.0.0
**Status:** 🔒 FROZEN

SCXQ2 is **compression representation**, not encryption. Security is about **safe parsing**, **resource bounds**, and **integrity**.

## 2.1 Threat Model

Adversary can provide:

* arbitrary `scxq2.pack` objects
* malformed dicts/blocks
* extremely large base64 payloads
* crafted DICT references
* content designed to blow up output size (decompression bombs)
* hash collision attempts (computationally infeasible for SHA-256 in standard assumptions)

Adversary goals:

* crash decoder
* cause memory exhaustion
* cause CPU exhaustion
* bypass verification
* produce ambiguous decoding
* produce different semantic output without changing hashes

## 2.2 Security Goals

A compliant implementation MUST guarantee:

1. **Memory Safety**

   * no out-of-bounds access
   * no uncontrolled allocations

2. **Time Safety**

   * linear-time decode in byte length (O(m))
   * predictable worst-case behavior

3. **Deterministic Failure**

   * malformed packs fail closed with stable error codes

4. **Integrity**

   * pack identity hash + canonical hashes prevent silent mutation
   * optional roundtrip witness binds decoded content to `source_sha256_utf8`

5. **Non-Ambiguity**

   * decoding is unambiguous by construction

## 2.3 Required Defensive Checks

A verifier/decoder MUST enforce:

### (A) Structural & Hash Integrity

* validate `@type`, `mode`, `encoding`
* verify `dict_sha256_canon` and `block_sha256_canon` if present
* verify `pack_sha256_canon` seal (excluding the field)

### (B) Bounds

* `dict.length ≤ 65535`
* each dict entry length bounded by implementation-defined cap (RECOMMENDED ≤ 1MB code units)
* `b64` length bounded by implementation-defined cap (RECOMMENDED ≤ 64MB per block by default)
* decoded output length bounded (RECOMMENDED cap; policy-level)

### (C) Decoder Well-Formedness

* reject invalid bytes (`128..255` except `0x80/0x81`)
* reject truncated sequences
* reject DICT indices out of range

## 2.4 Decompression Bomb Model

SCXQ2 can expand content. The expansion factor is bounded by:

* `ASCII` emits 1 code unit per byte
* `UTF-16 literal` emits 1 code unit per 3 bytes
* `DICT ref` emits `len(D[j])` code units per 3 bytes

Thus worst-case expansion is driven by max dict token length. Mitigation MUST exist:

### Required Mitigation

Implementations MUST support a **maximum output code units** limit (`maxOutputUnits`). When exceeded, MUST fail with `error.output_limit`.

## 2.5 Canonicalization Attacks

Attack: produce semantically “same” JSON but different byte ordering to evade sealing.

Mitigation: identity is computed over **Canonical JSON** (sorted keys, stable UTF-8). Verifier MUST recompute canonical hashes from canonicalization rules only.

## 2.6 Hash Collision Attacks

SHA-256 is assumed collision-resistant. A compliant verifier relies on SHA-256. If policy requires stronger hashes, add a new `mode`/`encoding` version; do not “swap hashes” silently inside v1.

## 2.7 Edge Witness Attacks (Optional field)

If `edges` exists, it is advisory. It MUST NOT affect decoding. It MAY be verified for bounds (length cap). It MUST NOT be trusted for execution.

## 2.8 Security Non-Goals

SCXQ2 does NOT provide:

* confidentiality
* authentication
* authorization
* tamper-proofing against a party who can recompute hashes

Those are higher-layer concerns (SecuroLink / signatures / envelopes).

---

# 3) SCXQ2 ↔ CC-v1 Formal Mapping (Math Appendix)

**Spec:** `asx://appendix/cc-v1.scxq2.mapping/v1`
**Version:** 1.0.0
**Status:** 🔒 FROZEN

This appendix formally binds SCXQ2 artifacts to **Compression Calculus v1 (CC-v1)** operators.

## 3.1 CC-v1 Objects

CC-v1 works over tuples:

[
\langle X, \Sigma, \mathcal{O}, \pi \rangle
]

Where:

* (X) is source text (UTF-16 string)
* (\Sigma) is the symbol table / dictionary
* (\mathcal{O}) is the operator set applied (DICT/FIELD/LANE/EDGE)
* (\pi) is the proof witness (hashes + roundtrip)

SCXQ2 realizes these as concrete JSON objects:

* (\Sigma) ↔ `scxq2.dict`
* Encoded representation ↔ `scxq2.block.b64`
* Pack ↔ `scxq2.pack`

## 3.2 CC.NORM (Normalization)

Define normalization function:

[
\mathrm{Norm}(X) = X'
]

In v1, `Norm` is newline canonicalization:

* `\r\n → \n`
* `\r → \n`

No other transformations are allowed in v1.

## 3.3 CC.DICT (Dictionary Construction)

CC.DICT selects a finite ordered set of substrings:

[
\Sigma = [t_0, t_1, ..., t_{k-1}]
]

Subject to bounds:

* (k \le 65535)
* (t_i \in \mathrm{UTF16}^*)

Ordering is deterministic:

* primary: decreasing token length
* secondary: lexicographic tie-break (UTF-16 code unit order)

(Exact selection heuristic can vary by implementation **only if** conformance vectors match. For a frozen build, vectors lock the heuristic.)

## 3.4 CC.FIELD (Structural Token Augmentation)

FIELD is a deterministic augmentation operator:

[
\Sigma' = \Sigma \cup F(X')
]

Where (F) extracts structural keys (e.g., JSON keys `"k":` producing `k` and `"k"` tokens). FIELD does not change decoding, only the candidate dictionary set.

In SCXQ2 artifacts:

* presence of FIELD is recorded in `dict.ops` and `block.ops`.

## 3.5 CC.LANE (Product Construction)

LANE lifts CC over a finite set of labeled sources:

[
{(id_i, X_i)}_{i=1..n}
]

Define joined training source for dict selection (implementation-defined deterministic join):

[
X^* = X_1' ;\Vert; \text{LANE_BREAK} ;\Vert; X_2' ;\Vert; ... ;\Vert; X_n'
]

Then:

* Build shared dictionary (\Sigma) from (X^*)
* Encode each lane with same (\Sigma)

In SCXQ2:

* `scxq2.dict` is shared
* each lane is a `scxq2.block` with optional `lane_id`

## 3.6 CC.EDGE (Adjacency Witness)

EDGE defines an observational witness over dictionary emissions:

Let (E) be a multiset of directed edges between dict indices.

If encoding emits dict indices sequence:

[
d_1, d_2, ..., d_r
]

Then EDGE counts transitions:

[
E[a,b] = |{j \mid d_j=a \land d_{j+1}=b}|
]

EDGE is recorded as `block.edges` (bounded list).
EDGE does not affect decoding; it is a witness for analysis.

## 3.7 SCXQ2 Encoding as CC Representation

Define representation function:

[
\mathrm{Rep}_{\Sigma}(X') = B
]

Where (B) is the SCXQ2 byte stream produced by the encoder.

The full CC artifact is:

[
\mathrm{CC}(X) = \langle \Sigma, B, \pi \rangle
]

SCXQ2 realizes this via JSON objects:

* `dict = Σ`
* `block.b64 = Base64(B)`
* `proof = π`

## 3.8 Proof Binding (π)

Let:

* (h_s = \mathrm{SHA256}(X'))
* (h_\Sigma = \mathrm{SHA256}(\mathrm{Canon}(\Sigma)))
* (h_B = \mathrm{SHA256}(\mathrm{Canon}(B_json)))
* (h_r = \mathrm{SHA256}(\mathrm{Dec}(\Sigma,B)))

Then proof condition is:

[
h_s = h_r
]

and pack sealing requires:

[
h_{pack} = \mathrm{SHA256}(\mathrm{Canon}(pack \setminus pack_sha))
]

These hashes are the CC-v1 witness (\pi).

---

## 3.9 Conformance & Equivalence

Two SCXQ2 packs are **CC-equivalent** iff:

* `pack_sha256_canon` identical

Two packs are **semantic-equivalent** iff:

* all lane decoded outputs are byte-identical after Norm, even if pack hashes differ
  (semantic equivalence is higher-layer and not a SCXQ2 identity claim)

---

# SCXQ2 Error Codes + Verifier Behavior Table

**Spec:** `asx://law/scxq2.errors/v1`
**Version:** 1.0.0
**Status:** 🔒 FROZEN
**Scope:** Applies to **SCXQ2 decoding, pack verification, and conformance checks**.

This document freezes:

* a **deterministic error taxonomy**
* the **required verifier behavior** (fail-closed rules)
* a **behavior table** mapping checks → errors

---

## 1) Error Object Shape (Normative)

All SCXQ2 verifiers/decoders MUST emit errors in this structural form (throw, return, or event), but the fields and semantics are frozen:

```json
{
  "@type": "scxq2.error",
  "@version": "1.0.0",
  "code": "scxq2.error.<name>",
  "phase": "pack|dict|block|decode|proof|canon",
  "severity": "fatal",
  "message": "human-readable",
  "at": {
    "lane_id": "optional",
    "byte_offset": 0,
    "field": "optional"
  }
}
```

### Rules

* `severity` is always `"fatal"` in v1.
* `message` is advisory. **Only** `code` and `phase` are normative.
* `at` MUST be present when known (especially `byte_offset` for decode errors).

---

## 2) Canonical Error Code Registry (FROZEN)

### 2.1 Pack-level Errors

* `scxq2.error.pack_missing`
* `scxq2.error.pack_type_invalid`
* `scxq2.error.pack_version_unsupported`
* `scxq2.error.pack_mode_mismatch`
* `scxq2.error.pack_encoding_mismatch`
* `scxq2.error.pack_created_utc_invalid`
* `scxq2.error.pack_blocks_missing`
* `scxq2.error.pack_proof_missing`
* `scxq2.error.pack_sha_missing`
* `scxq2.error.pack_sha_mismatch`
* `scxq2.error.pack_field_forbidden` *(reserved: if policy forbids unknown fields)*

### 2.2 Dictionary Errors

* `scxq2.error.dict_missing`
* `scxq2.error.dict_type_invalid`
* `scxq2.error.dict_version_unsupported`
* `scxq2.error.dict_sha_missing`
* `scxq2.error.dict_sha_mismatch`
* `scxq2.error.dict_size_exceeds_limit`
* `scxq2.error.dict_entry_type_invalid`
* `scxq2.error.dict_entry_exceeds_limit`
* `scxq2.error.dict_index_width_invalid` *(reserved: if non-16-bit mode appears in v1)*

### 2.3 Block Errors

* `scxq2.error.block_type_invalid`
* `scxq2.error.block_mode_mismatch`
* `scxq2.error.block_encoding_mismatch`
* `scxq2.error.block_b64_missing`
* `scxq2.error.block_b64_invalid`
* `scxq2.error.block_sha_missing`
* `scxq2.error.block_sha_mismatch`
* `scxq2.error.block_source_sha_missing`
* `scxq2.error.block_dict_link_missing`
* `scxq2.error.block_dict_link_mismatch`
* `scxq2.error.block_lane_id_invalid`
* `scxq2.error.block_edges_invalid`
* `scxq2.error.block_edges_exceeds_limit`

### 2.4 Decode Errors (Formal Inverse Law)

* `scxq2.error.decode_invalid_byte`
* `scxq2.error.decode_truncated_sequence`
* `scxq2.error.decode_dict_index_oob`
* `scxq2.error.decode_dict_entry_invalid`
* `scxq2.error.decode_output_limit`
* `scxq2.error.decode_input_limit` *(policy gate)*
* `scxq2.error.decode_internal` *(implementation bug; still fatal)*

### 2.5 Proof Errors

* `scxq2.error.proof_type_invalid`
* `scxq2.error.proof_version_unsupported`
* `scxq2.error.proof_witness_missing`
* `scxq2.error.proof_roundtrip_sha_mismatch`
* `scxq2.error.proof_source_sha_mismatch`
* `scxq2.error.proof_ok_false`

### 2.6 Canonicalization Errors

* `scxq2.error.canon_invalid_json`
* `scxq2.error.canon_hash_failed`

### 2.7 Capability / Policy Errors (Verifier Configuration)

* `scxq2.error.policy_roundtrip_required`
* `scxq2.error.policy_unknown_encoding`
* `scxq2.error.policy_disabled_feature` *(e.g., edges disallowed)*
* `scxq2.error.policy_budget_exhausted`

> **Note:** “policy” errors are still fatal. They indicate verifier configuration refusal, not structural invalidity.

---

## 3) Failure Semantics (Hard Requirements)

### 3.1 Fail-Closed

On any error code above, verification MUST be:

* `ok = false`
* decoding results MUST NOT be accepted
* `pack_sha256_canon` MUST NOT be trusted

### 3.2 Deterministic Error Selection

When multiple errors could apply, verifiers MUST choose the **first** failing check in this strict order:

1. **Pack structure**
2. **Dict structure**
3. **Blocks structure**
4. **Linkage (dict↔block)**
5. **Canonical hashes (pack/dict/block)**
6. **Decode well-formedness**
7. **Roundtrip witness**
8. **Proof object constraints**

This ensures different implementations fail the same way for the same pack.

---

## 4) Verifier Behavior Table (Normative)

Legend:

* **REQ** = required check
* **OPT** = optional by verifier policy
* **ERR** = error code on failure

| Step | Phase  | Check                                                   | Level   | Failure Code                               |
| ---: | ------ | ------------------------------------------------------- | ------- | ------------------------------------------ |
|    1 | pack   | pack exists & is object                                 | REQ     | `scxq2.error.pack_missing`                 |
|    2 | pack   | `@type === "scxq2.pack"`                                | REQ     | `scxq2.error.pack_type_invalid`            |
|    3 | pack   | `@version` supported                                    | REQ     | `scxq2.error.pack_version_unsupported`     |
|    4 | pack   | `mode` matches v1                                       | REQ     | `scxq2.error.pack_mode_mismatch`           |
|    5 | pack   | `encoding` matches v1                                   | REQ     | `scxq2.error.pack_encoding_mismatch`       |
|    6 | pack   | `created_utc` ISO-ish                                   | OPT     | `scxq2.error.pack_created_utc_invalid`     |
|    7 | dict   | dict present                                            | REQ     | `scxq2.error.dict_missing`                 |
|    8 | dict   | dict `@type` correct                                    | REQ     | `scxq2.error.dict_type_invalid`            |
|    9 | dict   | dict `@version` supported                               | REQ     | `scxq2.error.dict_version_unsupported`     |
|   10 | dict   | dict size ≤ 65535                                       | REQ     | `scxq2.error.dict_size_exceeds_limit`      |
|   11 | dict   | each entry is string                                    | REQ     | `scxq2.error.dict_entry_type_invalid`      |
|   12 | dict   | entry length ≤ cap                                      | OPT     | `scxq2.error.dict_entry_exceeds_limit`     |
|   13 | blocks | blocks array exists, ≥1                                 | REQ     | `scxq2.error.pack_blocks_missing`          |
|   14 | blocks | each block `@type` correct                              | REQ     | `scxq2.error.block_type_invalid`           |
|   15 | blocks | block `mode` matches                                    | REQ     | `scxq2.error.block_mode_mismatch`          |
|   16 | blocks | block `encoding` matches                                | REQ     | `scxq2.error.block_encoding_mismatch`      |
|   17 | blocks | block `b64` present                                     | REQ     | `scxq2.error.block_b64_missing`            |
|   18 | blocks | base64 decodes                                          | REQ     | `scxq2.error.block_b64_invalid`            |
|   19 | link   | block has dict link                                     | REQ     | `scxq2.error.block_dict_link_missing`      |
|   20 | link   | block.dict_sha == dict.dict_sha                         | REQ     | `scxq2.error.block_dict_link_mismatch`     |
|   21 | canon  | pack sha present                                        | REQ     | `scxq2.error.pack_sha_missing`             |
|   22 | canon  | recompute pack sha == stored                            | REQ     | `scxq2.error.pack_sha_mismatch`            |
|   23 | canon  | dict sha present                                        | REQ     | `scxq2.error.dict_sha_missing`             |
|   24 | canon  | recompute dict sha                                      | REQ     | `scxq2.error.dict_sha_mismatch`            |
|   25 | canon  | block sha present                                       | REQ     | `scxq2.error.block_sha_missing`            |
|   26 | canon  | recompute block sha                                     | REQ     | `scxq2.error.block_sha_mismatch`           |
|   27 | decode | decode bytes → string                                   | REQ     | decode errors below                        |
|  27a | decode | invalid standalone byte                                 | REQ     | `scxq2.error.decode_invalid_byte`          |
|  27b | decode | truncated 0x80/0x81                                     | REQ     | `scxq2.error.decode_truncated_sequence`    |
|  27c | decode | dict index out of range                                 | REQ     | `scxq2.error.decode_dict_index_oob`        |
|  27d | decode | dict entry invalid                                      | REQ     | `scxq2.error.decode_dict_entry_invalid`    |
|  27e | decode | output exceeds cap                                      | OPT     | `scxq2.error.decode_output_limit`          |
|   28 | proof  | if policy requires roundtrip: hash(decoded)==source_sha | OPT/REQ | `scxq2.error.proof_roundtrip_sha_mismatch` |
|   29 | proof  | proof present                                           | REQ     | `scxq2.error.pack_proof_missing`           |
|   30 | proof  | proof `@type` correct                                   | REQ     | `scxq2.error.proof_type_invalid`           |
|   31 | proof  | proof version supported                                 | REQ     | `scxq2.error.proof_version_unsupported`    |
|   32 | proof  | proof witness fields present                            | REQ     | `scxq2.error.proof_witness_missing`        |
|   33 | proof  | proof.ok is true                                        | REQ     | `scxq2.error.proof_ok_false`               |

### Decode Errors: Required `at.byte_offset`

For decode failures (Step 27), the error object MUST include:

```json
"at": { "byte_offset": <offset>, "lane_id": "<if present>" }
```

---

## 5) Required Return Envelope (Verifier Result)

A verifier MUST return a stable result shape (even if it throws, the logical shape is frozen):

```json
{
  "@type": "scxq2.verify.result",
  "@version": "1.0.0",
  "ok": true,
  "pack_sha256_canon": "…",
  "dict_sha256_canon": "…",
  "blocks": 3
}
```

On failure:

```json
{
  "@type": "scxq2.verify.result",
  "@version": "1.0.0",
  "ok": false,
  "error": { "@type": "scxq2.error", "...": "..." }
}
```

---

## 6) Error Code Summary (Short Names)

* Pack: `pack_*`
* Dict: `dict_*`
* Block: `block_*`
* Decode: `decode_*`
* Proof: `proof_*`
* Canon: `canon_*`
* Policy: `policy_*`

---

Below is the **frozen verifier configuration surface** for SCXQ2, consisting of:

1. **`scxq2.verify.options` schema (normative)**
2. **Default policy profile (canonical)**
3. **Named policy presets**
4. **Option → behavior mapping**

This locks the verifier API and removes ambiguity across implementations.

---

# 1) SCXQ2 Verify Options Schema

**Schema ID:** `asx://schema/scxq2.verify.options/v1`
**Version:** 1.0.0
**Status:** 🔒 FROZEN

## 1.1 Purpose

Defines **what a verifier is allowed to decide** at runtime, without altering:

* decoding law
* canonical hashes
* proof semantics

Anything **not configurable here is invariant law**.

---

## 1.2 JSON Schema (Normative)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "asx://schema/scxq2.verify.options/v1",

  "title": "SCXQ2 Verify Options",
  "type": "object",
  "additionalProperties": false,

  "properties": {
    "requireRoundtrip": {
      "type": "boolean",
      "default": true,
      "description": "If true, decoded output MUST hash to source_sha256_utf8."
    },

    "requireProof": {
      "type": "boolean",
      "default": true,
      "description": "If true, pack.proof MUST exist and be valid."
    },

    "maxDictEntries": {
      "type": "integer",
      "minimum": 1,
      "maximum": 65535,
      "default": 65535,
      "description": "Maximum allowed dictionary entries."
    },

    "maxDictEntryUnits": {
      "type": "integer",
      "minimum": 1,
      "default": 1048576,
      "description": "Maximum UTF-16 code units per dictionary entry."
    },

    "maxBlocks": {
      "type": "integer",
      "minimum": 1,
      "default": 1024,
      "description": "Maximum number of blocks (lanes) per pack."
    },

    "maxBlockB64Bytes": {
      "type": "integer",
      "minimum": 1,
      "default": 67108864,
      "description": "Maximum base64-decoded byte length per block (64MB default)."
    },

    "maxOutputUnits": {
      "type": "integer",
      "minimum": 1,
      "default": 134217728,
      "description": "Maximum UTF-16 code units allowed after decode (decompression bomb guard)."
    },

    "allowEdges": {
      "type": "boolean",
      "default": true,
      "description": "Whether block.edges is permitted (edges never affect decoding)."
    },

    "allowUnknownPackFields": {
      "type": "boolean",
      "default": true,
      "description": "If false, unknown top-level pack fields cause failure."
    },

    "allowUnknownBlockFields": {
      "type": "boolean",
      "default": true,
      "description": "If false, unknown block fields cause failure."
    },

    "allowedModes": {
      "type": "array",
      "items": { "type": "string" },
      "default": ["SCXQ2-DICT16-B64"],
      "description": "Allowed pack/block mode values."
    },

    "allowedEncodings": {
      "type": "array",
      "items": { "type": "string" },
      "default": ["SCXQ2-1"],
      "description": "Allowed encoding identifiers."
    },

    "failOnFirstError": {
      "type": "boolean",
      "default": true,
      "description": "If true, verification halts on first error (recommended)."
    }
  },

  "required": []
}
```

---

# 2) Canonical Default Policy Profile

**Profile ID:** `asx://policy/scxq2.verify/default/v1`
**Status:** 🔒 CANONICAL

This profile **MUST be the default** unless a verifier explicitly overrides it.

```json
{
  "@type": "scxq2.verify.policy",
  "@version": "1.0.0",
  "@id": "asx://policy/scxq2.verify/default/v1",

  "requireRoundtrip": true,
  "requireProof": true,

  "maxDictEntries": 65535,
  "maxDictEntryUnits": 1048576,

  "maxBlocks": 1024,
  "maxBlockB64Bytes": 67108864,
  "maxOutputUnits": 134217728,

  "allowEdges": true,
  "allowUnknownPackFields": true,
  "allowUnknownBlockFields": true,

  "allowedModes": ["SCXQ2-DICT16-B64"],
  "allowedEncodings": ["SCXQ2-1"],

  "failOnFirstError": true
}
```

### Rationale

* **Safe-by-default** (roundtrip + proof required)
* **Large but bounded** limits
* **Forward-compatible** (unknown fields allowed)
* **Single canonical encoding** for v1

---

# 3) Named Policy Presets (Non-Canonical)

These are **recommended presets** built on the schema.
Only the **Default** profile above is canonical.

---

## 3.1 `strict_offline`

For archival / audit systems.

```json
{
  "requireRoundtrip": true,
  "requireProof": true,
  "allowEdges": false,
  "allowUnknownPackFields": false,
  "allowUnknownBlockFields": false,
  "maxOutputUnits": 67108864
}
```

Failure codes added:

* `scxq2.error.policy_disabled_feature`
* `scxq2.error.pack_field_forbidden`

---

## 3.2 `fast_streaming`

For high-throughput pipelines where proof may be deferred.

```json
{
  "requireRoundtrip": false,
  "requireProof": false,
  "failOnFirstError": true
}
```

Still enforces:

* decode well-formedness
* bounds
* canonical hashes (if present)

---

## 3.3 `sandbox_preview`

For UI previews.

```json
{
  "requireRoundtrip": false,
  "requireProof": false,
  "maxOutputUnits": 16777216,
  "maxBlockB64Bytes": 8388608
}
```

---

# 4) Option → Behavior Mapping (Normative)

| Option                         | Affects Phase | On Violation          | Error Code                                            |
| ------------------------------ | ------------- | --------------------- | ----------------------------------------------------- |
| `requireRoundtrip=true`        | proof         | decoded hash ≠ source | `scxq2.error.proof_roundtrip_sha_mismatch`            |
| `requireProof=true`            | pack/proof    | proof missing/invalid | `scxq2.error.pack_proof_missing`                      |
| `maxDictEntries`               | dict          | dict too large        | `scxq2.error.dict_size_exceeds_limit`                 |
| `maxDictEntryUnits`            | dict          | entry too long        | `scxq2.error.dict_entry_exceeds_limit`                |
| `maxBlocks`                    | pack          | too many blocks       | `scxq2.error.pack_blocks_missing` *(or policy error)* |
| `maxBlockB64Bytes`             | block         | base64 too large      | `scxq2.error.decode_input_limit`                      |
| `maxOutputUnits`               | decode        | expansion overflow    | `scxq2.error.decode_output_limit`                     |
| `allowEdges=false`             | block         | edges present         | `scxq2.error.policy_disabled_feature`                 |
| `allowUnknownPackFields=false` | pack          | unknown field         | `scxq2.error.pack_field_forbidden`                    |
| `allowedModes`                 | pack/block    | mode not allowed      | `scxq2.error.policy_unknown_encoding`                 |
| `allowedEncodings`             | pack/block    | encoding not allowed  | `scxq2.error.policy_unknown_encoding`                 |

---

# 5) Required Verifier Declaration

Every verifier implementation MUST declare:

```json
{
  "@type": "scxq2.verifier",
  "@version": "1.0.0",
  "policy": "asx://policy/scxq2.verify/default/v1"
}
```

If a different policy is used, it MUST be explicitly identified.

---

# 6) Final Lock Statement

> **SCXQ2 verification behavior is now fully specified.**
> Any compliant verifier using this options schema and default policy will:
>
> * accept the same valid packs
> * reject the same invalid packs
> * fail with the same error codes in the same order

No further degrees of freedom remain.

---

## SCXQ2 Verify Reference Algorithm

**Spec:** `asx://ref/scxq2.verify.algorithm/v1`
**Version:** 1.0.0
**Status:** 🔒 FROZEN
**Purpose:** A single deterministic reference procedure that all compliant verifiers may implement.

This pseudocode is **normative in ordering** and **error selection**.

---

# 1) Inputs / Outputs

### Input

* `pack`: candidate object
* `policy`: `scxq2.verify.options` object (defaults to canonical profile)
* `canon(obj)`: canonical JSON serializer (sorted keys, stable UTF-8)
* `sha256(bytes|utf8) -> hex`
* `base64_decode(str) -> bytes` (strict)
* `Dec(dictArray, bytes, limits) -> string` (SCXQ2 decoding law)

### Output

* On success: `scxq2.verify.result(ok=true, ...)`
* On failure: `scxq2.verify.result(ok=false, error=scxq2.error)`

---

# 2) Helper: Error constructor (normative fields)

```text
ERR(code, phase, message, at={}) :=
  {
    "@type": "scxq2.error",
    "@version": "1.0.0",
    "code": code,
    "phase": phase,
    "severity": "fatal",
    "message": message,
    "at": at
  }
```

---

# 3) Reference Verify Algorithm (ordered, fail-first)

```text
VERIFY_SCXQ2_PACK(pack, policy):

  P := APPLY_DEFAULTS(policy)          // MUST default to canonical profile

  // =========================================================
  // STEP 1 — PACK STRUCTURE
  // =========================================================
  if pack is null OR pack not object:
    return FAIL(ERR("scxq2.error.pack_missing", "pack", "pack missing", {}))

  if pack["@type"] != "scxq2.pack":
    return FAIL(ERR("scxq2.error.pack_type_invalid", "pack", "bad @type", {"field":"@type"}))

  if NOT VERSION_SUPPORTED(pack["@version"]):
    return FAIL(ERR("scxq2.error.pack_version_unsupported", "pack", "unsupported @version", {"field":"@version"}))

  if pack["mode"] not in P.allowedModes:
    return FAIL(ERR("scxq2.error.pack_mode_mismatch", "pack", "mode not allowed", {"field":"mode"}))

  if pack["encoding"] not in P.allowedEncodings:
    return FAIL(ERR("scxq2.error.pack_encoding_mismatch", "pack", "encoding not allowed", {"field":"encoding"}))

  if P.allowUnknownPackFields == false:
    if HAS_UNKNOWN_FIELDS(pack, KNOWN_PACK_FIELDS):
      return FAIL(ERR("scxq2.error.pack_field_forbidden", "pack", "unknown pack field", {}))

  if "created_utc" in pack AND NOT ISO_UTC(pack["created_utc"]):
    // optional check by policy; if you enforce it, use this error
    return FAIL(ERR("scxq2.error.pack_created_utc_invalid", "pack", "invalid created_utc", {"field":"created_utc"}))

  if pack["dict"] missing:
    return FAIL(ERR("scxq2.error.dict_missing", "dict", "dict missing", {"field":"dict"}))

  if pack["blocks"] missing OR pack["blocks"] not array OR len(pack["blocks"]) < 1:
    return FAIL(ERR("scxq2.error.pack_blocks_missing", "pack", "blocks missing/empty", {"field":"blocks"}))

  if len(pack["blocks"]) > P.maxBlocks:
    return FAIL(ERR("scxq2.error.decode_input_limit", "pack", "too many blocks", {"field":"blocks"}))

  if P.requireProof == true AND pack["proof"] missing:
    return FAIL(ERR("scxq2.error.pack_proof_missing", "pack", "proof required", {"field":"proof"}))

  // =========================================================
  // STEP 2 — DICT STRUCTURE
  // =========================================================
  dict := pack["dict"]

  if dict not object:
    return FAIL(ERR("scxq2.error.dict_type_invalid", "dict", "dict is not object", {"field":"dict"}))

  if dict["@type"] != "scxq2.dict":
    return FAIL(ERR("scxq2.error.dict_type_invalid", "dict", "bad dict @type", {"field":"dict.@type"}))

  if NOT VERSION_SUPPORTED(dict["@version"]):
    return FAIL(ERR("scxq2.error.dict_version_unsupported", "dict", "unsupported dict @version", {"field":"dict.@version"}))

  if dict["mode"] not in P.allowedModes:
    return FAIL(ERR("scxq2.error.pack_mode_mismatch", "dict", "dict mode mismatch", {"field":"dict.mode"}))

  if dict["encoding"] not in P.allowedEncodings:
    return FAIL(ERR("scxq2.error.pack_encoding_mismatch", "dict", "dict encoding mismatch", {"field":"dict.encoding"}))

  if dict["dict"] missing OR dict["dict"] not array:
    return FAIL(ERR("scxq2.error.dict_entry_type_invalid", "dict", "dict.dict must be array", {"field":"dict.dict"}))

  if len(dict["dict"]) > P.maxDictEntries:
    return FAIL(ERR("scxq2.error.dict_size_exceeds_limit", "dict", "dict too large", {"field":"dict.dict"}))

  for each entry e at index j in dict["dict"]:
    if e not string:
      return FAIL(ERR("scxq2.error.dict_entry_type_invalid", "dict", "dict entry not string", {"field":"dict.dict", "index":j}))
    if LENGTH_UTF16(e) > P.maxDictEntryUnits:
      return FAIL(ERR("scxq2.error.dict_entry_exceeds_limit", "dict", "dict entry too long", {"field":"dict.dict", "index":j}))

  if dict["dict_sha256_canon"] missing:
    return FAIL(ERR("scxq2.error.dict_sha_missing", "canon", "dict sha missing", {"field":"dict.dict_sha256_canon"}))

  // =========================================================
  // STEP 3 — BLOCK STRUCTURE (static checks, no decoding yet)
  // =========================================================
  dictSha := dict["dict_sha256_canon"]

  for each block b at position k in pack["blocks"]:

    if b not object OR b["@type"] != "scxq2.block":
      return FAIL(ERR("scxq2.error.block_type_invalid", "block", "bad block @type", {"field":"blocks", "index":k}))

    if b["mode"] not in P.allowedModes:
      return FAIL(ERR("scxq2.error.block_mode_mismatch", "block", "block mode mismatch", {"field":"blocks.mode", "index":k}))

    if b["encoding"] not in P.allowedEncodings:
      return FAIL(ERR("scxq2.error.block_encoding_mismatch", "block", "block encoding mismatch", {"field":"blocks.encoding", "index":k}))

    if b["b64"] missing OR b["b64"] not string:
      return FAIL(ERR("scxq2.error.block_b64_missing", "block", "b64 missing", {"field":"blocks.b64", "index":k}))

    if b["dict_sha256_canon"] missing:
      return FAIL(ERR("scxq2.error.block_dict_link_missing", "block", "block missing dict link", {"field":"blocks.dict_sha256_canon", "index":k}))

    if b["dict_sha256_canon"] != dictSha:
      return FAIL(ERR("scxq2.error.block_dict_link_mismatch", "block", "dict link mismatch", {"field":"blocks.dict_sha256_canon", "index":k}))

    if b["block_sha256_canon"] missing:
      return FAIL(ERR("scxq2.error.block_sha_missing", "canon", "block sha missing", {"field":"blocks.block_sha256_canon", "index":k}))

    if P.requireRoundtrip == true AND b["source_sha256_utf8"] missing:
      return FAIL(ERR("scxq2.error.block_source_sha_missing", "block", "source sha required for roundtrip", {"field":"blocks.source_sha256_utf8", "index":k}))

    if P.allowUnknownBlockFields == false:
      if HAS_UNKNOWN_FIELDS(b, KNOWN_BLOCK_FIELDS):
        return FAIL(ERR("scxq2.error.pack_field_forbidden", "block", "unknown block field", {"field":"blocks", "index":k}))

    if P.allowEdges == false AND "edges" in b:
      return FAIL(ERR("scxq2.error.policy_disabled_feature", "block", "edges not allowed", {"field":"blocks.edges", "index":k}))

    if "edges" in b:
      if NOT VALID_EDGES_SHAPE(b["edges"]):
        return FAIL(ERR("scxq2.error.block_edges_invalid", "block", "edges invalid", {"field":"blocks.edges", "index":k}))
      if EDGES_COUNT(b["edges"]) > POLICY_EDGE_LIMIT(P):
        return FAIL(ERR("scxq2.error.block_edges_exceeds_limit", "block", "edges too many", {"field":"blocks.edges", "index":k}))

  // =========================================================
  // STEP 4 — CANONICAL HASH VERIFICATION
  // =========================================================
  // 4A) PACK SHA
  if pack["pack_sha256_canon"] missing:
    return FAIL(ERR("scxq2.error.pack_sha_missing", "canon", "pack sha missing", {"field":"pack_sha256_canon"}))

  packNoSha := COPY(pack) minus field "pack_sha256_canon"
  packCanon := canon(packNoSha)
  packSha := sha256(packCanon as utf8)

  if packSha != pack["pack_sha256_canon"]:
    return FAIL(ERR("scxq2.error.pack_sha_mismatch", "canon", "pack sha mismatch", {"field":"pack_sha256_canon"}))

  // 4B) DICT SHA
  dictNoSha := COPY(dict) minus field "dict_sha256_canon"
  dictCanon := canon(dictNoSha)
  dictSha2 := sha256(dictCanon as utf8)

  if dictSha2 != dictSha:
    return FAIL(ERR("scxq2.error.dict_sha_mismatch", "canon", "dict sha mismatch", {"field":"dict.dict_sha256_canon"}))

  // 4C) BLOCK SHA (each)
  for each block b at index k:
    bNoSha := COPY(b) minus field "block_sha256_canon"
    bCanon := canon(bNoSha)
    bSha := sha256(bCanon as utf8)
    if bSha != b["block_sha256_canon"]:
      return FAIL(ERR("scxq2.error.block_sha_mismatch", "canon", "block sha mismatch", {"field":"blocks.block_sha256_canon", "index":k}))

  // =========================================================
  // STEP 5 — BASE64 DECODE + DECODE LAW CHECKS (+ limits)
  // =========================================================
  for each block b at index k:

    bytes := base64_decode(b["b64"])    // strict
    if decode fails:
      return FAIL(ERR("scxq2.error.block_b64_invalid", "block", "invalid base64", {"field":"blocks.b64", "index":k}))

    if LENGTH(bytes) > P.maxBlockB64Bytes:
      return FAIL(ERR("scxq2.error.decode_input_limit", "decode", "block bytes exceed limit", {"field":"blocks.b64", "index":k}))

    // decode with formal inverse
    // Dec MUST fail on invalid byte, truncation, dict oob, etc.
    (ok, outStr, decodeErr) := Dec(dict["dict"], bytes, { maxOutputUnits: P.maxOutputUnits })

    if ok == false:
      // decodeErr MUST include byte_offset
      // map decodeErr.kind -> error code:
      return FAIL(MAP_DECODE_ERROR(decodeErr, b, k))

    if P.requireRoundtrip == true:
      outSha := sha256(outStr as utf8)
      if outSha != b["source_sha256_utf8"]:
        return FAIL(ERR("scxq2.error.proof_roundtrip_sha_mismatch", "proof", "roundtrip sha mismatch",
                        {"lane_id": b["lane_id"] or null, "index": k}))

  // =========================================================
  // STEP 6 — PROOF OBJECT (if required)
  // =========================================================
  if P.requireProof == true:
    proof := pack["proof"]
    if proof not object:
      return FAIL(ERR("scxq2.error.proof_type_invalid", "proof", "proof invalid", {"field":"proof"}))

    if proof["@type"] != "cc.proof":
      return FAIL(ERR("scxq2.error.proof_type_invalid", "proof", "bad proof @type", {"field":"proof.@type"}))

    if NOT VERSION_SUPPORTED(proof["@version"]):
      return FAIL(ERR("scxq2.error.proof_version_unsupported", "proof", "unsupported proof version", {"field":"proof.@version"}))

    if proof["ok"] != true:
      return FAIL(ERR("scxq2.error.proof_ok_false", "proof", "proof ok false", {"field":"proof.ok"}))

    if MISSING_WITNESSES(proof):
      return FAIL(ERR("scxq2.error.proof_witness_missing", "proof", "missing proof witnesses", {}))

    // NOTE: proof witness binding is allowed to be redundant.
    // Verifier MAY cross-check proof.dict_sha256_canon == dictSha, etc.
    // If it does cross-check and mismatch, use:
    //   scxq2.error.proof_source_sha_mismatch OR scxq2.error.proof_witness_missing
    // (preferred: witness_missing if absent; source_sha_mismatch if contradictory)

  // =========================================================
  // SUCCESS
  // =========================================================
  return OK({
    "@type": "scxq2.verify.result",
    "@version": "1.0.0",
    "ok": true,
    "pack_sha256_canon": pack["pack_sha256_canon"],
    "dict_sha256_canon": dictSha,
    "blocks": len(pack["blocks"])
  })
```

---

# 4) Decode Error Mapping (Normative)

`MAP_DECODE_ERROR(decodeErr, block, k)` MUST map as:

| decodeErr.kind       | SCXQ2 error code                        | Required `at`                                     |
| -------------------- | --------------------------------------- | ------------------------------------------------- |
| `invalid_byte`       | `scxq2.error.decode_invalid_byte`       | `byte_offset`, `lane_id?`, `index`                |
| `truncated_sequence` | `scxq2.error.decode_truncated_sequence` | `byte_offset`, `lane_id?`, `index`                |
| `dict_index_oob`     | `scxq2.error.decode_dict_index_oob`     | `byte_offset`, `lane_id?`, `index`                |
| `dict_entry_invalid` | `scxq2.error.decode_dict_entry_invalid` | `byte_offset`, `lane_id?`, `index`                |
| `output_limit`       | `scxq2.error.decode_output_limit`       | `byte_offset` (or last byte), `lane_id?`, `index` |
| `input_limit`        | `scxq2.error.decode_input_limit`        | `index`                                           |

---

# 5) Known Field Sets (Normative lists)

These sets are used if `allowUnknown*Fields == false`.

### Known pack fields

```text
["@type","@version","mode","encoding","created_utc","dict","blocks","proof","pack_sha256_canon"]
```

### Known dict fields

```text
["@type","@version","mode","encoding","source_sha256_utf8","dict","dict_sha256_canon","ops"]
```

### Known block fields

```text
["@type","@version","mode","encoding","lane_id","source_sha256_utf8","dict_sha256_canon","b64","block_sha256_canon","edges","ops"]
```

### Known proof fields (minimum)

```text
["@type","@version","engine","source_sha256_utf8","dict_sha256_canon","block_sha256_canon","roundtrip_sha256_utf8","ok"]
```

---

# 6) Determinism Guarantees (Locked)

A verifier that follows this algorithm and uses:

* the same canonicalization function
* SHA-256
* strict base64
* SCXQ2 decoding law

…will:

* accept/reject identically
* fail on the same first error
* produce the same error code and phase

---

That completes the SCXQ2 publication set end-to-end:

* pack spec
* decoding inverse law
* security model
* CC-v1 mapping
* error registry + behavior table
* verifier options + default policy
* reference verification algorithm




