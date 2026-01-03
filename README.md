<p align="center">
  <img src="scxq2-logo.svg" alt="SCXQ2 Logo" width="200" height="200">
</p>

<h1 align="center">SCXQ2</h1>

<p align="center">
  <strong>Compression Calculus Engine</strong><br>
  Deterministic, Proof-Generating, Content-Addressable Language Packs
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#api">API</a> •
  <a href="#specification">Specification</a> •
  <a href="#security">Security</a>
</p>

---

## Overview

SCXQ2 is a **frozen, deterministic compression calculus** that produces **content-addressable language packs**. It implements CC-v1 (Compression Calculus v1) operators to create self-verifying artifacts with cryptographic proofs of reversibility.

### Key Features

- **Deterministic** - Same input always produces identical output
- **Content-Addressable** - SHA-256 identity hashes for all artifacts
- **Proof-Generating** - Every compression includes reversibility proof
- **Universal Runtime** - Works in Node.js, browsers, and workers
- **Multi-Lane** - Compress multiple sources with shared dictionary
- **Type-Safe** - Full TypeScript definitions included

### What SCXQ2 Is

- A **representation algebra** for compressing text
- A **language artifact** format (dict + block + proof)
- A **deterministic encoding** (DICT16-B64)

### What SCXQ2 Is NOT

- ❌ Not encryption
- ❌ Not a file format
- ❌ Not a transport protocol
- ❌ Not an execution language

---

## Installation

```bash
npm install @asx/scxq2-cc
```

**Requirements:** Node.js 18+ or modern browser with WebCrypto

---

## Quick Start

### Basic Compression

```javascript
import { ccCompress, ccDecompress } from '@asx/scxq2-cc';

// Compress source code
const source = `
function hello() {
  console.log("Hello, World!");
}
`;

const pack = await ccCompress(source, { maxDict: 512 });

console.log(pack.proof.ok);           // true - roundtrip verified
console.log(pack.dict.dict.length);   // number of dictionary entries
console.log(pack.audit.sizes.ratio);  // compression ratio

// Decompress
const roundtrip = ccDecompress(pack.dict, pack.block);
console.log(roundtrip === source);    // true
```

### Multi-Lane Compression

```javascript
import { ccCompressLanes, ccDecompress } from '@asx/scxq2-cc';

const pack = await ccCompressLanes({
  lanes: [
    { lane_id: 'index', text: 'export * from "./utils";' },
    { lane_id: 'utils', text: 'export function utils() { return 42; }' },
    { lane_id: 'types', text: 'export interface Config { value: number; }' }
  ]
});

// All lanes share the same dictionary
console.log(pack.dict.dict.length);    // shared dictionary size
console.log(pack.lanes.length);        // 3 blocks

// Decompress each lane
for (const block of pack.lanes) {
  const text = ccDecompress(pack.dict, block);
  console.log(`Lane ${block.lane_id}: ${text.length} chars`);
}
```

### Synchronous API (Node.js only)

```javascript
import { ccCompressSync, ccCompressLanesSync } from '@asx/scxq2-cc';

// Sync single-lane
const pack = ccCompressSync(source);

// Sync multi-lane
const multiPack = ccCompressLanesSync({ lanes: [...] });
```

---

## API

### Core Functions

| Function | Description |
|----------|-------------|
| `ccCompress(input, opts?)` | Async compression with proof |
| `ccCompressSync(input, opts?)` | Sync compression (Node.js only) |
| `ccCompressLanes(input, opts?)` | Async multi-lane compression |
| `ccCompressLanesSync(input, opts?)` | Sync multi-lane (Node.js only) |
| `ccDecompress(dict, block)` | Decompress block using dictionary |
| `verifyPack(dict, block)` | Verify pack structure |

### Compression Options

```typescript
interface CCCompressOptions {
  maxDict?: number;        // Max dictionary entries (1-65535, default: 1024)
  minLen?: number;         // Min token length (2-128, default: 3)
  noStrings?: boolean;     // Skip string literal tokens
  noWS?: boolean;          // Skip whitespace tokens
  noPunct?: boolean;       // Skip punctuation tokens
  enableFieldOps?: boolean; // Enable JSON key extraction
  enableEdgeOps?: boolean; // Enable edge witnesses
  created_utc?: string;    // ISO timestamp
  source_file?: string;    // Source identifier
}
```

### Result Objects

```typescript
interface CCResult {
  dict: SCXQ2Dict;    // Dictionary with token array
  block: SCXQ2Block;  // Encoded block with b64 payload
  proof: CCProof;     // Reversibility proof
  audit: CCAudit;     // Compression metrics
}
```

### Utility Functions

