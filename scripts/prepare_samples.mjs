/**
 * Zero-dependency Node.js v24 script to generate realistic Indonesian culinary
 * sample images (PNG), sample tracking videos (RIFF AVI + PNG frame sequences),
 * and ground-truth annotations in samples/sample_catalog.json.
 *
 * Usage: node scripts/prepare_samples.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT_DIR, 'samples', 'images');
const VIDEOS_DIR = path.join(ROOT_DIR, 'samples', 'videos');
const FRAMES_DIR = path.join(VIDEOS_DIR, 'frames');
const CATALOG_PATH = path.join(ROOT_DIR, 'samples', 'sample_catalog.json');

export const CULINARY_CLASSES = [
  { id: 0, name: 'Nasi Goreng', slug: 'nasi-goreng', color: '#E67E22', category: 'Makanan Pokok', region_origin: 'Nusantara' },
  { id: 1, name: 'Bakso', slug: 'bakso', color: '#7F8C8D', category: 'Berkuah', region_origin: 'Jawa Tengah / Jawa Timur' },
  { id: 2, name: 'Sate Ayam', slug: 'sate-ayam', color: '#D35400', category: 'Panggang', region_origin: 'Madura, Jawa Timur' },
  { id: 3, name: 'Rendang', slug: 'rendang', color: '#6E2C00', category: 'Lauk Utama', region_origin: 'Minangkabau, Sumatera Barat' },
  { id: 4, name: 'Soto Ayam', slug: 'soto-ayam', color: '#F1C40F', category: 'Berkuah', region_origin: 'Lamongan / Jawa' },
  { id: 5, name: 'Ayam Goreng', slug: 'ayam-goreng', color: '#CA6F1E', category: 'Lauk Utama', region_origin: 'Nusantara' },
  { id: 6, name: 'Mie Goreng', slug: 'mie-goreng', color: '#F39C12', category: 'Makanan Pokok', region_origin: 'Jawa / Nusantara' },
  { id: 7, name: 'Tempe Goreng', slug: 'tempe-goreng', color: '#B7950B', category: 'Lauk Pendamping', region_origin: 'Jawa' },
  { id: 8, name: 'Tahu Goreng', slug: 'tahu-goreng', color: '#F5B041', category: 'Lauk Pendamping', region_origin: 'Jawa' },
  { id: 9, name: 'Gado-Gado', slug: 'gado-gado', color: '#27AE60', category: 'Sayuran', region_origin: 'Betawi, DKI Jakarta' },
  { id: 10, name: 'Pempek', slug: 'pempek', color: '#D4AC0D', category: 'Kudapan', region_origin: 'Palembang, Sumatera Selatan' },
  { id: 11, name: 'Telur Balado', slug: 'telur-balado', color: '#C0392B', category: 'Lauk Pendamping', region_origin: 'Minangkabau, Sumatera Barat' },
];

const CLASS_BY_NAME = Object.fromEntries(CULINARY_CLASSES.map((c) => [c.name, c]));

// Deterministic PRNG (Mulberry32)
function createRng(seed) {
  let state = seed >>> 0;
  return function rng() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// CRC32 table for PNG encoding
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type 0 (None)
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, rowStart + 1);
  }
  const idatData = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idatData),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Pure JS 2D rasterizer for drawing realistic culinary illustrations.
 */
class RasterCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
    this.fillSolid(36, 26, 20, 255);
  }

  fillSolid(r, g, b, a = 255) {
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = a;
    }
  }

  blendPixel(x, y, r, g, b, alpha) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height || alpha <= 0) return;
    const idx = (y * this.width + x) * 4;
    const a = Math.min(1, Math.max(0, alpha));
    const inv = 1 - a;
    this.data[idx] = Math.round(this.data[idx] * inv + r * a);
    this.data[idx + 1] = Math.round(this.data[idx + 1] * inv + g * a);
    this.data[idx + 2] = Math.round(this.data[idx + 2] * inv + b * a);
    this.data[idx + 3] = 255;
  }

  drawWoodenTable(seed = 101, lighting = 'normal') {
    const rng = createRng(seed);
    const base = [110, 74, 46];
    for (let y = 0; y < this.height; y++) {
      const plankBand = Math.floor(y / 64);
      const plankOffset = ((plankBand % 3) - 1) * 7;
      const seam = (y % 64) < 2 ? -24 : 0;
      for (let x = 0; x < this.width; x++) {
        const grain = Math.sin(x * 0.03 + y * 0.14 + plankBand * 2.1) * 8 +
          Math.sin(x * 0.09 - plankBand) * 4 +
          (rng() - 0.5) * 6;
        const r = Math.max(15, Math.min(235, base[0] + plankOffset + seam + grain));
        const g = Math.max(12, Math.min(220, base[1] + plankOffset * 0.7 + seam + grain * 0.75));
        const b = Math.max(10, Math.min(200, base[2] + plankOffset * 0.5 + seam + grain * 0.5));
        const idx = (y * this.width + x) * 4;
        this.data[idx] = r;
        this.data[idx + 1] = g;
        this.data[idx + 2] = b;
        this.data[idx + 3] = 255;
      }
    }
    this.applyTableclothStrip(lighting);
  }

  applyTableclothStrip(lighting) {
    // Subtle woven bamboo mat (tikar/alas makan) in center
    const x0 = Math.round(this.width * 0.06);
    const x1 = Math.round(this.width * 0.94);
    const y0 = Math.round(this.height * 0.08);
    const y1 = Math.round(this.height * 0.92);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const weave = ((Math.floor(x / 6) + Math.floor(y / 6)) % 2 === 0) ? 10 : -8;
        this.blendPixel(x, y, 168 + weave, 136 + weave, 92 + weave, 0.36);
      }
    }
    if (lighting === 'low_light') {
      this.adjustTone(0.62, -18, 1.15);
    } else if (lighting === 'uneven_shadow') {
      this.applyDirectionalShadow();
    } else if (lighting === 'hazy_fluorescent') {
      this.adjustTone(0.78, 22, 1.0);
    }
  }

  applyDirectionalShadow() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = (x / this.width) * 0.55 + (y / this.height) * 0.45;
        const factor = 0.58 + 0.42 * (1 - t);
        const idx = (y * this.width + x) * 4;
        this.data[idx] = Math.round(this.data[idx] * factor);
        this.data[idx + 1] = Math.round(this.data[idx + 1] * factor);
        this.data[idx + 2] = Math.round(this.data[idx + 2] * factor);
      }
    }
  }

  adjustTone(alpha, beta, gamma = 1.0) {
    for (let i = 0; i < this.data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let v = this.data[i + c] * alpha + beta;
        v = Math.max(0, Math.min(255, v));
        if (gamma !== 1.0) {
          v = 255 * Math.pow(v / 255, gamma);
        }
        this.data[i + c] = Math.round(Math.max(0, Math.min(255, v)));
      }
    }
  }

  fillEllipse(cx, cy, rx, ry, color, alpha = 1.0, shaded = false) {
    const x0 = Math.max(0, Math.floor(cx - rx - 1));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + rx + 1));
    const y0 = Math.max(0, Math.floor(cy - ry - 1));
    const y1 = Math.min(this.height - 1, Math.ceil(cy + ry + 1));
    for (let y = y0; y <= y1; y++) {
      const dy = (y - cy) / ry;
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const d2 = dx * dx + dy * dy;
        if (d2 <= 1.0) {
          const edgeAlpha = d2 > 0.88 ? (1 - d2) / 0.12 : 1.0;
          let [r, g, b] = color;
          if (shaded) {
            const light = 1.08 - 0.25 * (dx * 0.4 + dy * 0.6 + 0.3);
            r = Math.min(255, Math.max(0, r * light));
            g = Math.min(255, Math.max(0, g * light));
            b = Math.min(255, Math.max(0, b * light));
          }
          this.blendPixel(x, y, r, g, b, alpha * edgeAlpha);
        }
      }
    }
  }

  fillRoundRect(x, y, w, h, radius, color, alpha = 1.0, angleRad = 0) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const hw = w / 2;
    const hh = h / 2;
    const cos = Math.cos(-angleRad);
    const sin = Math.sin(-angleRad);
    const bound = Math.ceil(Math.hypot(hw, hh) + 2);
    const x0 = Math.max(0, Math.floor(cx - bound));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + bound));
    const y0 = Math.max(0, Math.floor(cy - bound));
    const y1 = Math.min(this.height - 1, Math.ceil(cy + bound));

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const tx = px - cx;
        const ty = py - cy;
        const lx = Math.abs(tx * cos - ty * sin);
        const ly = Math.abs(tx * sin + ty * cos);
        const qx = Math.max(0, lx - (hw - radius));
        const qy = Math.max(0, ly - (hh - radius));
        const dist = Math.hypot(qx, qy);
        if (dist <= radius) {
          const edge = dist > radius - 1.2 ? Math.max(0, (radius - dist) / 1.2) : 1.0;
          this.blendPixel(px, py, color[0], color[1], color[2], alpha * edge);
        }
      }
    }
  }

  drawLine(x1, y1, x2, y2, thickness, color, alpha = 1.0) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 1.5));
    const r = Math.max(1, thickness / 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x1 + (x2 - x1) * t;
      const cy = y1 + (y2 - y1) * t;
      this.fillEllipse(cx, cy, r, r, color, alpha, false);
    }
  }

  drawCeramicPlate(cx, cy, rx, ry, rimColor = [238, 234, 224], innerColor = [248, 246, 240]) {
    this.fillEllipse(cx + 6, cy + 8, rx * 1.03, ry * 1.03, [20, 14, 10], 0.35);
    this.fillEllipse(cx, cy, rx, ry, rimColor, 1.0, true);
    this.fillEllipse(cx, cy, rx * 0.88, ry * 0.88, [212, 206, 195], 0.6);
    this.fillEllipse(cx, cy, rx * 0.83, ry * 0.83, innerColor, 1.0, true);
  }

  drawBananaLeaf(cx, cy, rx, ry, angle = 0) {
    // Classic Indonesian daun pisang base
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x0 = Math.max(0, Math.floor(cx - rx - 10));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + rx + 10));
    const y0 = Math.max(0, Math.floor(cy - ry - 10));
    const y1 = Math.min(this.height - 1, Math.ceil(cy + ry + 10));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) * cos + (y - cy) * sin;
        const dy = -(x - cx) * sin + (y - cy) * cos;
        const norm = (dx / rx) ** 2 + (dy / ry) ** 2;
        if (norm <= 1.0) {
          const rib = Math.abs(dy) < 2.2 ? 25 : Math.sin(dx * 0.25) * 6;
          this.blendPixel(x, y, 52 + rib, 126 + rib, 48 + rib * 0.4, 0.96);
        }
      }
    }
  }
}

// Specific Indonesian dish painters returning bounding box [x1, y1, x2, y2]
function paintNasiGoreng(canvas, cx, cy, scale = 1.0, seed = 1) {
  const rng = createRng(seed);
  const rx = 74 * scale;
  const ry = 56 * scale;
  canvas.fillEllipse(cx, cy + 4 * scale, rx, ry, [186, 118, 52], 0.96, true);
  for (let i = 0; i < Math.round(280 * scale); i++) {
    const a = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng());
    const gx = cx + Math.cos(a) * rx * 0.88 * rad;
    const gy = cy + Math.sin(a) * ry * 0.85 * rad;
    const tone = rng();
    const col = tone < 0.2 ? [142, 62, 24] : tone < 0.45 ? [216, 148, 72] : tone < 0.85 ? [196, 124, 54] : [68, 138, 48];
    canvas.fillEllipse(gx, gy, 3.8 * scale, 2.3 * scale, col, 0.9);
  }
  // Kerupuk & timun garnish
  canvas.fillEllipse(cx - 42 * scale, cy - 16 * scale, 16 * scale, 12 * scale, [238, 224, 196], 0.95, true);
  canvas.fillEllipse(cx + 42 * scale, cy + 16 * scale, 12 * scale, 9 * scale, [94, 178, 72], 0.95, true);
  canvas.fillEllipse(cx + 42 * scale, cy + 16 * scale, 8 * scale, 6 * scale, [164, 214, 126], 0.9);
  return clampBox(canvas, cx - rx, cy - ry, cx + rx, cy + ry);
}

