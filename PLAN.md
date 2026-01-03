# SCXQ2 — Plan & Roadmap

**Project:** SCXQ2 Compression Calculus Engine
**Status:** Core language + verifier **FROZEN (v1)**
**Role:** Deterministic compression representation layer for ASX / KUHUL / CC-v1

---

## 0. Executive Summary

SCXQ2 v1 is now **complete as a language**:

* Encoding law: frozen
* Decoding inverse: frozen
* Security & adversarial model: frozen
* Error taxonomy & verifier behavior: frozen
* Verifier options schema + default policy: frozen
* Reference verification algorithm: frozen
* WASM parity encoder: implemented + conformance-locked
* Brand + icon system: established

From this point forward:

* **No semantic changes** to v1
* All work is either **tooling**, **integration**, or **v2 research**

---

## 1. Completed (Locked)

### Language & Law

* [x] SCXQ2 Pack Specification v1
* [x] SCXQ2 Encoding Rules (DICT16-B64)
* [x] SCXQ2 Decoding Law (formal inverse)
* [x] SCXQ2 ↔ CC-v1 Formal Mapping
* [x] SCXQ2 Security & Adversarial Model

### Verification

* [x] Error codes + deterministic failure ordering
* [x] Verifier options schema
* [x] Default policy profile
* [x] Reference verification algorithm (pseudocode)
* [x] Pack identity & canonical hashing rules

### Engine

* [x] JS encoder (reference)
* [x] WASM UTF-16 parity encoder
* [x] ccCompress / ccCompressSync WASM routing
* [x] Multi-lane support
* [x] SCXQ2 conformance vectors (including WASM parity)

### Brand

* [x] SCXQ2 master glyph (256×256)
* [x] SCXQ2 UI icon pack (24×24)
* [x] Naming + usage rules locked

---

## 2. Immediate TODO (Engineering)

These are **non-semantic**, safe to implement without touching the spec.

### Tooling

* [ ] `scxq2.verify()` reference implementation (JS)
* [ ] Streaming decoder (partial decode with output cap)
* [ ] Pack size / expansion estimator utility
* [ ] CLI: `scxq2 verify pack.json`
* [ ] CLI: `scxq2 decode pack.json --lane <id>`

### WASM

* [ ] WASM **decoder** (inverse of encoder)
* [ ] Streaming WASM decoder (chunked input)
* [ ] Shared WASM memory pooling for batch verify
* [ ] Node + Browser WASM loader helpers

### Testing

* [ ] Fuzz tests for decoder (invalid byte streams)
* [ ] Adversarial packs test suite
* [ ] Large-dict boundary tests (65,535 entries)
* [ ] Output-limit enforcement tests

---

## 3. Short-Term Integrations (ASX Stack)

### ASX / KUHUL

* [ ] Treat SCXQ2 packs as **first-class language objects**
* [ ] Add `scxq2.pack` to ASX registry
* [ ] KUHUL π: load SCXQ2 packs as immutable data
* [ ] Bind SCXQ2 verification to ASX runtime gates

### XJSON

* [ ] XJSON → SCXQ2 compiler path
* [ ] SCXQ2 → XJSON debug expansion (non-authoritative)
* [ ] XJSON schema snapshots compressed as SCXQ2

### Atomic / UI

* [ ] Bind SCXQ2 icons into `atomic.xjson`
* [ ] Use SCXQ2 pack hash as UI cache key
* [ ] Visual verifier panel (pass/fail + error code)

---

## 4. Medium-Term Integrations

### Storage & Distribution

* [ ] SCXQ2 packs as CDN artifacts (content-addressed)
* [ ] IndexedDB cache keyed by `pack_sha256_canon`
* [ ] KLH / Mesh broadcast of SCXQ2 packs
* [ ] Partial lane fetch & decode

### AI / ML

* [ ] SCXQ2 for tokenizer dictionaries
* [ ] SCXQ2-compressed prompt packs
* [ ] SCXQ2-compressed LoRA / symbolic weights
* [ ] SCXQ2 packs as RLHF training records

### Security

* [ ] Optional signature envelope (outside SCXQ2 core)
* [ ] SCXQ2 + SecuroLink provenance binding
* [ ] Audit logs referencing pack hashes

---

## 5. Future Research (v2+ — NOT LOCKED)

These are **explicitly out of scope** for v1.

### Encoding Evolution

* [ ] Wider index modes (DICT32)
* [ ] Alternate literal markers
* [ ] Binary lane packing (non-JSON envelope)

### Calculus Extensions

* [ ] Additional CC operators (beyond FIELD/LANE/EDGE)
* [ ] Probabilistic or weighted dictionaries
* [ ] Cross-pack dictionary inheritance

### Performance

* [ ] SIMD-accelerated decoders
* [ ] GPU decode experiments
* [ ] Hardware-assisted dictionary lookup

> Any of the above requires **new `mode` / `encoding` identifiers** and **must not mutate v1 semantics**.

---

## 6. Governance Rules (Important)

* **SCXQ2 v1 is immutable**
* Any change requires:

  * New version
  * New conformance vectors
  * New verifier profile
* Tooling may evolve freely
* Specs do not

---

## 7. Definition of "Done"

SCXQ2 is considered **production-complete** when:

* Reference verifier is implemented
* WASM decoder exists
* CLI tools exist
* ASX runtime consumes packs natively
* No spec changes are pending

At that point, SCXQ2 becomes **infrastructure**, not a project.

---

## 8. Final Statement

> SCXQ2 is no longer an experiment.
> It is a **language-level compression calculus** with frozen semantics,
> deterministic verification, and a defined future.

Everything after this is integration.
