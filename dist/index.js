/**
 * @asx/scxq2-cc - SCXQ2 Compression Calculus Engine
 *
 * A deterministic, proof-generating compression engine that produces
 * content-addressable language packs following the frozen SCXQ2 specification.
 *
 * @module @asx/scxq2-cc
 * @version 1.0.0
 *
 * @example
 * // Basic compression
 * import { ccCompress, ccDecompress } from '@asx/scxq2-cc';
 *
 * const pack = await ccCompress('function hello() { console.log("Hello"); }');
 * console.log(pack.proof.ok); // true
 *
 * const roundtrip = ccDecompress(pack.dict, pack.block);
 * // roundtrip === original input
 *
 * @example
 * // Multi-lane compression
 * import { ccCompressLanes } from '@asx/scxq2-cc';
 *
 * const pack = await ccCompressLanes({
 *   lanes: [
 *     { lane_id: 'main', text: 'function main() {}' },
 *     { lane_id: 'util', text: 'function util() {}' }
 *   ]
 * });
 */

// Re-export engine API
export {
  CC_ENGINE,
  SCXQ2_ENCODING,
  CC_OPS,
  ccCompress,
  ccCompressSync,
  ccCompressLanes,
  ccCompressLanesSync,
  ccDecompress,
  verifyPack
} from "./engine.js";

// Re-export utilities for advanced use
export { canon, sortKeysDeep, strip } from "./canon.js";
export { sha256HexUtf8, sha256HexUtf8Sync, getNodeCrypto } from "./sha.js";
export { bytesToBase64, base64ToBytes, isValidBase64 } from "./base64.js";

// Re-export verifier API
export {
  scxq2PackVerify,
  scxq2DecodeUtf16,
  SCXQ2_DEFAULT_POLICY
} from "./verify.js";

// Re-export WASM decoder utilities
export {
  scxq2LoadWasm,
  scxq2LoadWasmFromUrl,
  scxq2CreateWasmUtf16Decoder,
  createDecoderRouter
} from "./wasm-decoder.js";