function paintBakso(canvas, cx, cy, scale = 1.0, seed = 2) {
  const rng = createRng(seed);
  const r = 68 * scale;
  // Ceramic bowl + warm broth
  canvas.fillEllipse(cx + 4, cy + 5, r * 1.05, r * 0.95, [20, 14, 10], 0.35);
  canvas.fillEllipse(cx, cy, r, r * 0.9, [232, 232, 228], 1.0, true);
  canvas.fillEllipse(cx, cy, r * 0.88, r * 0.78, [196, 164, 96], 0.96, true);
  // Noodles & greens
  for (let i = 0; i < 18; i++) {
    const ox = (rng() - 0.5) * r * 0.9;
    const oy = (rng() - 0.5) * r * 0.7;
    canvas.drawLine(cx + ox - 12 * scale, cy + oy, cx + ox + 14 * scale, cy + oy + (rng() - 0.5) * 14 * scale, 2.5 * scale, [242, 212, 118], 0.85);
  }
  // 5 meatballs
  const balls = [[-22, -12, 17], [16, -15, 16], [-4, 8, 19], [24, 10, 15], [-26, 14, 14]];
  for (const [bx, by, br] of balls) {
    canvas.fillEllipse(cx + bx * scale + 2, cy + by * scale + 3, br * scale, br * scale * 0.92, [82, 66, 52], 0.4);
    canvas.fillEllipse(cx + bx * scale, cy + by * scale, br * scale, br * scale * 0.92, [148, 134, 122], 1.0, true);
  }
  // Daun bawang
  for (let i = 0; i < 20; i++) {
    canvas.fillEllipse(cx + (rng() - 0.5) * r * 0.9, cy + (rng() - 0.5) * r * 0.7, 3 * scale, 2 * scale, [54, 156, 58], 0.9);
  }
  return clampBox(canvas, cx - r * 0.9, cy - r * 0.82, cx + r * 0.9, cy + r * 0.82);
}

function paintSateAyam(canvas, cx, cy, scale = 1.0, seed = 3) {
  const rng = createRng(seed);
  // Peanut sauce pool
  canvas.fillEllipse(cx + 8 * scale, cy + 12 * scale, 62 * scale, 38 * scale, [138, 86, 36], 0.92, true);
  // 5 sate skewers angled
  for (let s = -2; s <= 2; s++) {
    const oy = s * 13 * scale;
    const ox = s * 6 * scale;
    canvas.drawLine(cx - 64 * scale + ox, cy + oy - 18 * scale, cx + 64 * scale + ox, cy + oy + 12 * scale, 2.5 * scale, [214, 186, 134], 0.95);
    for (let m = -2; m <= 1; m++) {
      const mx = cx + ox + m * 19 * scale;
      const my = cy + oy + m * 4.5 * scale;
      const shade = rng() > 0.4 ? [156, 86, 34] : [92, 46, 18];
      canvas.fillEllipse(mx, my, 10 * scale, 7.5 * scale, shade, 0.98, true);
    }
  }
  // Kecap drizzle
  for (let i = 0; i < 6; i++) {
    canvas.drawLine(cx - 25 * scale + i * 10 * scale, cy - 10 * scale, cx - 10 * scale + i * 9 * scale, cy + 20 * scale, 2 * scale, [46, 24, 12], 0.7);
  }
  return clampBox(canvas, cx - 72 * scale, cy - 48 * scale, cx + 72 * scale, cy + 48 * scale);
}

function paintRendang(canvas, cx, cy, scale = 1.0, seed = 4) {
  const rng = createRng(seed);
  canvas.fillEllipse(cx, cy + 4 * scale, 52 * scale, 38 * scale, [94, 42, 16], 0.92, true);
  const chunks = [[-16, -8, 22, 17], [14, -6, 20, 16], [-4, 12, 24, 18], [20, 12, 16, 13]];
  for (const [dx, dy, rx, ry] of chunks) {
    canvas.fillEllipse(cx + dx * scale, cy + dy * scale, rx * scale, ry * scale, [76, 32, 12], 1.0, true);
    for (let k = 0; k < 10; k++) {
      canvas.fillEllipse(
        cx + dx * scale + (rng() - 0.5) * rx * scale,
        cy + dy * scale + (rng() - 0.5) * ry * scale,
        3 * scale,
        2 * scale,
        [136, 68, 26],
        0.75
      );
    }
  }
  return clampBox(canvas, cx - 54 * scale, cy - 38 * scale, cx + 54 * scale, cy + 40 * scale);
}

function paintSotoAyam(canvas, cx, cy, scale = 1.0, seed = 5) {
  const rng = createRng(seed);
  const r = 64 * scale;
  canvas.fillEllipse(cx, cy, r, r * 0.88, [238, 238, 234], 1.0, true);
  canvas.fillEllipse(cx, cy, r * 0.86, r * 0.75, [226, 188, 52], 0.96, true);
  // Shredded chicken, egg half, lime, greens
  for (let i = 0; i < 16; i++) {
    canvas.fillRoundRect(
      cx + (rng() - 0.5) * r * 0.7,
      cy + (rng() - 0.5) * r * 0.6,
      14 * scale, 5 * scale, 2 * scale, [242, 222, 174], 0.9, rng() * 3.14
    );
  }
  canvas.fillEllipse(cx - 18 * scale, cy - 8 * scale, 14 * scale, 11 * scale, [250, 248, 238], 0.98, true);
  canvas.fillEllipse(cx - 18 * scale, cy - 8 * scale, 7 * scale, 6 * scale, [242, 172, 28], 0.98);
  canvas.fillEllipse(cx + 22 * scale, cy + 12 * scale, 11 * scale, 9 * scale, [76, 168, 54], 0.95);
  return clampBox(canvas, cx - r * 0.88, cy - r * 0.78, cx + r * 0.88, cy + r * 0.78);
}

