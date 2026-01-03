#!/usr/bin/env node
/**
 * SCXQ2 CLI
 *
 * Commands:
 *   verify <pack.json>             - Verify pack integrity
 *   decode <pack.json> [--lane ID] - Decode block to stdout
 *   inspect <pack.json>            - Print pack summary
 *
 * @version 1.0.0
 */

import fs from "fs";
import path from "path";
import { scxq2PackVerify, scxq2DecodeUtf16, SCXQ2_DEFAULT_POLICY } from "./verify.js";

/* =============================================================================
   Helpers
============================================================================= */

function usage() {
  console.log(`
scxq2 <command> [args]

Commands:
  verify <pack.json>               Verify pack (default policy)
  decode <pack.json> [--lane ID]   Decode first block or matching lane_id
  inspect <pack.json>              Print pack summary (hashes, lanes, sizes)

Flags:
  --no-roundtrip       Skip roundtrip verification
  --no-proof           Skip proof verification
  --maxOutputUnits N   Set max output code units

Examples:
  scxq2 verify mypack.json
  scxq2 decode mypack.json --lane main
  scxq2 inspect mypack.json
`);
  process.exit(2);
}

function readJson(fp) {
  try {
    const s = fs.readFileSync(fp, "utf8");
    return JSON.parse(s);
  } catch (e) {
    console.error(`Error reading ${fp}: ${e.message}`);
    process.exit(1);
  }
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
    } else {
      const k = a.slice(2);
      const v = (i + 1 < argv.length && !argv[i + 1].startsWith("--"))
        ? argv[++i]
        : true;
      out[k] = v;
    }
  }
  return out;
}

function applyPolicyFlags(args) {
  const p = { ...SCXQ2_DEFAULT_POLICY };
  if (args["no-roundtrip"]) p.requireRoundtrip = false;
  if (args["no-proof"]) p.requireProof = false;
  if (args.maxOutputUnits) p.maxOutputUnits = Number(args.maxOutputUnits);
  return p;
}

function b64ToBytes(b64) {
  return Buffer.from(b64, "base64");
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* =============================================================================
   Commands
============================================================================= */

function cmdVerify(pack, policy) {
  const res = scxq2PackVerify(pack, policy);
  if (!res.ok) {
    console.error(JSON.stringify(res, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

function cmdInspect(pack) {
  const blocks = pack.blocks || [];
  const lanes = blocks.map((b, i) => ({
    index: i,
    lane_id: b.lane_id ?? null,
    b64_bytes: b.b64 ? Buffer.from(b.b64, "base64").length : null,
    original_bytes: b.original_bytes_utf8 ?? null,
    block_sha: b.block_sha256_canon?.slice(0, 16) + "..." ?? null
  }));

  const dictSize = pack.dict?.dict?.length ?? 0;
  const totalB64 = blocks.reduce((acc, b) => acc + (b.b64 ? Buffer.from(b.b64, "base64").length : 0), 0);

  const summary = {
    pack_sha256_canon: pack.pack_sha256_canon ?? null,
    dict_sha256_canon: pack.dict?.dict_sha256_canon ?? null,
    dict_entries: dictSize,
    blocks: lanes.length,
    total_encoded_bytes: totalB64,
    total_encoded_display: formatBytes(totalB64),
    lanes
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

function cmdDecode(pack, policy, laneId) {
  const blocks = pack.blocks || [];

  if (!blocks.length) {
    console.error("Error: no blocks in pack");
    process.exit(1);
  }

  let block = blocks[0];

  if (laneId != null && laneId !== true) {
    const hit = blocks.find(x => String(x.lane_id) === String(laneId));
    if (!hit) {
      console.error(`Error: lane not found: ${laneId}`);
      console.error(`Available lanes: ${blocks.map(b => b.lane_id ?? "(unnamed)").join(", ")}`);
      process.exit(1);
    }
    block = hit;
  }

  const bytes = b64ToBytes(block.b64);
  const dec = scxq2DecodeUtf16(pack.dict.dict, bytes, { maxOutputUnits: policy.maxOutputUnits });

  if (!dec.ok) {
    console.error(JSON.stringify(dec, null, 2));
    process.exit(1);
  }

  process.stdout.write(dec.value);
  process.exit(0);
}

/* =============================================================================
   Main
============================================================================= */

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
const file = args._[1];

if (!cmd) usage();
if (cmd === "help" || cmd === "--help" || cmd === "-h") usage();
if (!file) {
  console.error("Error: missing pack file argument");
  usage();
}

const pack = readJson(file);
const policy = applyPolicyFlags(args);

switch (cmd) {
  case "verify":
    cmdVerify(pack, policy);
    break;
  case "inspect":
    cmdInspect(pack);
    break;
  case "decode":
    cmdDecode(pack, policy, args.lane);
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    usage();
}
