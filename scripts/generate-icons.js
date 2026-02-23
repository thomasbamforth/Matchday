#!/usr/bin/env node
/**
 * Generates public/icon-192.png and public/icon-512.png.
 *
 * Aubergine (#2D0A31) background with a hot-pink (#FF2D7A) pixel-art "M".
 * No npm deps — uses only Node.js built-ins (zlib, fs).
 *
 * Run: node scripts/generate-icons.js
 */

const zlib = require("zlib");
const fs   = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// CRC32 (required by the PNG spec for chunk integrity)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// PNG chunk builder
// ---------------------------------------------------------------------------

function chunk(type, data) {
  const t   = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcVal]);
}

// ---------------------------------------------------------------------------
// Pixel-art "M" — 12 × 9 grid, scaled + centred inside the canvas
// ---------------------------------------------------------------------------
//
//  #           #
//  ##         ##
//  ###       ###
//  # ##     ## #
//  #  ##   ##  #
//  #   ## ##   #
//  #    ###    #
//  #           #
//  #           #
//
const M_GRID = [
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,0,0,0,0,0,0,0,0,1,1],
  [1,1,1,0,0,0,0,0,0,1,1,1],
  [1,0,1,1,0,0,0,0,1,1,0,1],
  [1,0,0,1,1,0,0,1,1,0,0,1],
  [1,0,0,0,1,1,1,1,0,0,0,1],
  [1,0,0,0,0,1,1,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,1],
];

const M_ROWS = M_GRID.length;
const M_COLS = M_GRID[0].length;

// ---------------------------------------------------------------------------
// PNG generator
// ---------------------------------------------------------------------------

function makePNG(size, [bgR, bgG, bgB], [fgR, fgG, fgB]) {
  // Scale the M to ~60 % of the canvas
  const scale   = Math.max(1, Math.floor((size * 0.6) / M_COLS));
  const mW      = M_COLS * scale;
  const mH      = M_ROWS * scale;
  const offsetX = Math.floor((size - mW) / 2);
  const offsetY = Math.floor((size - mH) / 2);

  // Build raw scanlines: each row = 0x00 (filter None) + RGB bytes
  const raw = Buffer.alloc(size * (1 + size * 3));
  let pos = 0;

  for (let y = 0; y < size; y++) {
    raw[pos++] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const mx = Math.floor((x - offsetX) / scale);
      const my = Math.floor((y - offsetY) / scale);
      const fg =
        mx >= 0 && mx < M_COLS && my >= 0 && my < M_ROWS && M_GRID[my][mx] === 1;
      raw[pos++] = fg ? fgR : bgR;
      raw[pos++] = fg ? fgG : bgG;
      raw[pos++] = fg ? fgB : bgB;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 2; // colour type: RGB
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Write both sizes
// ---------------------------------------------------------------------------

const BG = [0x2d, 0x0a, 0x31]; // #2D0A31 aubergine
const FG = [0xff, 0x2d, 0x7a]; // #FF2D7A hot pink

const outDir = path.join(__dirname, "..", "public");

for (const size of [192, 512]) {
  const buf  = makePNG(size, BG, FG);
  const file = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(file, buf);
  console.log(`✓ ${file}  (${buf.length} bytes)`);
}
