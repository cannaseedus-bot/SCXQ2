/**
 * @asx/scxq2-cc - SCXQ2 Compression Calculus Engine
 * TypeScript Type Definitions
 *
 * @version 1.0.0
 */

/* =============================================================================
   Engine Constants
============================================================================= */

/**
 * CC Engine identity object (frozen)
 */
export declare const CC_ENGINE: Readonly<{
  "@id": "asx://cc/engine/scxq2.v1";
  "@type": "cc.engine";
  "@version": "1.0.0";
  "@status": "frozen";
  "$schema": "xjson://schema/core/v1";
}>;

/**
 * SCXQ2 encoding mode constants (frozen)
 */
export declare const SCXQ2_ENCODING: Readonly<{
  mode: "SCXQ2-DICT16-B64";
  encoding: "SCXQ2-1";
}>;

/**
 * CC operator identifiers (frozen)
 */
export declare const CC_OPS: Readonly<{
  NORM: "cc.norm.v1";
  DICT: "cc.dict.v1";
  FIELD: "cc.field.v1";
  LANE: "cc.lane.v1";
  EDGE: "cc.edge.v1";
}>;

/* =============================================================================
   Compression Options
============================================================================= */

/**
 * Options for compression operations
 */
export interface CCCompressOptions {
  /** Maximum dictionary entries (1-65535, default: 1024) */
  maxDict?: number;
  /** Minimum token length (2-128, default: 3) */
  minLen?: number;
  /** Skip string literal tokens */
  noStrings?: boolean;
  /** Skip whitespace tokens */
  noWS?: boolean;
  /** Skip punctuation tokens */
  noPunct?: boolean;
  /** Enable JSON key extraction (CC.FIELD operator) */
  enableFieldOps?: boolean;
  /** Enable edge witnesses (CC.EDGE operator) */
  enableEdgeOps?: boolean;
  /** ISO timestamp (auto-generated if omitted) */
  created_utc?: string;
  /** Source file identifier */
  source_file?: string | null;
}

/**
 * Flags indicating which token types were processed
 */
export interface SCXQ2Flags {
  noStrings: boolean;
  noWS: boolean;
  noPunct: boolean;
}

/* =============================================================================
   SCXQ2 Dictionary
============================================================================= */

/**
 * SCXQ2 Dictionary object
 */
export interface SCXQ2Dict {
  "@type": "scxq2.dict";
  "@version": string;
  mode: "SCXQ2-DICT16-B64";
  encoding: "SCXQ2-1";
  created_utc: string;
  source_sha256_utf8: string;
  max_dict: number;
  min_len: number;
  flags: SCXQ2Flags;
  dict: string[];
  dict_sha256_canon: string;
}

/* =============================================================================
   SCXQ2 Block
============================================================================= */

/**
 * Edge witness tuple [from_index, to_index]
 */
export type EdgeWitness = [number, number];

/**
 * SCXQ2 Block object
 */
export interface SCXQ2Block {
  "@type": "scxq2.block";
  "@version": string;
  mode: "SCXQ2-DICT16-B64";
  encoding: "SCXQ2-1";
  created_utc: string;
  source_sha256_utf8: string;
  dict_sha256_canon: string;
  original_bytes_utf8: number;
  b64: string;
  block_sha256_canon: string;
  /** Lane identifier (multi-lane packs only) */
  lane_id?: string;
  /** Edge witnesses (when enableEdgeOps is true) */
  edges?: EdgeWitness[];
}

/* =============================================================================
   CC Proof
============================================================================= */

/**
 * Proof step in the compression trace
 */
export interface CCProofStep {
  op: string;
  sha?: string;
  dict_entries?: number;
  block_sha?: string;
  roundtrip_sha?: string;
}

/**
 * Compression Calculus proof object
 */
export interface CCProof {
  "@type": "cc.proof";
  "@version": string;
  engine: string;
  created_utc: string;
  source_sha256_utf8: string;
  dict_sha256_canon: string;
  block_sha256_canon: string;
  roundtrip_sha256_utf8: string;
  ok: boolean;
  steps: CCProofStep[];
}

/**
 * Multi-lane proof object
 */
export interface CCLanesProof {
  "@type": "cc.lanes.proof";
  "@version": string;
  engine: string;
  created_utc: string;
  dict_sha256_canon: string;
  lanes: Array<{
    lane_id: string;
    source_sha256_utf8: string;
    block_sha256_canon: string;
  }>;
  ok: boolean;
  steps?: CCProofStep[];
}

/* =============================================================================
   CC Audit
============================================================================= */

/**
 * Top token info for audit
 */
export interface TokenInfo {
  tok: string;
  count: number;
  totalSavings: number;
}

/**
 * Compression audit object
 */
export interface CCAudit {
  "@type": "cc.audit";
  "@version": string;
  engine: string;
  created_utc: string;
  sizes: {
    original_bytes_utf8: number;
    encoded_b64_bytes_utf8: number;
    ratio: number | null;
  };
  dict: {
    entries: number;
    max_dict: number;
    min_len: number;
    flags: SCXQ2Flags;
  };
  top_tokens: TokenInfo[];
}