function paintAyamGoreng(canvas, cx, cy, scale = 1.0) {
  // Golden-brown fried chicken drumstick/thigh + kremesan
  canvas.fillEllipse(cx + 4, cy + 5, 48 * scale, 32 * scale, [28, 18, 10], 0.3);
  canvas.fillRoundRect(cx - 44 * scale, cy - 10 * scale, 48 * scale, 16 * scale, 7 * scale, [228, 198, 148], 0.95, -0.25);
  canvas.fillEllipse(cx + 8 * scale, cy - 2 * scale, 34 * scale, 24 * scale, [192, 112, 34], 1.0, true);
  canvas.fillEllipse(cx + 12 * scale, cy - 5 * scale, 22 * scale, 15 * scale, [218, 142, 48], 0.85, true);
  return clampBox(canvas, cx - 48 * scale, cy - 30 * scale, cx + 46 * scale, cy + 28 * scale);
}

function paintMieGoreng(canvas, cx, cy, scale = 1.0, seed = 7) {
  const rng = createRng(seed);
  const rx = 68 * scale;
  const ry = 48 * scale;
  canvas.fillEllipse(cx, cy, rx, ry, [198, 134, 48], 0.9, true);
  for (let i = 0; i < Math.round(90 * scale); i++) {
    const a = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * 0.82;
    const x1 = cx + Math.cos(a) * rx * rad;
    const y1 = cy + Math.sin(a) * ry * rad;
    const x2 = x1 + (rng() - 0.5) * 28 * scale;
    const y2 = y1 + (rng() - 0.5) * 20 * scale;
    const col = rng() > 0.35 ? [232, 168, 56] : [168, 96, 32];
    canvas.drawLine(x1, y1, x2, y2, 3.2 * scale, col, 0.92);
  }
  // Pakcoy greens & bakso slices
  canvas.fillEllipse(cx - 24 * scale, cy + 12 * scale, 12 * scale, 8 * scale, [64, 152, 56], 0.95);
  canvas.fillEllipse(cx + 22 * scale, cy - 10 * scale, 10 * scale, 8 * scale, [156, 138, 126], 0.95);
  return clampBox(canvas, cx - rx, cy - ry, cx + rx, cy + ry);
}

function paintTempeGoreng(canvas, cx, cy, scale = 1.0, seed = 8) {
  const rng = createRng(seed);
  const pieces = [[-16, -8, -0.25], [14, 6, 0.2]];
  for (const [dx, dy, ang] of pieces) {
    canvas.fillRoundRect(cx + dx * scale - 24 * scale, cy + dy * scale - 14 * scale, 48 * scale, 28 * scale, 4 * scale, [188, 128, 42], 1.0, ang);
    for (let i = 0; i < 16; i++) {
      canvas.fillEllipse(
        cx + dx * scale + (rng() - 0.5) * 34 * scale,
        cy + dy * scale + (rng() - 0.5) * 18 * scale,
        3.2 * scale, 2.2 * scale, [238, 212, 148], 0.85
      );
    }
  }
  return clampBox(canvas, cx - 44 * scale, cy - 30 * scale, cx + 44 * scale, cy + 30 * scale);
}

function paintTahuGoreng(canvas, cx, cy, scale = 1.0) {
  const pieces = [[-15, -7, 0.15], [15, 7, -0.18]];
  for (const [dx, dy, ang] of pieces) {
    canvas.fillRoundRect(cx + dx * scale - 19 * scale, cy + dy * scale - 16 * scale, 38 * scale, 32 * scale, 5 * scale, [224, 158, 54], 1.0, ang);
    canvas.fillRoundRect(cx + dx * scale - 14 * scale, cy + dy * scale - 11 * scale, 28 * scale, 22 * scale, 4 * scale, [246, 204, 118], 0.85, ang);
  }
  return clampBox(canvas, cx - 40 * scale, cy - 30 * scale, cx + 40 * scale, cy + 30 * scale);
}

function paintGadoGado(canvas, cx, cy, scale = 1.0, seed = 10) {
  const rng = createRng(seed);
  const rx = 74 * scale;
  const ry = 56 * scale;
  // Fresh greens & bean sprouts bed
  canvas.fillEllipse(cx, cy, rx, ry, [62, 146, 56], 0.96, true);
  for (let i = 0; i < 24; i++) {
    const px = cx + (rng() - 0.5) * rx * 1.2;
    const py = cy + (rng() - 0.5) * ry * 1.1;
    const col = i % 3 === 0 ? [242, 236, 198] : i % 3 === 1 ? [88, 174, 68] : [224, 168, 72];
    canvas.fillEllipse(px, py, 12 * scale, 8 * scale, col, 0.9);
  }
  // Peanut sauce center pool + kerupuk udang
  canvas.fillEllipse(cx, cy + 4 * scale, 40 * scale, 28 * scale, [158, 96, 42], 0.95, true);
  canvas.fillEllipse(cx - 34 * scale, cy - 18 * scale, 18 * scale, 13 * scale, [242, 182, 162], 0.95, true);
  return clampBox(canvas, cx - rx, cy - ry, cx + rx, cy + ry);
}

function paintPempek(canvas, cx, cy, scale = 1.0) {
  // Cuko dark bowl + pempek kapal selam & lenjer
  canvas.fillEllipse(cx + 32 * scale, cy + 12 * scale, 20 * scale, 16 * scale, [42, 22, 12], 0.98, true);
  canvas.fillEllipse(cx - 12 * scale, cy - 6 * scale, 32 * scale, 20 * scale, [228, 194, 126], 1.0, true);
  canvas.fillRoundRect(cx - 38 * scale, cy + 12 * scale, 48 * scale, 18 * scale, 8 * scale, [218, 182, 112], 1.0, -0.1);
  // Timun dice
  canvas.fillEllipse(cx + 12 * scale, cy + 20 * scale, 6 * scale, 5 * scale, [94, 184, 72], 0.95);
  return clampBox(canvas, cx - 48 * scale, cy - 30 * scale, cx + 54 * scale, cy + 34 * scale);
}