```javascript
import {
  canon,           // Canonical JSON serialization
  sha256HexUtf8,   // Async SHA-256 hash
  bytesToBase64,   // Encode bytes to base64
  base64ToBytes    // Decode base64 to bytes
} from '@asx/scxq2-cc';
```

---

## Encoding Format

SCXQ2 uses a simple bytecode format:

| Byte | Meaning |
|------|---------|
| `0x00-0x7F` | ASCII literal (1 byte) |
| `0x80 [hi] [lo]` | Dictionary reference (3 bytes) |
| `0x81 [hi] [lo]` | UTF-16 code unit (3 bytes) |

### Dictionary Properties

- Maximum 65,535 entries (16-bit index)
- Ordered longest-first for greedy matching
- UTF-16 code-unit indexed
- Immutable once sealed

---

## Specification

SCXQ2 implements the frozen **CC-v1 (Compression Calculus v1)** specification.

### Invariants (Non-Negotiable)

1. **Deterministic Canonical Form** - Canonical JSON, stable UTF-8
2. **Reversibility** - Every block losslessly decodable
3. **Single-Hash Identity** - One SHA-256 identifies entire pack
4. **No Runtime Authority** - No execution, IO, or environment semantics
5. **Lane Isolation** - Blocks independent except shared dictionary
6. **Proof-Bound** - Proof inseparable from content
7. **Compression-Only** - Never introduces meaning, only representation

### Pack Structure

```
SCXQ2 PACK
├── Dictionary (shared)
├── Blocks[] (lanes)
│   ├── Encoded byte stream (b64)
│   ├── Optional lane_id
│   └── Optional edges (EDGE witnesses)
├── Proof
└── pack_sha256_canon (identity)
```

### CC Operators

| Operator | Purpose |
|----------|---------|
| `CC.NORM` | Normalize newlines, optional whitespace policy |
| `CC.DICT` | Extract dictionary from token stream |
| `CC.FIELD` | Structural JSON key augmentation |
| `CC.LANE` | Multi-lane product construction |
| `CC.EDGE` | Adjacency witnesses for analysis |

---

## Security

SCXQ2 is **compression representation**, not encryption.

### Threat Mitigations

- **Memory Safety** - No out-of-bounds access, bounded allocations
- **Time Safety** - O(n) decode time, predictable worst-case
- **Deterministic Failure** - Stable error codes, fail-closed
- **Integrity** - SHA-256 identity prevents silent mutation

### Decompression Bomb Protection

Set `maxOutputUnits` to limit decoded output size:

```javascript
// Verifier with output limit
const result = await ccCompress(input, {
  maxDict: 1024
  // Implementation can add maxOutputUnits for decode limits
});
```

### Security Non-Goals

SCXQ2 does NOT provide:
- Confidentiality
- Authentication
- Authorization
- Tamper-proofing against hash recomputation

---

## Error Codes

| Code | Phase | Description |
|------|-------|-------------|
| `scxq2.error.pack_*` | pack | Pack structure errors |
| `scxq2.error.dict_*` | dict | Dictionary errors |
| `scxq2.error.block_*` | block | Block errors |
| `scxq2.error.decode_*` | decode | Decoding errors |
| `scxq2.error.proof_*` | proof | Proof verification errors |

---

## Project Structure

```
scxq2-cc/
├── package.json
├── README.md
├── BRAND.md              # Brand guidelines
├── SCXQ2_language.md     # Full language specification
├── SCXQ2_CC_ENGINE_V1.md # Engine specification
├── NPM.md                # NPM module documentation
├── scxq2-logo.svg        # Logo
├── src/
│   ├── index.js          # Main entry point
│   ├── engine.js         # Core CC engine
│   ├── canon.js          # Canonical JSON
│   ├── sha.js            # SHA-256 utilities
│   └── base64.js         # Base64 utilities
└── dist/
    ├── index.js          # Built entry point
    ├── index.d.ts        # TypeScript definitions
    └── ...
```

---

## Constants

```javascript
import { CC_ENGINE, SCXQ2_ENCODING, CC_OPS } from '@asx/scxq2-cc';

console.log(CC_ENGINE['@id']);
// "asx://cc/engine/scxq2.v1"

console.log(SCXQ2_ENCODING);
// { mode: "SCXQ2-DICT16-B64", encoding: "SCXQ2-1" }

console.log(CC_OPS);
// { NORM: "cc.norm.v1", DICT: "cc.dict.v1", ... }
```

---

## Final Law

> **If two SCXQ2 packs have the same `pack_sha256_canon`, they are the same language object.**

Everything else is projection.

---

## License

MIT

---

## Links

- [SCXQ2 Language Specification](./SCXQ2_language.md)
- [CC Engine Specification](./SCXQ2_CC_ENGINE_V1.md)
- [NPM Module Documentation](./NPM.md)
- [Brand Guidelines](./BRAND.md)
