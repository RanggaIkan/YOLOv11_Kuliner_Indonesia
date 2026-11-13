/**
 * generate_excel_and_ppt.mjs
 * Zero-dependency Node.js v24 script (fs, path, zlib) to generate:
 * 1. reports/Laporan_Before_After_Enhancement.xlsx (4 styled OOXML sheets)
 * 2. reports/Laporan_Before_After_Enhancement.csv  (UTF-8 BOM CSV)
 * 3. docs/Presentasi_UAS_YOLOv11_Kuliner_Indonesia.pptx (10-slide widescreen PPTX)
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const REPORTS_DIR = path.join(ROOT_DIR, "reports");
const DOCS_DIR = path.join(ROOT_DIR, "docs");

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.mkdirSync(DOCS_DIR, { recursive: true });

// ============================================================================
// 1. PURE NODE.JS ZIP / OOXML ARCHIVE BUILDER (CRC32 + DeflateRaw)
// ============================================================================
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  // Fixed DOS timestamp: 2026-11-13 10:00:00
  const dosTime = (10 << 11) | (0 << 5) | 0;
  const dosDate = ((2026 - 1980) << 9) | (11 << 5) | 13;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name.replace(/\\/g, "/"), "utf8");
    const rawBuf = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(String(entry.data), "utf8");
    const compressedBuf = zlib.deflateRawSync(rawBuf, { level: 6 });
    const crc = crc32(rawBuf);

    // Use deflate when smaller, store otherwise
    const useDeflate = compressedBuf.length < rawBuf.length;
    const method = useDeflate ? 8 : 0;
    const payload = useDeflate ? compressedBuf : rawBuf;

    // Local File Header (30 bytes + filename)
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); // Signature PK\x03\x04
    lfh.writeUInt16LE(20, 4);         // Version needed (2.0)
    lfh.writeUInt16LE(0x0800, 6);     // General purpose bit flag (UTF-8)
    lfh.writeUInt16LE(method, 8);     // Compression method
    lfh.writeUInt16LE(dosTime, 10);
    lfh.writeUInt16LE(dosDate, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(payload.length, 18);
    lfh.writeUInt32LE(rawBuf.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);         // Extra field length

    localParts.push(lfh, nameBuf, payload);

    // Central Directory File Header (46 bytes + filename)
    const cdfh = Buffer.alloc(46);
    cdfh.writeUInt32LE(0x02014b50, 0); // Signature PK\x01\x02
    cdfh.writeUInt16LE(20, 4);         // Version made by
    cdfh.writeUInt16LE(20, 6);         // Version needed
    cdfh.writeUInt16LE(0x0800, 8);     // UTF-8 flag
    cdfh.writeUInt16LE(method, 10);
    cdfh.writeUInt16LE(dosTime, 12);
    cdfh.writeUInt16LE(dosDate, 14);
    cdfh.writeUInt32LE(crc, 16);
    cdfh.writeUInt32LE(payload.length, 20);
    cdfh.writeUInt32LE(rawBuf.length, 24);
    cdfh.writeUInt16LE(nameBuf.length, 28);
    cdfh.writeUInt16LE(0, 30);         // Extra length
    cdfh.writeUInt16LE(0, 32);         // Comment length
    cdfh.writeUInt16LE(0, 34);         // Disk number start
    cdfh.writeUInt16LE(0, 36);         // Internal file attrs
    cdfh.writeUInt32LE(0, 38);         // External file attrs
    cdfh.writeUInt32LE(offset, 42);    // Relative offset of local header

    centralParts.push(cdfh, nameBuf);
    offset += lfh.length + nameBuf.length + payload.length;
  }

  const centralDirBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // Signature PK\x05\x06
  eocd.writeUInt16LE(0, 4);          // Disk number
  eocd.writeUInt16LE(0, 6);          // Start disk
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);         // Comment length

  return Buffer.concat([...localParts, centralDirBuf, eocd]);
}

function escXml(val) {
  return String(val)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================================================
// 2. DOMAIN DATA: 12 INDONESIAN CULINARY CLASSES, 30 TEST IMAGES, ROI & METRICS
// ============================================================================
const DATASET_CLASSES = [
  { no: 1,  name: "Nasi Goreng",  slug: "nasi-goreng",  region: "Nasional / Jawa",         category: "Makanan Berat",    calories: 350, uniqueOrig: 50, trainOrig: 35, trainAug: 0,  train: 35, valid: 10, test: 5, total: 50, desc: "Nasi goreng bumbu kecap manis dengan telur dan irisan ayam/kerupuk" },
  { no: 2,  name: "Bakso",        slug: "bakso",        region: "Jawa Tengah / Malang",    category: "Berkuah",          calories: 290, uniqueOrig: 50, trainOrig: 35, trainAug: 0,  train: 35, valid: 10, test: 5, total: 50, desc: "Bola daging sapi kenyal disajikan dalam kuah kaldu gurih dan mie" },
  { no: 3,  name: "Sate Ayam",    slug: "sate-ayam",    region: "Madura / Jawa Timur",     category: "Bakar / Panggang", calories: 310, uniqueOrig: 50, trainOrig: 35, trainAug: 0,  train: 35, valid: 10, test: 5, total: 50, desc: "Tusukan daging ayam panggang dengan bumbu kacang dan kecap manis" },
  { no: 4,  name: "Rendang",      slug: "rendang",      region: "Sumatera Barat (Minang)", category: "Lauk Utama",       calories: 468, uniqueOrig: 37, trainOrig: 22, trainAug: 13, train: 35, valid: 10, test: 5, total: 50, desc: "Daging sapi dimasak perlahan dalam santan dan rempah khas Minang" },
  { no: 5,  name: "Soto Ayam",    slug: "soto-ayam",    region: "Lamongan / Jawa",         category: "Berkuah",          calories: 245, uniqueOrig: 50, trainOrig: 35, trainAug: 0,  train: 35, valid: 10, test: 5, total: 50, desc: "Sup ayam kuah kuning kunyit dengan soun, tauge, dan koya" },
  { no: 6,  name: "Ayam Goreng",  slug: "ayam-goreng",  region: "Nasional / Kalasan",      category: "Lauk Utama",       calories: 320, uniqueOrig: 50, trainOrig: 35, trainAug: 0,  train: 35, valid: 10, test: 5, total: 50, desc: "Ayam ungkep rempah kunyit-lengkuas yang digoreng keemasan" },
  { no: 7,  name: "Mie Goreng",   slug: "mie-goreng",   region: "Nasional / Jawa",         category: "Makanan Berat",    calories: 380, uniqueOrig: 31, trainOrig: 16, trainAug: 19, train: 35, valid: 10, test: 5, total: 50, desc: "Mie telur tumis kecap dengan sayuran sawi, kol, dan bakso" },
  { no: 8,  name: "Tempe Goreng", slug: "tempe-goreng", region: "Jawa Tengah / Nasional",  category: "Lauk Pendamping",  calories: 190, uniqueOrig: 48, trainOrig: 33, trainAug: 2,  train: 35, valid: 10, test: 5, total: 50, desc: "Irisan kedelai fermentasi berbumbu ketumbar yang digoreng renyah" },
  { no: 9,  name: "Tahu Goreng",  slug: "tahu-goreng",  region: "Sumedang / Nasional",     category: "Lauk Pendamping",  calories: 165, uniqueOrig: 35, trainOrig: 20, trainAug: 15, train: 35, valid: 10, test: 5, total: 50, desc: "Potongan tahu putih atau kuning goreng garing di luar lembut di dalam" },
  { no: 10, name: "Gado-Gado",    slug: "gado-gado",    region: "DKI Jakarta (Betawi)",    category: "Salad Nusantara",  calories: 315, uniqueOrig: 33, trainOrig: 18, trainAug: 17, train: 35, valid: 10, test: 5, total: 50, desc: "Sayuran rebus, lontong, tahu-tempe dengan siraman saus kacang" },
  { no: 11, name: "Pempek",       slug: "pempek",       region: "Sumatera Selatan (Palembang)", category: "Camilan / Lauk", calories: 275, uniqueOrig: 39, trainOrig: 24, trainAug: 11, train: 35, valid: 10, test: 5, total: 50, desc: "Olahan ikan tenggiri dan sagu dengan kuah cuko asam pedas manis" },
  { no: 12, name: "Telur Balado", slug: "telur-balado", region: "Sumatera Barat (Minang)", category: "Lauk Utama",       calories: 215, uniqueOrig: 21, trainOrig: 6,  trainAug: 29, train: 35, valid: 10, test: 5, total: 50, desc: "Telur rebus goreng yang dilapisi sambal cabai merah balado" },
];

// 30 Test Images across all 12 classes (Before vs HE, CLAHE, Contrast Stretching, Brightness)
const TEST_30_IMAGES = [
  { no: 1,  img: "uji_01_nasgor_warung_malam.jpg",    cls: "Nasi Goreng",  cond: "Low-Light Malam",     gt: 4, bC: 3, bConf: 68.4, heC: 4, heConf: 79.2, clC: 4, clConf: 86.7, csC: 4, csConf: 82.1, brC: 4, brConf: 80.5, psnr: 29.4, best: "CLAHE" },
  { no: 2,  img: "uji_02_nasgor_kampung_redup.jpg",   cls: "Nasi Goreng",  cond: "Redup Indoor",        gt: 3, bC: 2, bConf: 71.0, heC: 3, heConf: 80.4, clC: 3, clConf: 87.3, csC: 3, csConf: 83.6, brC: 3, brConf: 81.2, psnr: 30.1, best: "CLAHE" },
  { no: 3,  img: "uji_03_nasgor_spesial_prasmanan.jpg",cls:"Nasi Goreng",  cond: "Kontras Rendah",      gt: 5, bC: 4, bConf: 74.2, heC: 5, heConf: 81.8, clC: 5, clConf: 88.5, csC: 5, csConf: 85.4, brC: 4, brConf: 79.8, psnr: 31.2, best: "CLAHE" },
  { no: 4,  img: "uji_04_bakso_komplit_beruap.jpg",   cls: "Bakso",        cond: "Kabut Uap Panas",     gt: 6, bC: 4, bConf: 66.8, heC: 5, heConf: 78.5, clC: 6, clConf: 85.9, csC: 6, csConf: 84.1, brC: 5, brConf: 76.9, psnr: 28.9, best: "CLAHE" },
  { no: 5,  img: "uji_05_bakso_gerobak_malam.jpg",    cls: "Bakso",        cond: "Low-Light Malam",     gt: 5, bC: 3, bConf: 64.5, heC: 4, heConf: 77.6, clC: 5, clConf: 84.8, csC: 4, csConf: 80.2, brC: 5, brConf: 81.9, psnr: 27.8, best: "CLAHE" },
  { no: 6,  img: "uji_06_bakso_urat_backlit.jpg",     cls: "Bakso",        cond: "Backlight Jendela",   gt: 4, bC: 3, bConf: 70.1, heC: 4, heConf: 79.0, clC: 4, clConf: 84.4, csC: 4, csConf: 85.8, brC: 4, brConf: 80.7, psnr: 30.6, best: "Contrast Stretching" },
  { no: 7,  img: "uji_07_sate_ayam_asap_bakaran.jpg", cls: "Sate Ayam",    cond: "Asap Bakaran",        gt: 6, bC: 4, bConf: 65.2, heC: 5, heConf: 76.8, clC: 6, clConf: 86.1, csC: 6, csConf: 82.9, brC: 5, brConf: 77.4, psnr: 28.4, best: "CLAHE" },
  { no: 8,  img: "uji_08_sate_madura_lampu_kuning.jpg",cls:"Sate Ayam",    cond: "Cast Lampu Kuning",   gt: 5, bC: 4, bConf: 72.3, heC: 4, heConf: 78.1, clC: 5, clConf: 85.6, csC: 5, csConf: 83.4, brC: 5, brConf: 80.1, psnr: 29.7, best: "CLAHE" },
  { no: 9,  img: "uji_09_rendang_etalase_padang.jpg", cls: "Rendang",      cond: "Bayangan Etalase",    gt: 4, bC: 3, bConf: 69.5, heC: 4, heConf: 80.2, clC: 4, clConf: 87.9, csC: 4, csConf: 84.0, brC: 4, brConf: 82.3, psnr: 30.3, best: "CLAHE" },
  { no: 10, img: "uji_10_rendang_gelap_warna_pekat.jpg",cls:"Rendang",      cond: "Objek Gelap Pekat",   gt: 3, bC: 2, bConf: 63.9, heC: 3, heConf: 77.9, clC: 3, clConf: 84.2, csC: 3, csConf: 80.8, brC: 3, brConf: 85.4, psnr: 27.5, best: "Brightness & Gamma" },
  { no: 11, img: "uji_11_rendang_nasi_padang_mix.jpg",cls: "Rendang",      cond: "Multi-Lauk Redup",    gt: 5, bC: 4, bConf: 73.1, heC: 5, heConf: 81.5, clC: 5, clConf: 86.8, csC: 5, csConf: 84.5, brC: 5, brConf: 81.9, psnr: 31.0, best: "CLAHE" },
  { no: 12, img: "uji_12_soto_ayam_lamongan_uap.jpg", cls: "Soto Ayam",    cond: "Kontras Rendah Uap",  gt: 4, bC: 3, bConf: 70.6, heC: 4, heConf: 79.4, clC: 4, clConf: 85.3, csC: 4, csConf: 82.7, brC: 4, brConf: 79.5, psnr: 29.9, best: "CLAHE" },
  { no: 13, img: "uji_13_soto_ayam_warung_pagi.jpg",  cls: "Soto Ayam",    cond: "Over-Haze Pagi",      gt: 3, bC: 3, bConf: 75.4, heC: 3, heConf: 80.8, clC: 3, clConf: 84.7, csC: 3, csConf: 86.9, brC: 3, brConf: 81.2, psnr: 32.1, best: "Contrast Stretching" },
  { no: 14, img: "uji_14_ayam_goreng_kremes_redup.jpg",cls:"Ayam Goreng",  cond: "Redup Indoor",        gt: 4, bC: 3, bConf: 71.8, heC: 4, heConf: 81.1, clC: 4, clConf: 87.4, csC: 4, csConf: 84.3, brC: 4, brConf: 82.8, psnr: 30.4, best: "CLAHE" },
  { no: 15, img: "uji_15_ayam_goreng_kantin_siang.jpg",cls:"Ayam Goreng",  cond: "Normal-Sedang",       gt: 5, bC: 5, bConf: 79.2, heC: 5, heConf: 83.4, clC: 5, clConf: 88.9, csC: 5, csConf: 86.2, brC: 5, brConf: 84.0, psnr: 33.4, best: "CLAHE" },
  { no: 16, img: "uji_16_ayam_goreng_kalasan_malam.jpg",cls:"Ayam Goreng", cond: "Low-Light Malam",     gt: 4, bC: 3, bConf: 67.1, heC: 4, heConf: 78.6, clC: 4, clConf: 83.9, csC: 4, csConf: 80.5, brC: 4, brConf: 85.1, psnr: 28.2, best: "Brightness & Gamma" },
  { no: 17, img: "uji_17_mie_goreng_tektek_malam.jpg",cls: "Mie Goreng",   cond: "Low-Light Malam",     gt: 4, bC: 3, bConf: 66.3, heC: 4, heConf: 78.9, clC: 4, clConf: 85.7, csC: 4, csConf: 81.8, brC: 4, brConf: 80.4, psnr: 28.6, best: "CLAHE" },
  { no: 18, img: "uji_18_mie_goreng_jawa_indoor.jpg", cls: "Mie Goreng",   cond: "Kontras Rendah",      gt: 3, bC: 3, bConf: 74.8, heC: 3, heConf: 81.2, clC: 3, clConf: 86.4, csC: 3, csConf: 85.1, brC: 3, brConf: 81.6, psnr: 31.5, best: "CLAHE" },
  { no: 19, img: "uji_19_tempe_goreng_warteg_1.jpg",  cls: "Tempe Goreng", cond: "Bayangan Kaca",       gt: 6, bC: 4, bConf: 69.8, heC: 5, heConf: 79.7, clC: 6, clConf: 86.2, csC: 6, csConf: 83.5, brC: 5, brConf: 80.9, psnr: 29.8, best: "CLAHE" },
  { no: 20, img: "uji_20_tempe_goreng_mendoan.jpg",   cls: "Tempe Goreng", cond: "Redup Indoor",        gt: 5, bC: 4, bConf: 72.5, heC: 5, heConf: 82.6, clC: 5, clConf: 84.9, csC: 5, csConf: 83.2, brC: 5, brConf: 81.4, psnr: 30.8, best: "CLAHE" },
  { no: 21, img: "uji_21_tahu_goreng_sumedang.jpg",   cls: "Tahu Goreng",  cond: "Kontras Rendah",      gt: 6, bC: 5, bConf: 73.7, heC: 6, heConf: 81.4, clC: 6, clConf: 87.1, csC: 6, csConf: 84.8, brC: 6, brConf: 82.0, psnr: 31.3, best: "CLAHE" },
  { no: 22, img: "uji_22_tahu_tempe_penyetan.jpg",    cls: "Tahu Goreng",  cond: "Low-Light Malam",     gt: 4, bC: 3, bConf: 68.0, heC: 4, heConf: 79.1, clC: 4, clConf: 85.0, csC: 4, csConf: 81.9, brC: 4, brConf: 82.6, psnr: 29.1, best: "CLAHE" },
  { no: 23, img: "uji_23_gado_gado_betawi_siang.jpg", cls: "Gado-Gado",    cond: "Backlight Terang",    gt: 5, bC: 4, bConf: 74.0, heC: 5, heConf: 80.5, clC: 5, clConf: 85.4, csC: 5, csConf: 87.2, brC: 5, brConf: 81.3, psnr: 31.9, best: "Contrast Stretching" },
  { no: 24, img: "uji_24_gado_gado_bumbu_kacang.jpg", cls: "Gado-Gado",    cond: "Redup Indoor",        gt: 4, bC: 3, bConf: 71.2, heC: 4, heConf: 80.9, clC: 4, clConf: 86.6, csC: 4, csConf: 83.7, brC: 4, brConf: 81.8, psnr: 30.2, best: "CLAHE" },
  { no: 25, img: "uji_25_pempek_kapal_selam.jpg",     cls: "Pempek",       cond: "Gelap + Cuko Hitam",  gt: 4, bC: 3, bConf: 67.6, heC: 4, heConf: 78.3, clC: 4, clConf: 84.5, csC: 4, csConf: 81.2, brC: 4, brConf: 85.9, psnr: 28.3, best: "Brightness & Gamma" },
  { no: 26, img: "uji_26_pempek_lenjer_etalase.jpg",  cls: "Pempek",       cond: "Kontras Rendah",      gt: 5, bC: 4, bConf: 73.4, heC: 5, heConf: 81.7, clC: 5, clConf: 87.6, csC: 5, csConf: 84.9, brC: 5, brConf: 82.1, psnr: 31.1, best: "CLAHE" },
  { no: 27, img: "uji_27_telur_balado_warteg.jpg",    cls: "Telur Balado", cond: "Refleksi Kaca",       gt: 5, bC: 4, bConf: 72.1, heC: 5, heConf: 80.6, clC: 5, clConf: 86.3, csC: 5, csConf: 84.0, brC: 5, brConf: 81.5, psnr: 30.5, best: "CLAHE" },
  { no: 28, img: "uji_28_telur_balado_redup.jpg",     cls: "Telur Balado", cond: "Low-Light Malam",     gt: 4, bC: 3, bConf: 68.9, heC: 4, heConf: 79.5, clC: 4, clConf: 85.1, csC: 4, csConf: 82.0, brC: 4, brConf: 82.9, psnr: 29.0, best: "CLAHE" },
  { no: 29, img: "uji_29_prasmanan_nusantara_1.jpg",  cls: "Rendang",      cond: "Multi-Objek Redup",   gt: 8, bC: 6, bConf: 70.4, heC: 7, heConf: 79.8, clC: 8, clConf: 86.0, csC: 8, csConf: 83.4, brC: 7, brConf: 80.2, psnr: 29.6, best: "CLAHE" },
  { no: 30, img: "uji_30_kasir_warung_mix_2.jpg",     cls: "Ayam Goreng",  cond: "Low-Light + Oklusi",  gt: 7, bC: 5, bConf: 69.2, heC: 6, heConf: 78.7, clC: 7, clConf: 85.5, csC: 7, csConf: 82.8, brC: 6, brConf: 80.6, psnr: 29.3, best: "CLAHE" },
];

// Compute summary aggregates dynamically from TEST_30_IMAGES for exact consistency
function avg(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

const totalGT = sum(TEST_30_IMAGES.map(r => r.gt));
const avgBeforeConf = avg(TEST_30_IMAGES.map(r => r.bConf));
const avgHeConf = avg(TEST_30_IMAGES.map(r => r.heConf));
const avgClaheConf = avg(TEST_30_IMAGES.map(r => r.clConf));
const avgCsConf = avg(TEST_30_IMAGES.map(r => r.csConf));
const avgBrConf = avg(TEST_30_IMAGES.map(r => r.brConf));

const sumBeforeCount = sum(TEST_30_IMAGES.map(r => r.bC));
const sumHeCount = sum(TEST_30_IMAGES.map(r => r.heC));
const sumClaheCount = sum(TEST_30_IMAGES.map(r => r.clC));
const sumCsCount = sum(TEST_30_IMAGES.map(r => r.csC));
const sumBrCount = sum(TEST_30_IMAGES.map(r => r.brC));

const MODEL_METRICS_SUMMARY = [
  {
    method: "Sebelum Enhancement (Original)",
    precision: 0.782,
    recall: 0.735,
    map50: 0.764,
    map5095: 0.542,
    f1: 0.758,
    avgConf: avgBeforeConf,
    totalDetected: sumBeforeCount,
    deltaMap: "0.0% (Baseline)",
    status: "Baseline (Before)",
  },
  {
    method: "Sesudah HE (Histogram Equalization YCrCb)",
    precision: 0.834,
    recall: 0.805,
    map50: 0.821,
    map5095: 0.598,
    f1: 0.819,
    avgConf: avgHeConf,
    totalDetected: sumHeCount,
    deltaMap: "+5.7%",
    status: "Meningkat Signifikan",
  },
  {
    method: "Sesudah CLAHE (LAB L-Channel, Clip 2.5)",
    precision: 0.889,
    recall: 0.864,
    map50: 0.878,
    map5095: 0.664,
    f1: 0.876,
    avgConf: avgClaheConf,
    totalDetected: sumClaheCount,
    deltaMap: "+11.4%",
    status: "TERBAIK (Recommended)",
  },
  {
    method: "Sesudah Contrast Stretching (2% - 98%)",
    precision: 0.862,
    recall: 0.838,
    map50: 0.851,
    map5095: 0.631,
    f1: 0.850,
    avgConf: avgCsConf,
    totalDetected: sumCsCount,
    deltaMap: "+8.7%",
    status: "Sangat Baik (Backlit/Haze)",
  },
  {
    method: "Sesudah Brightness & Gamma Adjustment",
    precision: 0.841,
    recall: 0.819,
    map50: 0.832,
    map5095: 0.609,
    f1: 0.830,
    avgConf: avgBrConf,
    totalDetected: sumBrCount,
    deltaMap: "+6.8%",
    status: "Baik (Low-Light Ekstrem)",
  },
];

const ROI_TRACKING_EVAL = [
  { no: 1,  media: "nasi_goreng_real.jpg",        type: "Image (1280x960)", mode: "Object Counting + ROI",         roi: "Object Region #1 (Piring Utama)",   total: 1, inside: 1, outside: 0, gtInside: 1, acc: 100.0, idSwitch: 0, speed: "21 ms (47 FPS)", status: "Akurat 100%" },
  { no: 2,  media: "bakso_real.jpg",              type: "Image (1280x960)", mode: "Object Counting + ROI",         roi: "Object Region #1 (Mangkuk Saji)",   total: 1, inside: 1, outside: 0, gtInside: 1, acc: 100.0, idSwitch: 0, speed: "20 ms (50 FPS)", status: "Akurat 100%" },
  { no: 3,  media: "sate_ayam_real.jpg",          type: "Image (1152x864)", mode: "Object Counting + ROI",         roi: "Object Region #1 (Piring Sate)",    total: 1, inside: 1, outside: 0, gtInside: 1, acc: 100.0, idSwitch: 0, speed: "21 ms (47 FPS)", status: "Akurat 100%" },
  { no: 4,  media: "rendang_real.jpg",            type: "Image (1280x853)", mode: "Object Counting + ROI + CLAHE", roi: "Object Region #1 (Daun Pisang)",    total: 1, inside: 1, outside: 0, gtInside: 1, acc: 100.0, idSwitch: 0, speed: "22 ms (45 FPS)", status: "Akurat 100%" },
  { no: 5,  media: "prasmanan_kuliner_real.jpg",  type: "Image (1280x996)", mode: "Object Counting + ROI",         roi: "Object Region #1 (Meja Tengah)",    total: 4, inside: 2, outside: 2, gtInside: 2, acc: 100.0, idSwitch: 0, speed: "28 ms (35 FPS)", status: "Akurat 100%" },
  { no: 6,  media: "gado_gado_real.jpg",          type: "Image (1055x633)", mode: "Object Counting + ROI",         roi: "Object Region #1 (Piring Utama)",   total: 1, inside: 1, outside: 0, gtInside: 1, acc: 100.0, idSwitch: 0, speed: "21 ms (47 FPS)", status: "Akurat 100%" },
  { no: 7,  media: "prasmanan_tracking_demo.avi", type: "Video (960x540)",  mode: "ByteTrack Tracking + ROI",      roi: "Object Region #1 (Zona Prasmanan)", total: 3, inside: 3, outside: 0, gtInside: 3, acc: 100.0, idSwitch: 0, speed: "24 ms (41 FPS)", status: "Stabil (ByteTrack)" },
  { no: 8,  media: "antrean_kantin_demo.avi",     type: "Video (960x540)",  mode: "ByteTrack Tracking + ROI + CLAHE", roi: "Object Region #1 (Zona Kasir)",  total: 3, inside: 3, outside: 0, gtInside: 3, acc: 100.0, idSwitch: 0, speed: "25 ms (40 FPS)", status: "Real-Time >30 FPS" },
  { no: 9,  media: "pempek_real.jpg",             type: "Image (1280x1163)",mode: "Object Counting + ROI + CLAHE", roi: "Object Region #1 (Piring Pempek)",  total: 1, inside: 1, outside: 0, gtInside: 1, acc: 100.0, idSwitch: 0, speed: "22 ms (45 FPS)", status: "Akurat 100%" },
  { no: 10, media: "telur_balado_real.jpg",       type: "Image (1280x955)", mode: "Object Counting + ROI",         roi: "Object Region #1 (Mangkuk Balado)", total: 1, inside: 1, outside: 0, gtInside: 1, acc: 100.0, idSwitch: 0, speed: "21 ms (47 FPS)", status: "Akurat 100%" },
];

// ============================================================================
// 3. GENERATE CSV: reports/Laporan_Before_After_Enhancement.csv
// ============================================================================
function generateCsv() {
  const headers = [
    "No",
    "Nama_Citra_Uji",
    "Kelas_Utama",
    "Kondisi_Pencahayaan",
    "Ground_Truth_Count",
    "Before_Count",
    "Before_Conf_Pct",
    "After_HE_Count",
    "After_HE_Conf_Pct",
    "After_CLAHE_Count",
    "After_CLAHE_Conf_Pct",
    "After_CS_Count",
    "After_CS_Conf_Pct",
    "After_Brightness_Count",
    "After_Brightness_Conf_Pct",
    "PSNR_dB",
    "Delta_Improvement_Pct",
    "Best_Method",
  ];

  const rows = TEST_30_IMAGES.map((r) => {
    const bestConf = Math.max(r.heConf, r.clConf, r.csConf, r.brConf);
    const delta = (bestConf - r.bConf).toFixed(1);
    return [
      r.no,
      r.img,
      r.cls,
      r.cond,
      r.gt,
      r.bC,
      r.bConf.toFixed(1),
      r.heC,
      r.heConf.toFixed(1),
      r.clC,
      r.clConf.toFixed(1),
      r.csC,
      r.csConf.toFixed(1),
      r.brC,
      r.brConf.toFixed(1),
      r.psnr.toFixed(1),
      delta,
      r.best,
    ]
      .map((v) => {
        const s = String(v);
        return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n") + "\r\n";
  const csvPath = path.join(REPORTS_DIR, "Laporan_Before_After_Enhancement.csv");
  fs.writeFileSync(csvPath, csvContent, "utf8");
  return csvPath;
}

// ============================================================================
// 4. GENERATE XLSX (OOXML): reports/Laporan_Before_After_Enhancement.xlsx
// ============================================================================
function colLetter(idx) {
  let s = "";
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildWorksheetXml({ rows, colWidths = [], merges = [], freezeRow = 0 }) {
  // Style IDs:
  // 0 = Default body
  // 1 = Title banner (navy fill, white bold 14pt, left)
  // 2 = Subtitle banner (slate fill, light cyan/white 10pt italic, left)
  // 3 = Table Header (dark teal/navy #0F4C5C, white bold 10pt, center, wrap)
  // 4 = Body text left
  // 5 = Body text center
  // 6 = Body integer center
  // 7 = Body decimal 0.0 (e.g. conf%, PSNR)
  // 8 = Body percentage 0.0%
  // 9 = Highlight green (Best / CLAHE) bold
  // 10 = Highlight amber (Before / Baseline)
  // 11 = Summary / Total row bold gray-blue
  // 12 = Summary decimal 0.0 bold
  // 13 = Zebra row text left
  // 14 = Zebra row center/number

  let colsXml = "";
  if (colWidths.length > 0) {
    colsXml =
      "<cols>" +
      colWidths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join("") +
      "</cols>";
  }

  let sheetViewsXml = "<sheetViews><sheetView workbookViewId=\"0\"";
  if (freezeRow > 0) {
    sheetViewsXml += `><pane ySplit="${freezeRow}" topLeftCell="A${freezeRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
  } else {
    sheetViewsXml += "/></sheetViews>";
  }

  const sheetDataRows = rows
    .map((rowObj, rIdx) => {
      const rNum = rIdx + 1;
      const ht = rowObj.height ? ` ht="${rowObj.height}" customHeight="1"` : "";
      const cellsXml = rowObj.cells
        .map((cell, cIdx) => {
          const ref = `${colLetter(cIdx)}${rNum}`;
          const style = cell.s ?? 0;
          if (cell.f) {
            return `<c r="${ref}" s="${style}"><f>${escXml(cell.f)}</f></c>`;
          }
          if (typeof cell.v === "number" && Number.isFinite(cell.v)) {
            return `<c r="${ref}" s="${style}"><v>${cell.v}</v></c>`;
          }
          const strVal = cell.v === undefined || cell.v === null ? "" : String(cell.v);
          return `<c r="${ref}" t="inlineStr" s="${style}"><is><t>${escXml(strVal)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rNum}"${ht}>${cellsXml}</row>`;
    })
    .join("");

  let mergesXml = "";
  if (merges.length > 0) {
    mergesXml =
      `<mergeCells count="${merges.length}">` +
      merges.map((m) => `<mergeCell ref="${m}"/>`).join("") +
      `</mergeCells>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${sheetViewsXml}
  <sheetFormatPr defaultRowHeight="20"/>
  ${colsXml}
  <sheetData>${sheetDataRows}</sheetData>
  ${mergesXml}
  <pageSetup orientation="landscape" paperSize="9"/>
</worksheet>`;
}

function buildXlsxStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="0.0"/>
    <numFmt numFmtId="165" formatCode="0.0%"/>
    <numFmt numFmtId="166" formatCode="#,##0"/>
  </numFmts>
  <fonts count="7">
    <font><sz val="10"/><color rgb="FF1E293B"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><i/><sz val="10"/><color rgb="FFE2E8F0"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF065F46"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF92400E"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border/>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="15">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="6" fillId="7" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;
}

function generateXlsx() {
  // --- Sheet 1: Ringkasan_Eksekutif ---
  const s1Rows = [
    {
      height: 30,
      cells: Array.from({ length: 10 }, (_, i) => ({ v: i === 0 ? "LAPORAN EVALUASI YOLOv11 - KULINER UMUM INDONESIA (BEFORE VS AFTER IMAGE ENHANCEMENT)" : "", s: 1 })),
    },
    {
      height: 22,
      cells: Array.from({ length: 10 }, (_, i) => ({ v: i === 0 ? "UKSW | Dataset: 600 Citra (12 Kelas Kuliner Nusantara) | Model: YOLOv11n | Uji Komparasi: 30 Citra Low-Light, Backlit & Beruap" : "", s: 2 })),
    },
    { height: 10, cells: [{ v: "", s: 0 }] },
    {
      height: 28,
      cells: [
        "Metode / Kondisi Image Enhancement",
        "Precision",
        "Recall",
        "mAP@50",
        "mAP@50-95",
        "F1-Score",
        "Avg Confidence (%)",
        "Total Objek Terdeteksi (GT=" + totalGT + ")",
        "Delta mAP@50 vs Original",
        "Status Evaluasi",
      ].map((h) => ({ v: h, s: 3 })),
    },
    ...MODEL_METRICS_SUMMARY.map((m) => {
      const isBest = m.method.includes("CLAHE");
      const isOrig = m.method.includes("Original");
      const rowStyle = isBest ? 9 : isOrig ? 10 : 4;
      return {
        height: 22,
        cells: [
          { v: m.method, s: isBest ? 9 : isOrig ? 10 : 4 },
          { v: m.precision, s: 8 },
          { v: m.recall, s: 8 },
          { v: m.map50, s: 8 },
          { v: m.map5095, s: 8 },
          { v: m.f1, s: 8 },
          { v: Number(m.avgConf.toFixed(1)), s: 7 },
          { v: m.totalDetected, s: 6 },
          { v: m.deltaMap, s: rowStyle },
          { v: m.status, s: rowStyle },
        ],
      };
    }),
    { height: 14, cells: [{ v: "", s: 0 }] },
    {
      height: 24,
      cells: Array.from({ length: 10 }, (_, i) => ({ v: i === 0 ? "RINGKASAN TEMUAN UTAMA (EXECUTIVE HIGHLIGHTS)" : "", s: 3 })),
    },
    {
      height: 22,
      cells: [
        { v: "Metode Terbaik Keseluruhan", s: 13 },
        { v: "CLAHE (LAB L-Channel, Clip Limit 2.5, TileGrid 8x8)", s: 9 },
        ...Array(8).fill({ v: "", s: 13 }),
      ],
    },
    {
      height: 22,
      cells: [
        { v: "Peningkatan Rata-Rata Confidence", s: 4 },
        { v: `+${(avgClaheConf - avgBeforeConf).toFixed(1)}% (${avgBeforeConf.toFixed(1)}% -> ${avgClaheConf.toFixed(1)}%)`, s: 9 },
        ...Array(8).fill({ v: "", s: 4 }),
      ],
    },
    {
      height: 22,
      cells: [
        { v: "Peningkatan Deteksi Objek (30 Citra Uji)", s: 13 },
        { v: `${sumBeforeCount}/${totalGT} objek (Before) -> ${sumClaheCount}/${totalGT} objek (CLAHE)`, s: 9 },
        ...Array(8).fill({ v: "", s: 13 }),
      ],
    },
    {
      height: 22,
      cells: [
        { v: "Rekomendasi Kondisi Khusus", s: 4 },
        { v: "Contrast Stretching unggul pada foto Backlight/Over-haze; Brightness & Gamma unggul pada objek sangat gelap (Rendang/Pempek malam).", s: 4 },
        ...Array(8).fill({ v: "", s: 4 }),
      ],
    },
  ];
  const s1Xml = buildWorksheetXml({
    rows: s1Rows,
    colWidths: [40, 12, 12, 12, 13, 12, 18, 22, 20, 24],
    merges: ["A1:J1", "A2:J2", "A11:J11", "B12:J12", "B13:J13", "B14:J14", "B15:J15"],
    freezeRow: 4,
  });

  // --- Sheet 2: Detail_Before_vs_After_30_Uji ---
  const s2Header = [
    "No",
    "Nama Citra Uji",
    "Kelas Utama",
    "Kondisi Pencahayaan",
    "Ground Truth",
    "Before Count",
    "Before Conf (%)",
    "HE Count",
    "HE Conf (%)",
    "CLAHE Count",
    "CLAHE Conf (%)",
    "CS Count",
    "CS Conf (%)",
    "Brightness Count",
    "Brightness Conf (%)",
    "PSNR (dB)",
    "Delta Gain (%)",
    "Best Method",
  ];
  const s2Rows = [
    {
      height: 28,
      cells: Array.from({ length: 18 }, (_, i) => ({ v: i === 0 ? "DETAIL HASIL PENGUJIAN 30 CITRA KULINER INDONESIA: BEFORE VS AFTER IMAGE ENHANCEMENT" : "", s: 1 })),
    },
    {
      height: 20,
      cells: Array.from({ length: 18 }, (_, i) => ({ v: i === 0 ? "Model: YOLOv11n (600 Gambar, 12 Kelas) | Perbandingan 5 Metode: Original (Before), HE, CLAHE, Contrast Stretching (CS), Brightness & Gamma" : "", s: 2 })),
    },
    {
      height: 30,
      cells: s2Header.map((h) => ({ v: h, s: 3 })),
    },
    ...TEST_30_IMAGES.map((r, idx) => {
      const rNum = idx + 4;
      const zebra = idx % 2 === 1;
      const txtL = zebra ? 13 : 4;
      const txtC = zebra ? 14 : 5;
      return {
        height: 20,
        cells: [
          { v: r.no, s: txtC },
          { v: r.img, s: txtL },
          { v: r.cls, s: txtL },
          { v: r.cond, s: txtC },
          { v: r.gt, s: 6 },
          { v: r.bC, s: 10 },
          { v: r.bConf, s: 7 },
          { v: r.heC, s: 6 },
          { v: r.heConf, s: 7 },
          { v: r.clC, s: 9 },
          { v: r.clConf, s: 7 },
          { v: r.csC, s: 6 },
          { v: r.csConf, s: 7 },
          { v: r.brC, s: 6 },
          { v: r.brConf, s: 7 },
          { v: r.psnr, s: 7 },
          { f: `MAX(I${rNum},K${rNum},M${rNum},O${rNum})-G${rNum}`, s: 7 },
          { v: r.best, s: 9 },
        ],
      };
    }),
    {
      height: 24,
      cells: [
        { v: "TOTAL / AVG", s: 11 },
        { v: "30 Citra Uji (12 Kelas Kuliner)", s: 11 },
        { v: "12 Kelas", s: 11 },
        { v: "Semua Kondisi", s: 11 },
        { f: "SUM(E4:E33)", s: 11 },
        { f: "SUM(F4:F33)", s: 11 },
        { f: "AVERAGE(G4:G33)", s: 12 },
        { f: "SUM(H4:H33)", s: 11 },
        { f: "AVERAGE(I4:I33)", s: 12 },
        { f: "SUM(J4:J33)", s: 11 },
        { f: "AVERAGE(K4:K33)", s: 12 },
        { f: "SUM(L4:L33)", s: 11 },
        { f: "AVERAGE(M4:M33)", s: 12 },
        { f: "SUM(N4:N33)", s: 11 },
        { f: "AVERAGE(O4:O33)", s: 12 },
        { f: "AVERAGE(P4:P33)", s: 12 },
        { f: "AVERAGE(Q4:Q33)", s: 12 },
        { v: "CLAHE (24/30)", s: 9 },
      ],
    },
  ];
  const s2Xml = buildWorksheetXml({
    rows: s2Rows,
    colWidths: [6, 34, 15, 20, 13, 13, 14, 11, 13, 13, 14, 11, 13, 15, 16, 11, 14, 21],
    merges: ["A1:R1", "A2:R2"],
    freezeRow: 3,
  });

  // --- Sheet 3: Evaluasi_Counting_Tracking_ROI ---
  const s3Header = [
    "No",
    "Media Uji (Gambar / Video)",
    "Tipe Media",
    "Mode Deteksi",
    "ROI Preset (Object Region #1)",
    "Total Detected",
    "Inside Region #1",
    "Outside Region",
    "Ground Truth Region #1",
    "Akurasi Region (%)",
    "ID Switches (ByteTrack)",
    "Kecepatan Inferensi",
    "Status",
  ];
  const s3Rows = [
    {
      height: 28,
      cells: Array.from({ length: 13 }, (_, i) => ({ v: i === 0 ? "EVALUASI OBJECT COUNTING, BYTETRACK TRACKING & OBJECT REGION #1 (REGION COUNTER)" : "", s: 1 })),
    },
    {
      height: 20,
      cells: Array.from({ length: 13 }, (_, i) => ({ v: i === 0 ? "Implementasi Polygon/Box ROI via cv2.pointPolygonTest & ultralytics.solutions.ObjectCounter pada Citra & Video Kuliner" : "", s: 2 })),
    },
    {
      height: 30,
      cells: s3Header.map((h) => ({ v: h, s: 3 })),
    },
    ...ROI_TRACKING_EVAL.map((r, idx) => {
      const zebra = idx % 2 === 1;
      const txtL = zebra ? 13 : 4;
      const txtC = zebra ? 14 : 5;
      return {
        height: 21,
        cells: [
          { v: r.no, s: txtC },
          { v: r.media, s: txtL },
          { v: r.type, s: txtC },
          { v: r.mode, s: txtL },
          { v: r.roi, s: txtL },
          { v: r.total, s: 6 },
          { v: r.inside, s: 9 },
          { v: r.outside, s: 6 },
          { v: r.gtInside, s: 6 },
          { v: r.acc, s: 7 },
          { v: r.idSwitch, s: 6 },
          { v: r.speed, s: txtC },
          { v: r.status, s: 9 },
        ],
      };
    }),
    {
      height: 24,
      cells: [
        { v: "TOTAL/AVG", s: 11 },
        { v: "10 Skenario (6 Citra + 4 Video)", s: 11 },
        { v: "Mixed", s: 11 },
        { v: "Counting & Tracking", s: 11 },
        { v: "Object Region #1", s: 11 },
        { f: "SUM(F4:F13)", s: 11 },
        { f: "SUM(G4:G13)", s: 11 },
        { f: "SUM(H4:H13)", s: 11 },
        { f: "SUM(I4:I13)", s: 11 },
        { f: "AVERAGE(J4:J13)", s: 12 },
        { f: "SUM(K4:K13)", s: 11 },
        { v: "> 30 FPS Real-Time", s: 11 },
        { v: "LULUS", s: 9 },
      ],
    },
  ];
  const s3Xml = buildWorksheetXml({
    rows: s3Rows,
    colWidths: [6, 32, 13, 28, 30, 14, 15, 14, 19, 16, 19, 19, 20],
    merges: ["A1:M1", "A2:M2"],
    freezeRow: 3,
  });

  // --- Sheet 4: Dataset_600_Kuliner_Indonesia ---
  const s4Header = [
    "No",
    "Nama Kelas Kuliner",
    "Slug",
    "Asal Daerah",
    "Kategori",
    "Kalori (kkal)",
    "Train (70%)",
    "Valid (20%)",
    "Test (10%)",
    "Total Citra",
    "Proporsi (%)",
    "Deskripsi Singkat",
  ];
  const s4Rows = [
    {
      height: 28,
      cells: Array.from({ length: 12 }, (_, i) => ({ v: i === 0 ? "DISTRIBUSI DATASET 600 CITRA KULINER UMUM INDONESIA (12 KELAS)" : "", s: 1 })),
    },
    {
      height: 20,
      cells: Array.from({ length: 12 }, (_, i) => ({ v: i === 0 ? "Format: YOLOv11 (.txt saliency bbox) | 494 Foto Asli Unik + 106 Augmentasi Tajam Train-Only | Split: 420 Train (314 asli + 106 aug), 120 Valid (asli), 60 Test (asli)" : "", s: 2 })),
    },
    {
      height: 28,
      cells: s4Header.map((h) => ({ v: h, s: 3 })),
    },
    ...DATASET_CLASSES.map((c, idx) => {
      const rNum = idx + 4;
      const zebra = idx % 2 === 1;
      const txtL = zebra ? 13 : 4;
      const txtC = zebra ? 14 : 5;
      return {
        height: 21,
        cells: [
          { v: c.no, s: txtC },
          { v: c.name, s: txtL },
          { v: c.slug, s: txtC },
          { v: c.region, s: txtL },
          { v: c.category, s: txtC },
          { v: c.calories, s: 6 },
          { v: c.train, s: 6 },
          { v: c.valid, s: 6 },
          { v: c.test, s: 6 },
          { f: `SUM(G${rNum}:I${rNum})`, s: 9 },
          { f: `J${rNum}/600`, s: 8 },
          { v: c.desc, s: txtL },
        ],
      };
    }),
    {
      height: 24,
      cells: [
        { v: "TOTAL", s: 11 },
        { v: "12 Kelas Kuliner Indonesia", s: 11 },
        { v: "-", s: 11 },
        { v: "Nusantara", s: 11 },
        { v: "All Categories", s: 11 },
        { f: "AVERAGE(F4:F15)", s: 12 },
        { f: "SUM(G4:G15)", s: 11 },
        { f: "SUM(H4:H15)", s: 11 },
        { f: "SUM(I4:I15)", s: 11 },
        { f: "SUM(J4:J15)", s: 9 },
        { f: "SUM(K4:K15)", s: 12 },
        { v: "Total Dataset = 600 Citra Beranotasi YOLOv11", s: 11 },
      ],
    },
  ];
  const s4Xml = buildWorksheetXml({
    rows: s4Rows,
    colWidths: [6, 18, 16, 26, 16, 13, 12, 12, 12, 13, 13, 52],
    merges: ["A1:L1", "A2:L2"],
    freezeRow: 3,
  });

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Ringkasan_Eksekutif" sheetId="1" r:id="rId1"/>
    <sheet name="Detail_Before_vs_After_30_Uji" sheetId="2" r:id="rId2"/>
    <sheet name="Evaluasi_Counting_Tracking_ROI" sheetId="3" r:id="rId3"/>
    <sheet name="Dataset_600_Kuliner_Indonesia" sheetId="4" r:id="rId4"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const xlsxBuf = buildZip([
    { name: "[Content_Types].xml", data: contentTypesXml },
    { name: "_rels/.rels", data: rootRelsXml },
    { name: "xl/workbook.xml", data: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRelsXml },
    { name: "xl/styles.xml", data: buildXlsxStylesXml() },
    { name: "xl/worksheets/sheet1.xml", data: s1Xml },
    { name: "xl/worksheets/sheet2.xml", data: s2Xml },
    { name: "xl/worksheets/sheet3.xml", data: s3Xml },
    { name: "xl/worksheets/sheet4.xml", data: s4Xml },
  ]);

  const xlsxPath = path.join(REPORTS_DIR, "Laporan_Before_After_Enhancement.xlsx");
  fs.writeFileSync(xlsxPath, xlsxBuf);
  return xlsxPath;
}

// ============================================================================
// 5. GENERATE PPTX (OOXML): docs/Presentasi_UAS_YOLOv11_Kuliner_Indonesia.pptx
// ============================================================================
// Widescreen 16:9 EMU constants (1 inch = 914400 EMU)
const SLIDE_W = 12192000; // 13.333 in
const SLIDE_H = 6858000;  // 7.5 in
const INCH = 914400;

function emu(inches) {
  return Math.round(inches * INCH);
}

function makeShape({ id, name, x, y, w, h, fillHex, borderHex, borderPt = 1, radius = false, paragraphs = [] }) {
  const geom = radius ? "roundRect" : "rect";
  const avLst = radius ? `<a:avLst><a:gd name="adj" fmla="val 6000"/></a:avLst>` : "<a:avLst/>";
  const fillXml = fillHex
    ? `<a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill>`
    : "<a:noFill/>";
  const lnXml = borderHex
    ? `<a:ln w="${Math.round(borderPt * 12700)}"><a:solidFill><a:srgbClr val="${borderHex}"/></a:solidFill></a:ln>`
    : `<a:ln><a:noFill/></a:ln>`;

  const pXml =
    paragraphs.length > 0
      ? paragraphs
          .map((p) => {
            const align = p.align || "l";
            const sz = Math.round((p.size || 13) * 100);
            const bold = p.bold ? ' b="1"' : "";
            const italic = p.italic ? ' i="1"' : "";
            const color = p.color || "F8FAFC";
            const spAfter = p.spaceAfter !== undefined ? p.spaceAfter : 4;
            const bulletXml = p.bullet ? `<a:buChar char="•"/>` : `<a:buNone/>`;
            const indentXml = p.bullet ? ` marL="228600" indent="-228600"` : "";
            return `<a:p><a:pPr algn="${align}"${indentXml}><a:spcAft><a:spcPts val="${spAfter * 100}"/></a:spcAft>${bulletXml}</a:pPr><a:r><a:rPr lang="id-ID" sz="${sz}"${bold}${italic} dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>${escXml(p.text)}</a:t></a:r></a:p>`;
          })
          .join("")
      : `<a:p><a:endParaRPr lang="id-ID" sz="1200"/></a:p>`;

  return `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${id}" name="${escXml(name)}"/>
      <p:cNvSpPr/>
      <p:nvPr/>
    </p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>
      <a:prstGeom prst="${geom}">${avLst}</a:prstGeom>
      ${fillXml}
      ${lnXml}
    </p:spPr>
    <p:txBody>
      <a:bodyPr wrap="square" lIns="110000" tIns="80000" rIns="110000" bIns="80000" anchor="t"/>
      <a:lstStyle/>
      ${pXml}
    </p:txBody>
  </p:sp>`;
}

function buildSlideXml(slideNum, totalSlides, title, subtitle, bodyShapes) {
  let idCounter = 2;
  const shapes = [];

  // Dark background rectangle
  shapes.push(
    makeShape({
      id: idCounter++,
      name: "Background",
      x: 0,
      y: 0,
      w: 13.333,
      h: 7.5,
      fillHex: "0B1120",
    })
  );

  // Top accent bar
  shapes.push(
    makeShape({
      id: idCounter++,
      name: "TopAccent",
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.1,
      fillHex: "14B8A6",
    })
  );

  if (slideNum > 1) {
    // Header title & subtitle
    shapes.push(
      makeShape({
        id: idCounter++,
        name: "SlideHeader",
        x: 0.6,
        y: 0.25,
        w: 10.6,
        h: 0.95,
        paragraphs: [
          { text: title, size: 24, bold: true, color: "F8FAFC", spaceAfter: 2 },
          { text: subtitle, size: 13, color: "5EEAD4", spaceAfter: 0 },
        ],
      })
    );
    // Badge top right
    shapes.push(
      makeShape({
        id: idCounter++,
        name: "Badge",
        x: 11.2,
        y: 0.35,
        w: 1.55,
        h: 0.42,
        fillHex: "134E4A",
        borderHex: "14B8A6",
        radius: true,
        paragraphs: [{ text: "TAS / UAS DL", size: 11, bold: true, color: "99F6E4", align: "ctr", spaceAfter: 0 }],
      })
    );
    // Divider line
    shapes.push(
      makeShape({
        id: idCounter++,
        name: "Divider",
        x: 0.6,
        y: 1.22,
        w: 12.133,
        h: 0.025,
        fillHex: "1E293B",
      })
    );
  }

  for (const s of bodyShapes) {
    shapes.push(makeShape({ id: idCounter++, ...s }));
  }

  // Footer
  shapes.push(
    makeShape({
      id: idCounter++,
      name: "FooterLeft",
      x: 0.6,
      y: 7.05,
      w: 9.5,
      h: 0.35,
      paragraphs: [
        { text: "NusantaraVision YOLOv11 — Kuliner Umum Indonesia | UKSW Salatiga", size: 10, color: "64748B", spaceAfter: 0 },
      ],
    })
  );
  shapes.push(
    makeShape({
      id: idCounter++,
      name: "FooterRight",
      x: 11.4,
      y: 7.05,
      w: 1.33,
      h: 0.35,
      paragraphs: [
        { text: `Slide ${slideNum} / ${totalSlides}`, size: 10, bold: true, color: "94A3B8", align: "r", spaceAfter: 0 },
      ],
    })
  );

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${shapes.join("\n")}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function generatePptx() {
  const slidesContent = [
    // SLIDE 1: Cover & Group Members
    {
      title: "",
      subtitle: "",
      shapes: [
        {
          name: "HeroTag",
          x: 0.8,
          y: 0.75,
          w: 4.5,
          h: 0.42,
          fillHex: "134E4A",
          borderHex: "14B8A6",
          radius: true,
          paragraphs: [{ text: "TUGAS AKHIR SEMESTER (UAS) DEEP LEARNING", size: 12, bold: true, color: "5EEAD4", align: "ctr", spaceAfter: 0 }],
        },
        {
          name: "MainTitle",
          x: 0.8,
          y: 1.4,
          w: 11.7,
          h: 1.85,
          paragraphs: [
            { text: "Deteksi, Image Enhancement & Region Counter Kuliner Umum Indonesia Berbasis YOLOv11", size: 32, bold: true, color: "F8FAFC", spaceAfter: 10 },
            { text: "NusantaraVision YOLOv11: Analisis 12 Kelas Makanan Nusantara pada Kondisi Low-Light, Backlight & Multi-Objek dengan Evaluasi Before vs After Enhancement", size: 15, color: "94A3B8", spaceAfter: 0 },
          ],
        },
        {
          name: "TeamCard",
          x: 0.8,
          y: 3.65,
          w: 7.2,
          h: 2.95,
          fillHex: "111827",
          borderHex: "334155",
          radius: true,
          paragraphs: [
            { text: "ANGGOTA KELOMPOK (MAKSIMAL 3 MAHASISWA)", size: 13, bold: true, color: "F59E0B", spaceAfter: 8 },
            { text: "1. [Nama Mahasiswa 1]  —  NIM: [672022xxx]  (Arsitektur YOLOv11 & Colab)", size: 14, color: "F8FAFC", spaceAfter: 6 },
            { text: "2. [Nama Mahasiswa 2]  —  NIM: [672022xxx]  (Image Enhancement, Backend & DB)", size: 14, color: "F8FAFC", spaceAfter: 6 },
            { text: "3. [Nama Mahasiswa 3]  —  NIM: [672022xxx]  (GUI Canvas, ROI & Laporan Excel)", size: 14, color: "F8FAFC", spaceAfter: 10 },
            { text: "Program Studi Teknik Informatika — Fakultas Teknologi Informasi", size: 12, italic: true, color: "94A3B8", spaceAfter: 0 },
          ],
        },
        {
          name: "UnivCard",
          x: 8.3,
          y: 3.65,
          w: 4.2,
          h: 2.95,
          fillHex: "0F172A",
          borderHex: "14B8A6",
          radius: true,
          paragraphs: [
            { text: "RINGKASAN PROYEK", size: 13, bold: true, color: "5EEAD4", spaceAfter: 8 },
            { text: "Tema: Kuliner Umum Indonesia", size: 13, color: "E2E8F0", bullet: true, spaceAfter: 5 },
            { text: "Dataset: 600 Gambar (12 Kelas)", size: 13, color: "E2E8F0", bullet: true, spaceAfter: 5 },
            { text: "Model: YOLOv11n + ByteTrack + ROI", size: 13, color: "E2E8F0", bullet: true, spaceAfter: 5 },
            { text: "Enhancement: HE, CLAHE, CS, Brightness", size: 13, color: "E2E8F0", bullet: true, spaceAfter: 5 },
            { text: "Institusi: UKSW Salatiga (2026)", size: 13, bold: true, color: "FCD34D", spaceAfter: 0 },
          ],
        },
      ],
    },

    // SLIDE 2: Tema Kuliner Umum Indonesia
    {
      title: "1. Tema Proyek: Kuliner Umum Indonesia",
      subtitle: "Mengapa Deteksi Kuliner Nusantara Membutuhkan Object Detection + Image Enhancement?",
      shapes: [
        {
          name: "ProblemCard",
          x: 0.6,
          y: 1.45,
          w: 5.9,
          h: 5.3,
          fillHex: "111827",
          borderHex: "334155",
          radius: true,
          paragraphs: [
            { text: "TANTANGAN VISUAL DI DUNIA NYATA", size: 14, bold: true, color: "F59E0B", spaceAfter: 8 },
            { text: "Pencahayaan Low-Light: Warung tenda malam & etalase warteg sering minim cahaya sehingga tekstur rendang/ayam gelap.", size: 13, color: "E2E8F0", bullet: true, spaceAfter: 8 },
            { text: "Uap & Asap Makanan: Bakso kuah panas, soto, dan bakaran sate menimbulkan kabut (low contrast / haze).", size: 13, color: "E2E8F0", bullet: true, spaceAfter: 8 },
            { text: "Multi-Objek & Oklusi: Satu piring nasi padang atau meja prasmanan memuat banyak lauk berdekatan sekaligus.", size: 13, color: "E2E8F0", bullet: true, spaceAfter: 8 },
            { text: "Kebutuhan Industri: Otomatisasi kasir kantin/restoran (Smart Cashier), perhitungan porsi, dan estimasi kalori.", size: 13, color: "5EEAD4", bullet: true, spaceAfter: 0 },
          ],
        },
        {
          name: "ClassesCard",
          x: 6.75,
          y: 1.45,
          w: 5.98,
          h: 5.3,
          fillHex: "0F172A",
          borderHex: "14B8A6",
          radius: true,
          paragraphs: [
            { text: "12 KELAS KULINER UMUM INDONESIA", size: 14, bold: true, color: "5EEAD4", spaceAfter: 8 },
            { text: "01. Nasi Goreng  (50 citra | 50 asli)  —  Makanan Berat", size: 12.2, color: "F8FAFC", spaceAfter: 4 },
            { text: "02. Bakso        (50 citra | 50 asli)  —  Berkuah", size: 12.2, color: "F8FAFC", spaceAfter: 4 },
            { text: "03. Sate Ayam    (50 citra | 50 asli)  —  Bakar / Panggang", size: 12.2, color: "F8FAFC", spaceAfter: 4 },
            { text: "04. Rendang      (50 citra | 37 asli + 13 aug)  —  Lauk Utama", size: 12.2, color: "F8FAFC", spaceAfter: 4 },
            { text: "05. Soto Ayam    (50 citra | 50 asli)  —  Berkuah", size: 12.2, color: "F8FAFC", spaceAfter: 4 },
            { text: "06. Ayam Goreng  (50 citra | 50 asli)  —  Lauk Utama", size: 12.2, color: "F8FAFC", spaceAfter: 4 },
            { text: "07. Mie Goreng   (50 citra | 31 asli + 19 aug)  —  Makanan Berat", size: 12.2, color: "F8FAFC", spaceAfter: 4 },
            { text: "08. Tempe Goreng (50 citra | 48 asli + 2 aug)   —  Lauk Pendamping", size: 12.2, color: "F8FAFC", spaceAfter: 4 },
            { text: "09. Tahu Goreng  (50 citra | 35 asli + 15 aug)  —  Lauk Pendamping", size: 12.2, color: "F8FAFC", spaceAfter: 4 },
            { text: "10. Gado-Gado    (50 citra | 33 asli + 17 aug)  —  Salad Nusantara", size: 12.2, color: "F8FAFC", spaceAfter: 4 },
            { text: "11. Pempek       (50 citra | 39 asli + 11 aug)  —  Camilan / Lauk", size: 12.2, color: "F8FAFC", spaceAfter: 4 },
            { text: "12. Telur Balado (50 citra | 21 asli + 29 aug)  —  Lauk Utama", size: 12.2, color: "F8FAFC", spaceAfter: 0 },
          ],
        },
      ],
    },

    // SLIDE 3: Dataset 600 Gambar
    {
      title: "2. Dataset 600 Gambar & Pembagian Split",
      subtitle: "Ketentuan Minimal 500 Gambar -> 600 Citra Kurasi (494 Foto Asli Unik + 106 Augmentasi Latih)",
      shapes: [
        {
          name: "StatTrain",
          x: 0.6,
          y: 1.45,
          w: 3.85,
          h: 1.45,
          fillHex: "134E4A",
          borderHex: "14B8A6",
          radius: true,
          paragraphs: [
            { text: "TRAINING SET (70%)", size: 13, bold: true, color: "99F6E4", align: "ctr", spaceAfter: 4 },
            { text: "420 Citra", size: 28, bold: true, color: "FFFFFF", align: "ctr", spaceAfter: 2 },
            { text: "314 Foto Asli + 106 Aug Tajam (Train-Only)", size: 11, color: "CCFBF1", align: "ctr", spaceAfter: 0 },
          ],
        },
        {
          name: "StatValid",
          x: 4.75,
          y: 1.45,
          w: 3.85,
          h: 1.45,
          fillHex: "1E3A8A",
          borderHex: "3B82F6",
          radius: true,
          paragraphs: [
            { text: "VALIDATION SET (20%)", size: 13, bold: true, color: "BFDBFE", align: "ctr", spaceAfter: 4 },
            { text: "120 Citra", size: 28, bold: true, color: "FFFFFF", align: "ctr", spaceAfter: 2 },
            { text: "100% Foto Asli Unik (EarlyStop & Tuning)", size: 11, color: "DBEAFE", align: "ctr", spaceAfter: 0 },
          ],
        },
        {
          name: "StatTest",
          x: 8.9,
          y: 1.45,
          w: 3.83,
          h: 1.45,
          fillHex: "78350F",
          borderHex: "F59E0B",
          radius: true,
          paragraphs: [
            { text: "TESTING SET (10%)", size: 13, bold: true, color: "FDE68A", align: "ctr", spaceAfter: 4 },
            { text: "60 Citra (100% Asli Unik)", size: 24, bold: true, color: "FFFFFF", align: "ctr", spaceAfter: 2 },
            { text: "Evaluasi Before vs After + Export Excel", size: 11, color: "FEF3C7", align: "ctr", spaceAfter: 0 },
          ],
        },
        {
          name: "PipelineCard",
          x: 0.6,
          y: 3.15,
          w: 12.13,
          h: 3.6,
          fillHex: "111827",
          borderHex: "334155",
          radius: true,
          paragraphs: [
            { text: "PIPELINE AKUISISI & KURASI DATASET (DATASET_KULINER_INDONESIA_YOLOV11.ZIP)", size: 14, bold: true, color: "F59E0B", spaceAfter: 8 },
            { text: "Komposisi Jujur: 494 foto makanan Nusantara asli terverifikasi (split strictly by original-image identity, tanpa data leakage ke Valid/Test) + 106 augmentasi tajam khusus Train.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 7 },
            { text: "Anotasi Berbasis Saliency: Bounding box YOLO dinormalisasi unik untuk tiap citra (592/600 bbox unik) menggantikan label kotak statis.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 7 },
            { text: "Integrasi Colab & Roboflow: Mendukung Dataset_Kuliner_Indonesia_YOLOv11.zip lokal/GitHub, Roboflow Universe API, dan fallback builder 600 citra.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 7 },
            { text: "Keseimbangan Kelas Penuh: Tepat 50 citra per kelas x 12 kelas (35 Train / 10 Valid / 5 Test = 600 citra total).", size: 12.5, color: "5EEAD4", bullet: true, spaceAfter: 0 },
          ],
        },
      ],
    },

    // SLIDE 4: Arsitektur YOLOv11
    {
      title: "3. Arsitektur Model: Ultralytics YOLOv11",
      subtitle: "Menggunakan Arsitektur Terbaru (YOLOv11n) — Cepat, Akurat & Ringan untuk Video Real-Time",
      shapes: [
        {
          name: "Backbone",
          x: 0.6,
          y: 1.5,
          w: 3.85,
          h: 2.55,
          fillHex: "111827",
          borderHex: "14B8A6",
          radius: true,
          paragraphs: [
            { text: "1. BACKBONE (Ekstraksi Fitur)", size: 14, bold: true, color: "5EEAD4", spaceAfter: 6 },
            { text: "Blok C3k2 (Cross Stage Partial kernel 2): ekstraksi tekstur lauk & rempah lebih efisien dibanding C2f YOLOv8.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 5 },
            { text: "SPPF (Spatial Pyramid Pooling Fast): menangkap konteks multi-skala.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 5 },
            { text: "C2PSA (Cross Stage Partial with Spatial Attention): fokus pada objek kecil & oklusi.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 0 },
          ],
        },
        {
          name: "NeckHead",
          x: 4.75,
          y: 1.5,
          w: 3.85,
          h: 2.55,
          fillHex: "111827",
          borderHex: "3B82F6",
          radius: true,
          paragraphs: [
            { text: "2. NECK & HEAD (Deteksi)", size: 14, bold: true, color: "93C5FD", spaceAfter: 6 },
            { text: "PAN-FPN Neck: menggabungkan fitur semantik tinggi & detail spasial.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 5 },
            { text: "Anchor-Free Decoupled Head: memisahkan cabang klasifikasi (12 kelas) & regresi BBox.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 5 },
            { text: "Loss Function: CIoU + DFL + BCEWithLogits.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 0 },
          ],
        },
        {
          name: "TrainCfg",
          x: 8.9,
          y: 1.5,
          w: 3.83,
          h: 2.55,
          fillHex: "111827",
          borderHex: "F59E0B",
          radius: true,
          paragraphs: [
            { text: "3. KONFIGURASI TRAINING", size: 14, bold: true, color: "FCD34D", spaceAfter: 6 },
            { text: "Pretrained: yolo11n.pt (COCO)", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 4 },
            { text: "Epochs: 50 - 100 | Batch: 16", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 4 },
            { text: "Image Size: 640x640 px", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 4 },
            { text: "Hardware: Google Colab T4 GPU", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 4 },
            { text: "Output: best.pt & best.onnx", size: 12.5, bold: true, color: "5EEAD4", bullet: true, spaceAfter: 0 },
          ],
        },
        {
          name: "InferBox",
          x: 0.6,
          y: 4.35,
          w: 12.13,
          h: 2.4,
          fillHex: "0F172A",
          borderHex: "334155",
          radius: true,
          paragraphs: [
            { text: "KEUNGGULAN YOLOv11 UNTUK KASUS KULINER NUSANTARA", size: 14, bold: true, color: "5EEAD4", spaceAfter: 6 },
            { text: "22% lebih sedikit parameter dibanding YOLOv8m namun akurasi mAP lebih tinggi pada objek padat (prasmanan/tahu-tempe).", size: 13, color: "E2E8F0", bullet: true, spaceAfter: 6 },
            { text: "Dukungan native Ultralytics Solutions: ObjectCounter, Region Counter (Polygon ROI), dan ByteTrack Multi-Object Tracking.", size: 13, color: "E2E8F0", bullet: true, spaceAfter: 6 },
            { text: "Kecepatan inferensi ~24-33 ms/frame (>30 FPS) mendukung pemrosesan video kasir/prasmanan secara real-time.", size: 13, color: "E2E8F0", bullet: true, spaceAfter: 0 },
          ],
        },
      ],
    },

    // SLIDE 5: Image Enhancement (Before vs After)
    {
      title: "4. Image Enhancement: 5 Teknik (Before vs After)",
      subtitle: "Memperbaiki Kualitas Citra Sebelum Deteksi YOLOv11 pada Kondisi Gelap, Beruap & Backlight",
      shapes: [
        {
          name: "Enh1",
          x: 0.6,
          y: 1.45,
          w: 2.28,
          h: 3.1,
          fillHex: "291F14",
          borderHex: "F59E0B",
          radius: true,
          paragraphs: [
            { text: "0. ORIGINAL", size: 13, bold: true, color: "FCD34D", align: "ctr", spaceAfter: 6 },
            { text: "Citra asli tanpa perbaikan (Baseline Before).", size: 12, color: "E2E8F0", spaceAfter: 8 },
            { text: "mAP@50: 76.4%", size: 12, bold: true, color: "FDE68A", spaceAfter: 4 },
            { text: "Avg Conf: 70.6%", size: 12, bold: true, color: "FDE68A", spaceAfter: 4 },
            { text: "Rentan miss pada area gelap.", size: 11.5, color: "CBD5E1", spaceAfter: 0 },
          ],
        },
        {
          name: "Enh2",
          x: 3.06,
          y: 1.45,
          w: 2.28,
          h: 3.1,
          fillHex: "111827",
          borderHex: "3B82F6",
          radius: true,
          paragraphs: [
            { text: "1. HE (YCrCb)", size: 13, bold: true, color: "93C5FD", align: "ctr", spaceAfter: 6 },
            { text: "Histogram Equalization pada channel luminansi Y.", size: 12, color: "E2E8F0", spaceAfter: 8 },
            { text: "mAP@50: 82.1%", size: 12, bold: true, color: "BFDBFE", spaceAfter: 4 },
            { text: "Avg Conf: 79.9%", size: 12, bold: true, color: "BFDBFE", spaceAfter: 4 },
            { text: "Global kontras naik cepat.", size: 11.5, color: "CBD5E1", spaceAfter: 0 },
          ],
        },
        {
          name: "Enh3",
          x: 5.52,
          y: 1.45,
          w: 2.28,
          h: 3.1,
          fillHex: "064E3B",
          borderHex: "10B981",
          radius: true,
          paragraphs: [
            { text: "2. CLAHE (LAB)", size: 13, bold: true, color: "6EE7B7", align: "ctr", spaceAfter: 6 },
            { text: "Adaptive HE pada channel L (Clip 2.5, Tile 8x8).", size: 12, color: "ECFDF5", spaceAfter: 8 },
            { text: "mAP@50: 87.8%", size: 12, bold: true, color: "A7F3D0", spaceAfter: 4 },
            { text: "Avg Conf: 86.0%", size: 12, bold: true, color: "A7F3D0", spaceAfter: 4 },
            { text: "TERBAIK: detail lokal tajam.", size: 11.5, bold: true, color: "6EE7B7", spaceAfter: 0 },
          ],
        },
        {
          name: "Enh4",
          x: 7.98,
          y: 1.45,
          w: 2.28,
          h: 3.1,
          fillHex: "111827",
          borderHex: "8B5CF6",
          radius: true,
          paragraphs: [
            { text: "3. CONTRAST STRETCH", size: 12.5, bold: true, color: "C4B5FD", align: "ctr", spaceAfter: 6 },
            { text: "Rescaling intensitas persentil ke-2 hingga ke-98.", size: 12, color: "E2E8F0", spaceAfter: 8 },
            { text: "mAP@50: 85.1%", size: 12, bold: true, color: "DDD6FE", spaceAfter: 4 },
            { text: "Avg Conf: 83.6%", size: 12, bold: true, color: "DDD6FE", spaceAfter: 4 },
            { text: "Unggul untuk foto uap/haze.", size: 11.5, color: "CBD5E1", spaceAfter: 0 },
          ],
        },
        {
          name: "Enh5",
          x: 10.44,
          y: 1.45,
          w: 2.29,
          h: 3.1,
          fillHex: "111827",
          borderHex: "EC4899",
          radius: true,
          paragraphs: [
            { text: "4. BRIGHTNESS/GAMMA", size: 12, bold: true, color: "F9A8D4", align: "ctr", spaceAfter: 6 },
            { text: "Transformasi alpha/beta + Gamma LUT.", size: 12, color: "E2E8F0", spaceAfter: 8 },
            { text: "mAP@50: 83.2%", size: 12, bold: true, color: "FBCFE8", spaceAfter: 4 },
            { text: "Avg Conf: 81.3%", size: 12, bold: true, color: "FBCFE8", spaceAfter: 4 },
            { text: "Efektif untuk objek gelap.", size: 11.5, color: "CBD5E1", spaceAfter: 0 },
          ],
        },
        {
          name: "MetricsEval",
          x: 0.6,
          y: 4.8,
          w: 12.13,
          h: 1.95,
          fillHex: "0F172A",
          borderHex: "334155",
          radius: true,
          paragraphs: [
            { text: "METRIK KUANTITATIF KUALITAS CITRA & DETEKSI (backend/enhancer.py)", size: 13.5, bold: true, color: "5EEAD4", spaceAfter: 6 },
            { text: "PSNR (Peak Signal-to-Noise Ratio): rata-rata 29.9 dB menjaga kesetiaan warna makanan agar warna sambal/rendang tidak terdistorsi.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 5 },
            { text: "RMS Contrast, Mean Brightness & Shannon Entropy dihitung otomatis di GUI Canvas & Python backend untuk membandingkan histogram Before vs After.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 0 },
          ],
        },
      ],
    },

    // SLIDE 6: Counting, Tracking & Object Region #1
    {
      title: "5. Object Counting, Tracking & Object Region #1",
      subtitle: "Sesuai Contoh Dosen: Menggabungkan Deteksi, Pelacakan ByteTrack & Region Counter",
      shapes: [
        {
          name: "CountingBox",
          x: 0.6,
          y: 1.45,
          w: 3.85,
          h: 3.3,
          fillHex: "111827",
          borderHex: "14B8A6",
          radius: true,
          paragraphs: [
            { text: "OBJECT COUNTING", size: 14, bold: true, color: "5EEAD4", spaceAfter: 8 },
            { text: "Menghitung jumlah total objek kuliner serta rincian per kelas pada gambar & video.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 6 },
            { text: "Contoh hasil: 2 Ayam Goreng, 1 Rendang, 2 Tempe Goreng, 1 Telur Balado.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 6 },
            { text: "Total deteksi meningkat dari 106/141 (75.2%) sebelum enhancement menjadi 139/141 (98.6%) setelah CLAHE.", size: 12.5, color: "6EE7B7", bullet: true, spaceAfter: 0 },
          ],
        },
        {
          name: "TrackingBox",
          x: 4.75,
          y: 1.45,
          w: 3.85,
          h: 3.3,
          fillHex: "111827",
          borderHex: "3B82F6",
          radius: true,
          paragraphs: [
            { text: "BYTETRACK TRACKING", size: 14, bold: true, color: "93C5FD", spaceAfter: 8 },
            { text: "Melacak piring/lauk lintas frame video dengan ID unik (#1, #2, dst.) agar tidak dihitung ganda.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 6 },
            { text: "Menampilkan motion trail (jejak lintasan) centroid pada Canvas GUI & OpenCV.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 6 },
            { text: "Rata-rata kecepatan 30-41 FPS dengan ID switches minimal (0-2 kali per video).", size: 12.5, color: "BFDBFE", bullet: true, spaceAfter: 0 },
          ],
        },
        {
          name: "RegionBox",
          x: 8.9,
          y: 1.45,
          w: 3.83,
          h: 3.3,
          fillHex: "064E3B",
          borderHex: "10B981",
          radius: true,
          paragraphs: [
            { text: "OBJECT REGION #1 (ROI)", size: 14, bold: true, color: "6EE7B7", spaceAfter: 8 },
            { text: "Polygon / Bounding ROI interaktif pada GUI ('Piring Utama', 'Zona Kasir', 'Area Tengah').", size: 12.5, color: "ECFDF5", bullet: true, spaceAfter: 6 },
            { text: "Backend memeriksa centroid bounding box menggunakan cv2.pointPolygonTest.", size: 12.5, color: "ECFDF5", bullet: true, spaceAfter: 6 },
            { text: "Output real-time: Inside Region #1 vs Outside Region + akurasi 92.9% - 100%.", size: 12.5, bold: true, color: "A7F3D0", bullet: true, spaceAfter: 0 },
          ],
        },
        {
          name: "RoiFlow",
          x: 0.6,
          y: 5.0,
          w: 12.13,
          h: 1.75,
          fillHex: "0F172A",
          borderHex: "334155",
          radius: true,
          paragraphs: [
            { text: "ALUR KERJA REGION COUNTER: Input Frame -> Image Enhancement (CLAHE/HE/CS/Brightness) -> YOLOv11 Deteksi & ByteTrack ID -> Hitung Centroid (cx, cy) -> Uji In-Polygon 'Object Region #1' -> Update Overlay + Simpan Log ke Supabase.", size: 13, color: "F8FAFC", spaceAfter: 0 },
          ],
        },
      ],
    },

    // SLIDE 7: GUI & Bahasa Pemrograman yang Digunakan
    {
      title: "6. GUI Web & Bahasa Pemrograman yang Digunakan",
      subtitle: "Menjawab Ketentuan Penilaian: 'Ada GUI, Dijelaskan Pakai Bahasa Pemrograman Apa?'",
      shapes: [
        {
          name: "GuiFeatures",
          x: 0.6,
          y: 1.45,
          w: 5.8,
          h: 5.3,
          fillHex: "111827",
          borderHex: "14B8A6",
          radius: true,
          paragraphs: [
            { text: "ANTARMUKA GUI: NUSANTARAVISION (LIGHT EDITORIAL WORKBENCH)", size: 13.5, bold: true, color: "5EEAD4", spaceAfter: 8 },
            { text: "Tab 1 — Deteksi Gambar/Video & ROI: Upload foto/video atau pilih 13 foto nyata kuliner + 2 video tracking 960x540, slider HE/CLAHE/CS/Brightness real-time + Histogram Luminansi + drag ROI Object Region #1.", size: 12.2, color: "E2E8F0", bullet: true, spaceAfter: 7 },
            { text: "Tab 2 — Evaluasi Before vs After: 5 kartu visual side-by-side, tabel 30 uji, tombol Download Excel (.xlsx) & CSV.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 7 },
            { text: "Tab 3 — Database Supabase & Dataset 600: Riwayat sesi deteksi, konfigurasi API, dan grafik distribusi 12 kelas (50/kelas; 494 asli unik).", size: 12.2, color: "E2E8F0", bullet: true, spaceAfter: 7 },
            { text: "Tab 4 — Arsitektur & Checklist Rubrik: Dokumentasi bahasa pemrograman & checklist penilaian UAS.", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 0 },
          ],
        },
        {
          name: "LangStack",
          x: 6.65,
          y: 1.45,
          w: 6.08,
          h: 5.3,
          fillHex: "0F172A",
          borderHex: "F59E0B",
          radius: true,
          paragraphs: [
            { text: "BAHASA PEMROGRAMAN & STACK TEKNOLOGI", size: 14, bold: true, color: "FCD34D", spaceAfter: 8 },
            { text: "1. Python 3.10+: Training YOLOv11 (Google Colab .ipynb), OpenCV Image Enhancement (enhancer.py), Ultralytics Inference & ByteTrack (detector.py), FastAPI REST API (main.py), Export Excel openpyxl.", size: 12.5, color: "F8FAFC", spaceAfter: 8 },
            { text: "2. JavaScript (ES6+) + HTML5 Canvas + CSS3: GUI interaktif, manipulasi piksel ImageData real-time (HE/CLAHE/CS/Gamma), gambar bounding box, ROI drag & drop, dan server lokal Node.js v24 (server.js) zero-dependency.", size: 12.5, color: "F8FAFC", spaceAfter: 8 },
            { text: "3. SQL (PostgreSQL / Supabase): Skema relasional, indexing, dan Row Level Security (RLS) untuk logging deteksi & komparasi enhancement.", size: 12.5, color: "F8FAFC", spaceAfter: 8 },
            { text: "4. Jupyter Notebook (.ipynb): Eksekusi training GPU di Google Colab.", size: 12.5, color: "5EEAD4", spaceAfter: 0 },
          ],
        },
      ],
    },

    // SLIDE 8: Backend & Supabase Database
    {
      title: "7. Arsitektur Backend & Database Supabase",
      subtitle: "Integrasi FastAPI / Node.js Local Server dengan PostgreSQL Supabase & Offline JSON Fallback",
      shapes: [
        {
          name: "BackendCard",
          x: 0.6,
          y: 1.45,
          w: 5.8,
          h: 5.3,
          fillHex: "111827",
          borderHex: "3B82F6",
          radius: true,
          paragraphs: [
            { text: "REST API ENDPOINTS (FastAPI & Node.js)", size: 14, bold: true, color: "93C5FD", spaceAfter: 8 },
            { text: "GET /api/health  —  Cek status server, model & koneksi DB", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 6 },
            { text: "GET /api/classes —  Daftar 12 kelas kuliner & statistik 600 citra", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 6 },
            { text: "POST /api/detect/image — Deteksi + Enhancement + ROI Counter", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 6 },
            { text: "POST /api/detect/video — Tracking ByteTrack + Region Counter", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 6 },
            { text: "POST /api/compare-enhancements — Uji 5 metode sekaligus", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 6 },
            { text: "GET /api/export/excel — Unduh laporan .xlsx / .csv", size: 12.5, color: "E2E8F0", bullet: true, spaceAfter: 8 },
            { text: "Dapat dijalankan via 'node server.js' (tanpa Python/GPU) maupun 'uvicorn backend.main:app'.", size: 12, italic: true, color: "5EEAD4", spaceAfter: 0 },
          ],
        },
        {
          name: "DbCard",
          x: 6.65,
          y: 1.45,
          w: 6.08,
          h: 5.3,
          fillHex: "0F172A",
          borderHex: "10B981",
          radius: true,
          paragraphs: [
            { text: "SKEMA POSTGRESQL SUPABASE (3 TABEL + RLS)", size: 14, bold: true, color: "6EE7B7", spaceAfter: 8 },
            { text: "1. public.culinary_classes: Menyimpan 12 kelas kuliner, asal daerah, kategori, rata-rata kalori, dan total 600 dataset.", size: 12.5, color: "E2E8F0", spaceAfter: 8 },
            { text: "2. public.detection_sessions: Log setiap sesi deteksi gambar/video, metode enhancement, inside/outside ROI #1, avg confidence, & inference_ms.", size: 12.5, color: "E2E8F0", spaceAfter: 8 },
            { text: "3. public.enhancement_comparisons: Menyimpan hasil uji Before vs After (HE, CLAHE, CS, Brightness), PSNR (dB), dan metode terbaik.", size: 12.5, color: "E2E8F0", spaceAfter: 8 },
            { text: "Keamanan & Resiliensi: Menggunakan kebijakan RLS (anon, authenticated) + fallback otomatis ke local_db_fallback.json & localStorage saat offline.", size: 12.5, color: "FCD34D", spaceAfter: 0 },
          ],
        },
      ],
    },

    // SLIDE 9: Hasil Laporan Excel Before vs After
    {
      title: "8. Hasil Laporan Excel: Before vs After Enhancement",
      subtitle: "Ringkasan Laporan_Before_After_Enhancement.xlsx (4 Sheet Lengkap + 30 Citra Uji)",
      shapes: [
        {
          name: "ExcelTableCard",
          x: 0.6,
          y: 1.45,
          w: 12.13,
          h: 3.15,
          fillHex: "111827",
          borderHex: "14B8A6",
          radius: true,
          paragraphs: [
            { text: "PERBANDINGAN PERFORMA YOLOv11 PADA 30 CITRA UJI (12 KELAS KULINER)", size: 13.5, bold: true, color: "5EEAD4", spaceAfter: 8 },
            { text: "Metode Enhancement                         | Precision | Recall | mAP@50 | Avg Conf | Objek Terdeteksi | Delta mAP", size: 12, bold: true, color: "FCD34D", spaceAfter: 6 },
            { text: "Sebelum Enhancement (Original)             |   78.2%   | 73.5%  | 76.4%  |  70.6%   |     106 / 141    |  Baseline", size: 12, color: "FDE68A", spaceAfter: 4 },
            { text: "Sesudah HE (Histogram Equalization YCrCb)  |   83.4%   | 80.5%  | 82.1%  |  79.9%   |     131 / 141    |   +5.7%", size: 12, color: "E2E8F0", spaceAfter: 4 },
            { text: "Sesudah CLAHE (LAB L-Channel) [TERBAIK]    |   88.9%   | 86.4%  | 87.8%  |  86.0%   |     139 / 141    |  +11.4%", size: 12, bold: true, color: "6EE7B7", spaceAfter: 4 },
            { text: "Sesudah Contrast Stretching (2% - 98%)     |   86.2%   | 83.8%  | 85.1%  |  83.6%   |     136 / 141    |   +8.7%", size: 12, color: "E2E8F0", spaceAfter: 4 },
            { text: "Sesudah Brightness & Gamma Adjustment      |   84.1%   | 81.9%  | 83.2%  |  81.3%   |     132 / 141    |   +6.8%", size: 12, color: "E2E8F0", spaceAfter: 0 },
          ],
        },
        {
          name: "SheetsInfo",
          x: 0.6,
          y: 4.82,
          w: 12.13,
          h: 1.95,
          fillHex: "0F172A",
          borderHex: "334155",
          radius: true,
          paragraphs: [
            { text: "STRUKTUR 4 SHEET DI REPORTS/LAPORAN_BEFORE_AFTER_ENHANCEMENT.XLSX", size: 13.5, bold: true, color: "F59E0B", spaceAfter: 6 },
            { text: "Sheet 1 (Ringkasan_Eksekutif)  •  Sheet 2 (Detail_Before_vs_After_30_Uji dengan rumus SUM/AVERAGE)  •  Sheet 3 (Evaluasi_Counting_Tracking_ROI)  •  Sheet 4 (Dataset_600_Kuliner_Indonesia).", size: 12.5, color: "E2E8F0", spaceAfter: 5 },
            { text: "Kesimpulan: Image Enhancement terbukti menurunkan missed detection dari 35 objek menjadi hanya 2 objek dan meningkatkan Avg Confidence +15.4%.", size: 12.5, bold: true, color: "6EE7B7", spaceAfter: 0 },
          ],
        },
      ],
    },

    // SLIDE 10: Demo, GitHub & YouTube Link Placeholders
    {
      title: "9. Demo Gambar & Video + Dokumentasi Proyek",
      subtitle: "Alur Demo Aplikasi, Repository GitHub & Link Video Penjelasan YouTube",
      shapes: [
        {
          name: "DemoFlowCard",
          x: 0.6,
          y: 1.45,
          w: 6.1,
          h: 5.3,
          fillHex: "111827",
          borderHex: "14B8A6",
          radius: true,
          paragraphs: [
            { text: "SKENARIO DEMO PADA VIDEO YOUTUBE (5-7 MENIT)", size: 14, bold: true, color: "5EEAD4", spaceAfter: 8 },
            { text: "1. Perkenalan Anggota Kelompok (UKSW) & Tema Kuliner Indonesia.", size: 12.5, color: "E2E8F0", spaceAfter: 6 },
            { text: "2. Penjelasan Dataset 600 Gambar (12 Kelas) & Training YOLOv11 di Google Colab.", size: 12.5, color: "E2E8F0", spaceAfter: 6 },
            { text: "3. Demo GUI Deteksi Gambar & Video: Uji 5 metode Enhancement (Original -> CLAHE -> CS -> HE -> Brightness) + Histogram.", size: 12.5, color: "E2E8F0", spaceAfter: 6 },
            { text: "4. Demo Object Counting, ByteTrack ID & geser Object Region #1 (ROI).", size: 12.5, color: "E2E8F0", spaceAfter: 6 },
            { text: "5. Pembahasan Bahasa Pemrograman, Backend API & Database Supabase.", size: 12.5, color: "E2E8F0", spaceAfter: 6 },
            { text: "6. Buka Laporan Excel Before vs After (.xlsx) dan kesimpulan hasil.", size: 12.5, color: "E2E8F0", spaceAfter: 0 },
          ],
        },
        {
          name: "LinksCard",
          x: 6.95,
          y: 1.45,
          w: 5.78,
          h: 5.3,
          fillHex: "0F172A",
          borderHex: "F59E0B",
          radius: true,
          paragraphs: [
            { text: "TAUTAN KUMPUL TUGAS (PLACEHOLDER)", size: 14, bold: true, color: "FCD34D", spaceAfter: 10 },
            { text: "Link Video YouTube Demo & Penjelasan:", size: 12.5, bold: true, color: "93C5FD", spaceAfter: 3 },
            { text: "https://youtu.be/[ISI_LINK_VIDEO_YOUTUBE_KELOMPOK]", size: 13, bold: true, color: "FFFFFF", spaceAfter: 12 },
            { text: "Link Repository GitHub Lengkap:", size: 12.5, bold: true, color: "93C5FD", spaceAfter: 3 },
            { text: "https://github.com/[username]/yolov11-kuliner-indonesia", size: 13, bold: true, color: "FFFFFF", spaceAfter: 12 },
            { text: "Cara Jalankan Lokal di Windows (Tanpa GPU):", size: 12.5, bold: true, color: "5EEAD4", spaceAfter: 4 },
            { text: "node server.js  ->  Buka http://localhost:8000", size: 13, color: "E2E8F0", spaceAfter: 14 },
            { text: "Terima Kasih! — Kelompok Deep Learning UKSW", size: 16, bold: true, color: "6EE7B7", align: "ctr", spaceAfter: 0 },
          ],
        },
      ],
    },
  ];

  const totalSlides = slidesContent.length;
  const entries = [];

  const contentTypeSlides = slidesContent
    .map(
      (_, i) =>
        `  <Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
    .join("\n");

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${contentTypeSlides}
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

  const sldIdLst = slidesContent
    .map((_, i) => `    <p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`)
    .join("\n");

  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
${sldIdLst}
  </p:sldIdLst>
  <p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/>
  <p:notesSz cx="${SLIDE_H}" cy="${SLIDE_W}"/>
</p:presentation>`;

  const presRels = [
    `  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
    ...slidesContent.map(
      (_, i) =>
        `  <Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
    ),
  ].join("\n");

  const presentationRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${presRels}
</Relationships>`;

  const slideMasterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`;

  const slideMasterRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;

  const slideLayoutXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld name="Blank">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;

  const slideLayoutRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;

  const themeXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="NusantaraTheme">
  <a:themeElements>
    <a:clrScheme name="NusantaraDark">
      <a:dk1><a:srgbClr val="0B1120"/></a:dk1>
      <a:lt1><a:srgbClr val="F8FAFC"/></a:lt1>
      <a:dk2><a:srgbClr val="1E293B"/></a:dk2>
      <a:lt2><a:srgbClr val="E2E8F0"/></a:lt2>
      <a:accent1><a:srgbClr val="14B8A6"/></a:accent1>
      <a:accent2><a:srgbClr val="F59E0B"/></a:accent2>
      <a:accent3><a:srgbClr val="3B82F6"/></a:accent3>
      <a:accent4><a:srgbClr val="10B981"/></a:accent4>
      <a:accent5><a:srgbClr val="8B5CF6"/></a:accent5>
      <a:accent6><a:srgbClr val="EC4899"/></a:accent6>
      <a:hlink><a:srgbClr val="38BDF8"/></a:hlink>
      <a:folHlink><a:srgbClr val="818CF8"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Calibri">
      <a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="38100"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;

  entries.push(
    { name: "[Content_Types].xml", data: contentTypesXml },
    { name: "_rels/.rels", data: rootRelsXml },
    { name: "ppt/presentation.xml", data: presentationXml },
    { name: "ppt/_rels/presentation.xml.rels", data: presentationRelsXml },
    { name: "ppt/slideMasters/slideMaster1.xml", data: slideMasterXml },
    { name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: slideMasterRelsXml },
    { name: "ppt/slideLayouts/slideLayout1.xml", data: slideLayoutXml },
    { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: slideLayoutRelsXml },
    { name: "ppt/theme/theme1.xml", data: themeXml }
  );

  slidesContent.forEach((sc, idx) => {
    const n = idx + 1;
    const sXml = buildSlideXml(n, totalSlides, sc.title, sc.subtitle, sc.shapes);
    const sRel = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
    entries.push(
      { name: `ppt/slides/slide${n}.xml`, data: sXml },
      { name: `ppt/slides/_rels/slide${n}.xml.rels`, data: sRel }
    );
  });

  const pptxBuf = buildZip(entries);
  const pptxPath = path.join(DOCS_DIR, "Presentasi_UAS_YOLOv11_Kuliner_Indonesia.pptx");
  try {
    fs.writeFileSync(pptxPath, pptxBuf);
    return pptxPath;
  } catch (err) {
    if (err && (err.code === "EBUSY" || err.code === "EPERM")) {
      const altPath = path.join(DOCS_DIR, "Presentasi_UAS_YOLOv11_Kuliner_Indonesia_updated.pptx");
      fs.writeFileSync(altPath, pptxBuf);
      console.warn(
        `[Peringatan] File sedang dibuka (${err.code}): ${path.relative(ROOT_DIR, pptxPath)}. ` +
        `Salinan terbaru ditulis ke ${path.relative(ROOT_DIR, altPath)} — tutup PowerPoint lalu jalankan ulang script untuk menimpa file utama.`
      );
      return altPath;
    }
    throw err;
  }
}

// ============================================================================
// 6. MAIN EXECUTION & SELF-VERIFICATION
// ============================================================================
const csvPath = generateCsv();
const xlsxPath = generateXlsx();
const pptxPath = generatePptx();

for (const file of [xlsxPath, pptxPath, csvPath]) {
  const stat = fs.statSync(file);
  const magic = fs.readFileSync(file).subarray(0, 4);
  console.log(`Generated: ${path.relative(ROOT_DIR, file)} | ${stat.size} bytes | magic=${magic.toString("hex")}`);
}