function paintTelurBalado(canvas, cx, cy, scale = 1.0) {
  // Spicy red balado chili coating around boiled egg
  canvas.fillEllipse(cx, cy + 4 * scale, 34 * scale, 26 * scale, [186, 36, 24], 0.94, true);
  canvas.fillEllipse(cx, cy, 24 * scale, 18 * scale, [214, 58, 36], 0.98, true);
  canvas.fillEllipse(cx - 4 * scale, cy - 3 * scale, 14 * scale, 10 * scale, [244, 228, 214], 0.55);
  return clampBox(canvas, cx - 36 * scale, cy - 26 * scale, cx + 36 * scale, cy + 30 * scale);
}

function clampBox(canvas, x1, y1, x2, y2) {
  return [
    Math.max(0, Math.round(x1)),
    Math.max(0, Math.round(y1)),
    Math.min(canvas.width, Math.round(x2)),
    Math.min(canvas.height, Math.round(y2)),
  ];
}

function toYoloNorm(box, width, height) {
  const [x1, y1, x2, y2] = box;
  const w = (x2 - x1) / width;
  const h = (y2 - y1) / height;
  const xc = (x1 + x2) / (2 * width);
  const yc = (y1 + y2) / (2 * height);
  return [
    Number(xc.toFixed(6)),
    Number(yc.toFixed(6)),
    Number(w.toFixed(6)),
    Number(h.toFixed(6)),
  ];
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function makeGtItem(className, box, width, height, roiPoly, conf = 0.92) {
  const cls = CLASS_BY_NAME[className];
  const cx = (box[0] + box[2]) / 2;
  const cy = (box[1] + box[3]) / 2;
  return {
    class_id: cls.id,
    class_name: cls.name,
    bbox_xyxy: box,
    bbox_yolo: toYoloNorm(box, width, height),
    confidence_gt: conf,
    in_default_roi: pointInPolygon(cx, cy, roiPoly),
  };
}

function generateSampleImages() {
  const W = 640;
  const H = 480;
  const specs = [
    {
      id: 'nasi_goreng_spesial',
      filename: 'nasi_goreng_spesial.png',
      title: 'Nasi Goreng Spesial Komplit',
      description: 'Piring nasi goreng dengan telur balado, ayam goreng, dan tempe goreng dalam pencahayaan redup warung malam.',
      lighting_condition: 'low_light',
      recommended_enhancement: 'clahe',
      seed: 101,
      default_roi: [[110, 80], [530, 80], [530, 410], [110, 410]],
      paint(canvas, roi) {
        canvas.drawCeramicPlate(320, 245, 225, 168);
        canvas.drawBananaLeaf(320, 250, 195, 140, 0.05);
        const gt = [];
        gt.push(makeGtItem('Nasi Goreng', paintNasiGoreng(canvas, 285, 255, 1.35, 11), W, H, roi, 0.95));
        gt.push(makeGtItem('Telur Balado', paintTelurBalado(canvas, 405, 195, 1.05), W, H, roi, 0.91));
        gt.push(makeGtItem('Ayam Goreng', paintAyamGoreng(canvas, 415, 295, 1.0), W, H, roi, 0.93));
        gt.push(makeGtItem('Tempe Goreng', paintTempeGoreng(canvas, 195, 175, 0.95, 12), W, H, roi, 0.89));
        return gt;
      },
    },
    {
      id: 'bakso_komplit',
      filename: 'bakso_komplit.png',
      title: 'Bakso Komplit & Tahu Goreng',
      description: 'Dua mangkuk bakso urat dengan pendamping tahu goreng dan mie goreng dalam pencahayaan bayangan tidak merata.',
      lighting_condition: 'uneven_shadow',
      recommended_enhancement: 'he',
      seed: 202,
      default_roi: [[70, 70], [390, 70], [390, 415], [70, 415]],
      paint(canvas, roi) {
        const gt = [];
        gt.push(makeGtItem('Bakso', paintBakso(canvas, 225, 245, 1.45, 21), W, H, roi, 0.96));
        canvas.drawCeramicPlate(485, 165, 112, 84);
        gt.push(makeGtItem('Tahu Goreng', paintTahuGoreng(canvas, 485, 165, 1.05), W, H, roi, 0.90));
        canvas.drawCeramicPlate(485, 340, 118, 86);
        gt.push(makeGtItem('Mie Goreng', paintMieGoreng(canvas, 485, 340, 1.05, 22), W, H, roi, 0.92));
        return gt;
      },
    },
    {
      id: 'sate_ayam_madura',
      filename: 'sate_ayam_madura.png',
      title: 'Sate Ayam Madura & Soto Ayam',
      description: 'Seporsi sate ayam bumbu kacang bersama semangkuk soto ayam dan tahu goreng di meja kantin.',
      lighting_condition: 'hazy_fluorescent',
      recommended_enhancement: 'cs',
      seed: 303,
      default_roi: [[60, 110], [375, 110], [375, 390], [60, 390]],
      paint(canvas, roi) {
        canvas.drawCeramicPlate(225, 250, 170, 128);
        canvas.drawBananaLeaf(225, 252, 145, 102, -0.06);
        const gt = [];
        gt.push(makeGtItem('Sate Ayam', paintSateAyam(canvas, 225, 250, 1.45, 31), W, H, roi, 0.96));
        gt.push(makeGtItem('Soto Ayam', paintSotoAyam(canvas, 495, 185, 1.15, 32), W, H, roi, 0.93));
        canvas.drawCeramicPlate(495, 355, 96, 72);
        gt.push(makeGtItem('Tahu Goreng', paintTahuGoreng(canvas, 495, 355, 0.95), W, H, roi, 0.88));
        return gt;
      },
    },
    {
      id: 'nasi_padang_rendang',
      filename: 'nasi_padang_rendang.png',
      title: 'Nasi Padang Rendang & Lauk Komplit',
      description: 'Sajian hidangan Padang berisi rendang daging, telur balado, ayam goreng, dan tempe goreng.',
      lighting_condition: 'low_light',
      recommended_enhancement: 'brightness',
      seed: 404,
      default_roi: [[120, 75], [520, 75], [520, 405], [120, 405]],
      paint(canvas, roi) {
        canvas.drawCeramicPlate(320, 240, 232, 174);
        canvas.drawBananaLeaf(320, 245, 200, 146, 0.03);
        const gt = [];
        gt.push(makeGtItem('Rendang', paintRendang(canvas, 235, 195, 1.2, 41), W, H, roi, 0.95));
        gt.push(makeGtItem('Telur Balado', paintTelurBalado(canvas, 395, 185, 1.1), W, H, roi, 0.94));
        gt.push(makeGtItem('Ayam Goreng', paintAyamGoreng(canvas, 255, 315, 1.1), W, H, roi, 0.92));
        gt.push(makeGtItem('Tempe Goreng', paintTempeGoreng(canvas, 410, 315, 1.0, 42), W, H, roi, 0.90));
        return gt;
      },
    },
    {
      id: 'prasmanan_kuliner_nusantara',
      filename: 'prasmanan_kuliner_nusantara.png',
      title: 'Prasmanan Kuliner Nusantara (12 Kelas)',
      description: 'Meja prasmanan besar menampilkan representasi seluruh 12 kelas kuliner Indonesia untuk pengujian counting dan Region ROI.',
      lighting_condition: 'uneven_shadow',
      recommended_enhancement: 'clahe',
      seed: 505,
      default_roi: [[140, 110], [500, 110], [500, 370], [140, 370]],
      paint(canvas, roi) {
        const gt = [];
        const grid = [
          ['Nasi Goreng', 95, 92, (c, x, y) => paintNasiGoreng(c, x, y, 0.78, 51)],
          ['Bakso', 245, 92, (c, x, y) => paintBakso(c, x, y, 0.78, 52)],
          ['Sate Ayam', 395, 92, (c, x, y) => paintSateAyam(c, x, y, 0.78, 53)],
          ['Rendang', 545, 92, (c, x, y) => paintRendang(c, x, y, 0.88, 54)],
          ['Soto Ayam', 95, 240, (c, x, y) => paintSotoAyam(c, x, y, 0.80, 55)],
          ['Ayam Goreng', 245, 240, (c, x, y) => paintAyamGoreng(c, x, y, 0.88)],
          ['Mie Goreng', 395, 240, (c, x, y) => paintMieGoreng(c, x, y, 0.78, 56)],
          ['Tempe Goreng', 545, 240, (c, x, y) => paintTempeGoreng(c, x, y, 0.88, 57)],
          ['Tahu Goreng', 95, 388, (c, x, y) => paintTahuGoreng(c, x, y, 0.92)],
          ['Gado-Gado', 245, 388, (c, x, y) => paintGadoGado(c, x, y, 0.76, 58)],
          ['Pempek', 395, 388, (c, x, y) => paintPempek(c, x, y, 0.88)],
          ['Telur Balado', 545, 388, (c, x, y) => paintTelurBalado(c, x, y, 0.95)],
        ];
        for (const [name, x, y, fn] of grid) {
          if (name !== 'Bakso' && name !== 'Soto Ayam') {
            canvas.drawCeramicPlate(x, y, 66, 52);
          }
          gt.push(makeGtItem(name, fn(canvas, x, y), W, H, roi, 0.91));
        }
        return gt;
      },
    },
    {
      id: 'gado_gado_tahu_tempe',
      filename: 'gado_gado_tahu_tempe.png',
      title: 'Gado-Gado, Pempek & Tahu Tempe',
      description: 'Hidangan gado-gado Betawi lengkap dengan tempe goreng, tahu goreng, dan pempek kapal selam.',
      lighting_condition: 'normal',
      recommended_enhancement: 'clahe',
      seed: 606,
      default_roi: [[80, 90], [380, 90], [380, 400], [80, 400]],
      paint(canvas, roi) {
        const gt = [];
        canvas.drawCeramicPlate(225, 245, 164, 126);
        gt.push(makeGtItem('Gado-Gado', paintGadoGado(canvas, 225, 245, 1.32, 61), W, H, roi, 0.95));
        canvas.drawCeramicPlate(488, 130, 102, 76);
        gt.push(makeGtItem('Tempe Goreng', paintTempeGoreng(canvas, 488, 130, 1.0, 62), W, H, roi, 0.91));
        canvas.drawCeramicPlate(488, 255, 96, 72);
        gt.push(makeGtItem('Tahu Goreng', paintTahuGoreng(canvas, 488, 255, 0.98), W, H, roi, 0.90));
        canvas.drawCeramicPlate(488, 380, 108, 78);
        gt.push(makeGtItem('Pempek', paintPempek(canvas, 488, 380, 1.02), W, H, roi, 0.92));
        return gt;
      },
    },
  ];

  return specs.map((spec) => {
    const canvas = new RasterCanvas(W, H);
    canvas.drawWoodenTable(spec.seed, spec.lighting_condition);
    const gt = spec.paint(canvas, spec.default_roi);
    const outPath = path.join(IMAGES_DIR, spec.filename);
    fs.writeFileSync(outPath, encodePNG(W, H, canvas.data));
    return {
      id: spec.id,
      filename: spec.filename,
      path: `samples/images/${spec.filename}`,
      title: spec.title,
      description: spec.description,
      width: W,
      height: H,
      lighting_condition: spec.lighting_condition,
      recommended_enhancement: spec.recommended_enhancement,
      default_roi: spec.default_roi,
      default_roi_norm: spec.default_roi.map(([x, y]) => [Number((x / W).toFixed(4)), Number((y / H).toFixed(4))]),
      ground_truth: gt,
    };
  });
}

/**
 * Encodes an array of RGBA frames into a standard uncompressed 24-bit BGR RIFF AVI file
 * compatible with OpenCV cv2.VideoCapture, Ultralytics YOLO/ObjectCounter, and FFmpeg.
 */
function encodeUncompressedAVI(width, height, fps, rgbaFrames) {
  const rowStride = (width * 3 + 3) & ~3;
  const frameSize = rowStride * height;
  const numFrames = rgbaFrames.length;

  function fourcc(str) {
    return Buffer.from(str, 'ascii');
  }

  // avih (56 bytes)
  const avih = Buffer.alloc(56);
  avih.writeUInt32LE(Math.round(1_000_000 / fps), 0); // dwMicroSecPerFrame
  avih.writeUInt32LE(frameSize * fps, 4); // dwMaxBytesPerSec
  avih.writeUInt32LE(0, 8); // dwPaddingGranularity
  avih.writeUInt32LE(0x10, 12); // dwFlags (AVIF_HASINDEX)
  avih.writeUInt32LE(numFrames, 16); // dwTotalFrames
  avih.writeUInt32LE(0, 20); // dwInitialFrames
  avih.writeUInt32LE(1, 24); // dwStreams
  avih.writeUInt32LE(frameSize, 28); // dwSuggestedBufferSize
  avih.writeUInt32LE(width, 32); // dwWidth
  avih.writeUInt32LE(height, 36); // dwHeight

  // strh (56 bytes)
  const strh = Buffer.alloc(56);
  fourcc('vids').copy(strh, 0); // fccType
  fourcc('DIB ').copy(strh, 4); // fccHandler
  strh.writeUInt32LE(0, 8); // dwFlags
  strh.writeUInt16LE(0, 12); // wPriority
  strh.writeUInt16LE(0, 14); // wLanguage
  strh.writeUInt32LE(0, 16); // dwInitialFrames
  strh.writeUInt32LE(1, 20); // dwScale
  strh.writeUInt32LE(fps, 24); // dwRate
  strh.writeUInt32LE(0, 28); // dwStart
  strh.writeUInt32LE(numFrames, 32); // dwLength
  strh.writeUInt32LE(frameSize, 36); // dwSuggestedBufferSize
  strh.writeUInt32LE(0xFFFFFFFF, 40); // dwQuality
  strh.writeUInt32LE(0, 44); // dwSampleSize
  strh.writeInt16LE(0, 48);
  strh.writeInt16LE(0, 50);
  strh.writeInt16LE(width, 52);
  strh.writeInt16LE(height, 54);

  // strf BITMAPINFOHEADER (40 bytes)
  const strf = Buffer.alloc(40);
  strf.writeUInt32LE(40, 0); // biSize
  strf.writeInt32LE(width, 4); // biWidth
  strf.writeInt32LE(height, 8); // biHeight (positive = bottom-up DIB)
  strf.writeUInt16LE(1, 12); // biPlanes
  strf.writeUInt16LE(24, 14); // biBitCount
  strf.writeUInt32LE(0, 16); // biCompression (BI_RGB)
  strf.writeUInt32LE(frameSize, 20); // biSizeImage

  function makeChunk(tag, payload) {
    const hdr = Buffer.alloc(8);
    fourcc(tag).copy(hdr, 0);
    hdr.writeUInt32LE(payload.length, 4);
    const pad = payload.length % 2 === 1 ? Buffer.alloc(1) : Buffer.alloc(0);
    return Buffer.concat([hdr, payload, pad]);
  }

  function makeList(listType, children) {
    const body = Buffer.concat([fourcc(listType), ...children]);
    const hdr = Buffer.alloc(8);
    fourcc('LIST').copy(hdr, 0);
    hdr.writeUInt32LE(body.length, 4);
    return Buffer.concat([hdr, body]);
  }

  const strl = makeList('strl', [makeChunk('strh', strh), makeChunk('strf', strf)]);
  const hdrl = makeList('hdrl', [makeChunk('avih', avih), strl]);

  const frameChunks = [];
  const idxEntries = [];
  let moviOffset = 4; // relative to 'movi' list type

  for (const rgba of rgbaFrames) {
    const bgr = Buffer.alloc(frameSize);
    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y; // bottom-up DIB
      for (let x = 0; x < width; x++) {
        const s = (srcY * width + x) * 4;
        const d = y * rowStride + x * 3;
        bgr[d] = rgba[s + 2];     // B
        bgr[d + 1] = rgba[s + 1]; // G
        bgr[d + 2] = rgba[s];     // R
      }
    }
    const chunk = makeChunk('00db', bgr);
    frameChunks.push(chunk);

    const idx = Buffer.alloc(16);
    fourcc('00db').copy(idx, 0);
    idx.writeUInt32LE(0x10, 4); // AVIIF_KEYFRAME
    idx.writeUInt32LE(moviOffset, 8);
    idx.writeUInt32LE(frameSize, 12);
    idxEntries.push(idx);
    moviOffset += chunk.length;
  }

  const movi = makeList('movi', frameChunks);
  const idx1 = makeChunk('idx1', Buffer.concat(idxEntries));
  const riffBody = Buffer.concat([fourcc('AVI '), hdrl, movi, idx1]);
  const riffHdr = Buffer.alloc(8);
  fourcc('RIFF').copy(riffHdr, 0);
  riffHdr.writeUInt32LE(riffBody.length, 4);
  return Buffer.concat([riffHdr, riffBody]);
}

