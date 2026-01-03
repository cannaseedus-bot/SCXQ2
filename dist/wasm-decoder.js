/**
 * SCXQ2 WASM Decoder Wrapper
 *
 * Wraps a WASM decoder implementation for the SCXQ2 UTF-16 inverse.
 * Provides the same interface as the JS decoder for drop-in replacement.
 *
 * @module @asx/scxq2-cc/wasm-decoder
 * @version 1.0.0
 */

/* =============================================================================
   WASM Error Codes (Contract)
============================================================================= */

const WASM_ERR = {
  INVALID_BYTE: -1,
  TRUNCATED: -2,
  DICT_OOB: -3,
  OUTPUT_LIMIT: -4
};

/* =============================================================================
   WASM Loader
============================================================================= */

/**
 * Loads WASM module from bytes.
 *
 * @param {ArrayBuffer|Uint8Array} wasmBytes - WASM binary
 * @returns {Promise<WebAssembly.Instance>} WASM instance
 */
export async function scxq2LoadWasm(wasmBytes) {
  const mod = await WebAssembly.instantiate(wasmBytes, {});
  return mod.instance;
}

/**
 * Loads WASM module from URL (browser/Deno).
 *
 * @param {string} url - URL to WASM file
 * @returns {Promise<WebAssembly.Instance>} WASM instance
 */
export async function scxq2LoadWasmFromUrl(url) {
  const response = await fetch(url);
  const bytes = await response.arrayBuffer();
  return scxq2LoadWasm(bytes);
}

/* =============================================================================
   WASM Decoder Factory
============================================================================= */

/**
 * Creates a WASM-backed UTF-16 decoder.
 *
 * Required WASM exports:
 * - memory: WebAssembly.Memory
 * - alloc(n: i32) -> i32
 * - free(p: i32, n: i32) -> void (optional)
 * - decode_utf16(dictPtr, dictLen, bytesPtr, bytesLen, outPtr, outCap) -> i32
 *
 * @param {WebAssembly.Instance} wasmInstance - WASM instance with required exports
 * @returns {Object} Decoder object with decodeWithDict method
 */