/**
 * Multi-lane audit object
 */
export interface CCLanesAudit {
  "@type": "cc.lanes.audit";
  "@version": string;
  engine: string;
  created_utc: string;
  dict_entries: number;
  lane_count: number;
}

/* =============================================================================
   Compression Results
============================================================================= */

/**
 * Single-lane compression result
 */
export interface CCResult {
  dict: SCXQ2Dict;
  block: SCXQ2Block;
  proof: CCProof;
  audit: CCAudit;
}

/**
 * Multi-lane compression result
 */
export interface CCLanesResult {
  dict: SCXQ2Dict;
  lanes: SCXQ2Block[];
  proof: CCLanesProof;
  audit: CCLanesAudit;
}

/**
 * Lane input for multi-lane compression
 */
export interface LaneInput {
  lane_id: string;
  text: string | Uint8Array;
}

/**
 * Multi-lane compression input
 */
export interface LanesInput {
  lanes: LaneInput[];
}

/* =============================================================================
   Main API Functions
============================================================================= */

/**
 * Compresses input text into an SCXQ2 language pack.
 * Uses async hashing for universal compatibility (Node.js, Browser, Worker).
 *
 * @param input - Source text or bytes to compress
 * @param opts - Compression options
 * @returns Promise resolving to compression result
 */
export declare function ccCompress(
  input: string | Uint8Array,
  opts?: CCCompressOptions
): Promise<CCResult>;

/**
 * Synchronous compression (Node.js only).
 *
 * @param input - Source text or bytes to compress
 * @param opts - Compression options
 * @returns Compression result
 * @throws If not running in Node.js
 */
export declare function ccCompressSync(
  input: string | Uint8Array,
  opts?: CCCompressOptions
): CCResult;

/**
 * Compresses multiple lanes with a shared dictionary.
 *
 * @param laneInput - Object containing array of lanes
 * @param opts - Compression options
 * @returns Promise resolving to multi-lane compression result
 */
export declare function ccCompressLanes(
  laneInput: LanesInput,
  opts?: CCCompressOptions
): Promise<CCLanesResult>;

/**
 * Synchronous multi-lane compression (Node.js only).
 *
 * @param laneInput - Object containing array of lanes
 * @param opts - Compression options
 * @returns Multi-lane compression result
 * @throws If not running in Node.js
 */
export declare function ccCompressLanesSync(
  laneInput: LanesInput,
  opts?: CCCompressOptions
): CCLanesResult;

/**
 * Decompresses an SCXQ2 block using its dictionary.
 *
 * @param dictJson - SCXQ2 dictionary object
 * @param blockJson - SCXQ2 block object
 * @returns Decompressed text
 * @throws On invalid pack or decoding error
 */
export declare function ccDecompress(
  dictJson: SCXQ2Dict,
  blockJson: SCXQ2Block
): string;

/**
 * Verifies structural validity of an SCXQ2 pack.
 *
 * @param dictJson - Dictionary object
 * @param blockJson - Block object
 * @returns Success indicator
 * @throws On verification failure
 */
export declare function verifyPack(
  dictJson: SCXQ2Dict,
  blockJson: SCXQ2Block
): { ok: true };

/* =============================================================================
   Utility Functions
============================================================================= */

/**
 * Produces canonical JSON string with sorted keys.
 *
 * @param obj - Object to serialize
 * @returns Canonical JSON string
 */
export declare function canon(obj: unknown): string;

/**
 * Recursively sorts object keys.
 *
 * @param value - Any value
 * @returns Value with sorted object keys
 */
export declare function sortKeysDeep<T>(value: T): T;

/**
 * Creates shallow copy excluding specified fields.
 *
 * @param obj - Source object
 * @param fields - Fields to exclude
 * @returns New object without excluded fields
 */
export declare function strip<T extends object>(
  obj: T,
  fields: string[]
): Partial<T>;

/**
 * Computes SHA-256 hash of UTF-8 text (async).
 *
 * @param text - Text to hash
 * @returns Promise resolving to hex-encoded hash
 */
export declare function sha256HexUtf8(text: string): Promise<string>;

/**
 * Computes SHA-256 hash of UTF-8 text (sync, Node.js only).
 *
 * @param text - Text to hash
 * @param nodeCrypto - Optional pre-imported crypto module
 * @returns Hex-encoded hash
 */
export declare function sha256HexUtf8Sync(
  text: string,
  nodeCrypto?: unknown
): string;

/**
 * Gets Node.js crypto module if available.
 *
 * @returns Crypto module or null
 */
export declare function getNodeCrypto(): unknown | null;

/**
 * Encodes bytes to base64 string.
 *
 * @param bytes - Bytes to encode
 * @returns Base64-encoded string
 */
export declare function bytesToBase64(bytes: Uint8Array | number[]): string;

/**
 * Decodes base64 string to bytes.
 *
 * @param b64 - Base64-encoded string
 * @returns Decoded bytes
 */
export declare function base64ToBytes(b64: string): Uint8Array;

/**
 * Validates that a string is valid base64.
 *
 * @param b64 - String to validate
 * @returns True if valid base64
 */
export declare function isValidBase64(b64: string): boolean;