function generateSampleVideos() {
  const W = 320;
  const H = 240;
  const FPS = 6;
  const FRAME_COUNT = 16;

  const videoConfigs = [
    {
      id: 'prasmanan_tracking_demo',
      filename: 'prasmanan_tracking_demo.avi',
      title: 'Demo Tracking Nampan Prasmanan (ByteTrack & Region Counter)',
      description: 'Simulasi video 16 frame piring kuliner bergerak melintasi zona ROI meja kasir untuk pengujian ByteTrack dan Region Counter.',
      default_roi: [[105, 35], [225, 35], [225, 205], [105, 205]],
      tracks: [
        {
          track_id: 1,
          class_name: 'Nasi Goreng',
          xStart: 42, xEnd: 278, yBase: 68, scale: 0.56,
          paint: (c, x, y, s) => { c.drawCeramicPlate(x, y, 48 * s * 1.4, 38 * s * 1.4); return paintNasiGoreng(c, x, y, s, 71); },
        },
        {
          track_id: 2,
          class_name: 'Bakso',
          xStart: 270, xEnd: 46, yBase: 145, scale: 0.58,
          paint: (c, x, y, s) => paintBakso(c, x, y, s, 72),
        },
        {
          track_id: 3,
          class_name: 'Rendang',
          xStart: 165, xEnd: 165, yBase: 192, scale: 0.56,
          paint: (c, x, y, s) => { c.drawCeramicPlate(x, y, 42 * s * 1.3, 34 * s * 1.3); return paintRendang(c, x, y, s, 73); },
        },
      ],
    },
    {
      id: 'antrean_kantin_demo',
      filename: 'antrean_kantin_demo.avi',
      title: 'Demo Antrean Kasir Kantin Nusantara',
      description: 'Simulasi video 16 frame menu Sate Ayam, Gado-Gado, dan Telur Balado bergerak masuk ke Region Counter kasir.',
      default_roi: [[135, 30], [295, 30], [295, 210], [135, 210]],
      tracks: [
        {
          track_id: 1,
          class_name: 'Sate Ayam',
          xStart: 36, xEnd: 255, yBase: 72, scale: 0.54,
          paint: (c, x, y, s) => { c.drawCeramicPlate(x, y, 48 * s * 1.4, 36 * s * 1.4); return paintSateAyam(c, x, y, s, 81); },
        },
        {
          track_id: 2,
          class_name: 'Gado-Gado',
          xStart: 48, xEnd: 245, yBase: 168, scale: 0.54,
          paint: (c, x, y, s) => { c.drawCeramicPlate(x, y, 48 * s * 1.4, 36 * s * 1.4); return paintGadoGado(c, x, y, s, 82); },
        },
        {
          track_id: 3,
          class_name: 'Telur Balado',
          xStart: 220, xEnd: 220, yBase: 118, scale: 0.62,
          paint: (c, x, y, s) => { c.drawCeramicPlate(x, y, 36 * s * 1.3, 28 * s * 1.3); return paintTelurBalado(c, x, y, s); },
        },
      ],
    },
  ];

  return videoConfigs.map((cfg) => {
    const videoFramesDir = path.join(FRAMES_DIR, cfg.id);
    fs.mkdirSync(videoFramesDir, { recursive: true });

    const rgbaFrames = [];
    const frameAnnotations = [];
    const trackInsideSet = new Set();

    for (let f = 0; f < FRAME_COUNT; f++) {
      const t = f / (FRAME_COUNT - 1);
      const canvas = new RasterCanvas(W, H);
      canvas.drawWoodenTable(900 + f, 'normal');

      // Subtle conveyor / tray rail guideline
      for (let x = 0; x < W; x += 2) {
        canvas.blendPixel(x, Math.round(H * 0.48), 90, 62, 38, 0.35);
      }

      const detections = [];
      for (const tr of cfg.tracks) {
        const cx = Math.round(tr.xStart + (tr.xEnd - tr.xStart) * t);
        const cy = Math.round(tr.yBase + Math.sin(t * Math.PI * 2 + tr.track_id) * 6);
        const box = tr.paint(canvas, cx, cy, tr.scale);
        const bx = (box[0] + box[2]) / 2;
        const by = (box[1] + box[3]) / 2;
        const inside = pointInPolygon(bx, by, cfg.default_roi);
        if (inside) trackInsideSet.add(tr.track_id);
        const cls = CLASS_BY_NAME[tr.class_name];
        detections.push({
          track_id: tr.track_id,
          class_id: cls.id,
          class_name: cls.name,
          bbox_xyxy: box,
          in_roi: inside,
          confidence: Number((0.88 + (f % 4) * 0.02).toFixed(2)),
        });
      }

      const frameName = `frame_${String(f + 1).padStart(3, '0')}.png`;
      fs.writeFileSync(path.join(videoFramesDir, frameName), encodePNG(W, H, canvas.data));
      rgbaFrames.push(new Uint8Array(canvas.data));
      frameAnnotations.push({
        frame_index: f,
        frame_file: `samples/videos/frames/${cfg.id}/${frameName}`,
        detections,
      });
    }

    const aviBuf = encodeUncompressedAVI(W, H, FPS, rgbaFrames);
    fs.writeFileSync(path.join(VIDEOS_DIR, cfg.filename), aviBuf);

    return {
      id: cfg.id,
      filename: cfg.filename,
      path: `samples/videos/${cfg.filename}`,
      frames_dir: `samples/videos/frames/${cfg.id}`,
      format: 'AVI (24-bit BGR DIB) + PNG Frame Sequence',
      title: cfg.title,
      description: cfg.description,
      width: W,
      height: H,
      fps: FPS,
      frame_count: FRAME_COUNT,
      default_roi: cfg.default_roi,
      expected_tracks: cfg.tracks.map((tr) => ({
        track_id: tr.track_id,
        class_id: CLASS_BY_NAME[tr.class_name].id,
        class_name: tr.class_name,
        enters_roi: trackInsideSet.has(tr.track_id),
      })),
      frame_annotations: frameAnnotations,
    };
  });
}

function main() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  const images = generateSampleImages();
  const videos = generateSampleVideos();

  const catalog = {
    project: 'Sistem Deteksi, Counting, Tracking & Image Enhancement Kuliner Indonesia (YOLOv11)',
    generated_at: new Date().toISOString(),
    generator: 'scripts/prepare_samples.mjs',
    total_classes: CULINARY_CLASSES.length,
    classes: CULINARY_CLASSES,
    images,
    videos,
  };

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf-8');

  console.log(`[prepare_samples.mjs] Generated ${images.length} images in ${IMAGES_DIR}`);
  console.log(`[prepare_samples.mjs] Generated ${videos.length} AVI videos + PNG frame sequences in ${VIDEOS_DIR}`);
  console.log(`[prepare_samples.mjs] Wrote catalog to ${CATALOG_PATH}`);
}

main();