export function scxq2CreateWasmUtf16Decoder(wasmInstance) {
  const { exports } = wasmInstance;

  if (!exports || !exports.memory || !exports.alloc || !exports.decode_utf16) {
    throw new Error("SCXQ2 WASM: missing required exports (memory, alloc, decode_utf16)");
  }

  const memU8 = () => new Uint8Array(exports.memory.buffer);
  const memU16 = () => new Uint16Array(exports.memory.buffer);

  function writeBytes(ptr, bytes) {
    memU8().set(bytes, ptr);
  }

  /**
   * Writes dictionary to WASM memory in flat UTF-16 format.
   *
   * Layout:
   *   [u32 count]
   *   [u32 offsets[count+1]]  (offsets in u16 units from data start)
   *   [u16 data...]
   */
  function writeDictUTF16Flat(dictArr) {
    const count = dictArr.length;

    // Build offsets and data
    const offsets = new Uint32Array(count + 1);
    const u16Chunks = [];
    let cursor = 0;

    for (let i = 0; i < count; i++) {
      offsets[i] = cursor;
      const s = dictArr[i];
      const u16 = new Uint16Array(s.length);
      for (let j = 0; j < s.length; j++) {
        u16[j] = s.charCodeAt(j);
      }
      u16Chunks.push(u16);
      cursor += u16.length;
    }
    offsets[count] = cursor;

    // Calculate sizes
    const headerBytes = 4 + (count + 1) * 4;
    const dataBytes = cursor * 2;
    const totalBytes = headerBytes + dataBytes;

    // Allocate and write
    const ptr = exports.alloc(totalBytes);
    const u8 = memU8();

    // Write count (u32 LE)
    u8[ptr + 0] = (count >>> 0) & 0xff;
    u8[ptr + 1] = (count >>> 8) & 0xff;
    u8[ptr + 2] = (count >>> 16) & 0xff;
    u8[ptr + 3] = (count >>> 24) & 0xff;

    // Write offsets table
    let offPtr = ptr + 4;
    for (let i = 0; i < offsets.length; i++) {
      const v = offsets[i] >>> 0;
      u8[offPtr + 0] = v & 0xff;
      u8[offPtr + 1] = (v >>> 8) & 0xff;
      u8[offPtr + 2] = (v >>> 16) & 0xff;
      u8[offPtr + 3] = (v >>> 24) & 0xff;
      offPtr += 4;
    }

    // Write data (u16 LE)
    const dataStart = ptr + headerBytes;
    const u16 = memU16();
    let u16Pos = dataStart >> 1;
    for (const chunk of u16Chunks) {
      u16.set(chunk, u16Pos);
      u16Pos += chunk.length;
    }

    return { ptr, lenBytes: totalBytes };
  }

  /**
   * Decodes SCXQ2 bytes using dictionary via WASM.
   *
   * @param {string[]} dictArr - Dictionary array
   * @param {Uint8Array} bytes - Encoded bytes
   * @param {number} [maxOutputUnits=134217728] - Max output code units
   * @returns {{ok: true, value: string}|{ok: false, kind: string, byte_offset: number}}
   */
  function decodeWithDict(dictArr, bytes, maxOutputUnits = 134217728) {
    // Write dictionary to WASM memory
    const dictFlat = writeDictUTF16Flat(dictArr);

    // Write bytes to WASM memory
    const bytesPtr = exports.alloc(bytes.length);
    writeBytes(bytesPtr, bytes);

    // Allocate output buffer
    const outCap = maxOutputUnits;
    const outPtr = exports.alloc(outCap * 2);

    // Call WASM decoder
    const rc = exports.decode_utf16(
      dictFlat.ptr, dictFlat.lenBytes,
      bytesPtr, bytes.length,
      outPtr, outCap
    );

    // Free memory if available
    if (exports.free) {
      exports.free(dictFlat.ptr, dictFlat.lenBytes);
      exports.free(bytesPtr, bytes.length);
      exports.free(outPtr, outCap * 2);
    }

    // Handle success
    if (rc >= 0) {
      const u16 = memU16().subarray(outPtr >> 1, (outPtr >> 1) + rc);
      // Convert u16 to JS string in chunks to avoid stack overflow
      let s = "";
      const CHUNK = 8192;
      for (let i = 0; i < u16.length; i += CHUNK) {
        s += String.fromCharCode(...u16.subarray(i, Math.min(u16.length, i + CHUNK)));
      }
      return { ok: true, value: s };
    }

    // Map error codes
    if (rc === WASM_ERR.INVALID_BYTE) {
      return { ok: false, kind: "invalid_byte", byte_offset: 0 };
    }
    if (rc === WASM_ERR.TRUNCATED) {
      return { ok: false, kind: "truncated_sequence", byte_offset: 0 };
    }
    if (rc === WASM_ERR.DICT_OOB) {
      return { ok: false, kind: "dict_index_oob", byte_offset: 0 };
    }
    if (rc === WASM_ERR.OUTPUT_LIMIT) {
      return { ok: false, kind: "output_limit", byte_offset: bytes.length ? bytes.length - 1 : 0 };
    }

    return { ok: false, kind: "decode_internal", byte_offset: 0 };
  }

  return { decodeWithDict };
}

/* =============================================================================
   Decoder Router (JS or WASM)
============================================================================= */

/**
 * Creates a decoder that routes to JS or WASM implementation.
 *
 * @param {Object} opts - Decoder options
 * @param {string} opts.kind - "js" or "wasm_utf16"
 * @param {WebAssembly.Instance} [opts.wasmInstance] - WASM instance (required for wasm_utf16)
 * @param {Function} jsDecode - JS decode function fallback
 * @returns {Function} Decoder function
 */
export function createDecoderRouter(opts, jsDecode) {
  if (opts?.kind === "wasm_utf16" && opts.wasmInstance) {
    const wasmDecoder = scxq2CreateWasmUtf16Decoder(opts.wasmInstance);
    return (dictArr, bytes, limits) => {
      return wasmDecoder.decodeWithDict(dictArr, bytes, limits?.maxOutputUnits);
    };
  }
  return jsDecode;
}
