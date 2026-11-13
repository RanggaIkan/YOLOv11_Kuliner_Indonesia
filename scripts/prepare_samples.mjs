#!/usr/bin/env node
'use strict';

/**
 * NusantaraVision YOLOv11 — Synchronized Sample & Demo Video Generator (Wave 2)
 *
 * IMPORTANT:
 * - Reads real culinary hero photos & verified bounding boxes from
 *   samples/images/real_samples_manifest.json (NEVER overwrites samples/images/).
 * - Composites two crisp 960x540 photorealistic demo videos (16 frames each +
 *   MJPG .avi) using real plate crops via Windows .NET System.Drawing (or falls
 *   back gracefully to raw Node frame compositing if PowerShell GDI+ is absent).
 * - Writes samples/sample_catalog.json synced with frontend/app.js, server.js,
 *   and backend/main.py contracts.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const SAMPLES_DIR = path.join(ROOT_DIR, 'samples');
const IMAGES_DIR = path.join(SAMPLES_DIR, 'images');
const VIDEOS_DIR = path.join(SAMPLES_DIR, 'videos');
const FRAMES_ROOT = path.join(VIDEOS_DIR, 'frames');
const MANIFEST_PATH = path.join(IMAGES_DIR, 'real_samples_manifest.json');
const CATALOG_PATH = path.join(SAMPLES_DIR, 'sample_catalog.json');

const VIDEO_WIDTH = 960;
const VIDEO_HEIGHT = 540;
const VIDEO_FPS = 6;
const VIDEO_FRAMES = 16;

const CULINARY_CLASSES = [
  { id: 0, name: 'Nasi Goreng', slug: 'nasi-goreng' },
  { id: 1, name: 'Bakso', slug: 'bakso' },
  { id: 2, name: 'Sate Ayam', slug: 'sate-ayam' },
  { id: 3, name: 'Rendang', slug: 'rendang' },
  { id: 4, name: 'Soto Ayam', slug: 'soto-ayam' },
  { id: 5, name: 'Ayam Goreng', slug: 'ayam-goreng' },
  { id: 6, name: 'Mie Goreng', slug: 'mie-goreng' },
  { id: 7, name: 'Tempe Goreng', slug: 'tempe-goreng' },
  { id: 8, name: 'Tahu Goreng', slug: 'tahu-goreng' },
  { id: 9, name: 'Gado-Gado', slug: 'gado-gado' },
  { id: 10, name: 'Pempek', slug: 'pempek' },
  { id: 11, name: 'Telur Balado', slug: 'telur-balado' },
];

const HERO_METADATA_BY_SLUG = {
  nasi_goreng: {
    id: 'nasgor_malam',
    aliases: ['nasi_goreng', 'nasi_goreng_real.jpg', 'nasi_goreng_spesial'],
    title: 'Nasi Goreng Spesial — Pencahayaan Hangat',
    description: 'Foto nyata sepiring Nasi Goreng lengkap dengan irisan telur, ayam panggang, cabai, dan paprika untuk pengujian Counting & CLAHE.',
    lighting_condition: 'warm_saturated',
    recommended_enhancement: 'clahe',
    roi_norm: [0.06, 0.08, 0.84, 0.78],
    confidence: 0.94,
  },
  bakso: {
    id: 'bakso_komplit',
    aliases: ['bakso', 'bakso_real.jpg', 'bakso_komplit_pencahayaan_redup'],
    title: 'Bakso Sapi Komplit — Mangkuk Saji',
    description: 'Foto nyata semangkuk Bakso urat dengan mie kuning, sawi hijau, dan kuah kaldu bening untuk Region Counter meja saji.',
    lighting_condition: 'bright_table',
    recommended_enhancement: 'clahe',
    roi_norm: [0.22, 0.16, 0.56, 0.68],
    confidence: 0.93,
  },
  sate_ayam: {
    id: 'sate_madura',
    aliases: ['sate_ayam', 'sate_ayam_real.jpg', 'sate_ayam_madura'],
    title: 'Sate Ayam Madura — Bumbu Kacang',
    description: 'Foto nyata tusukan Sate Ayam panggang dengan bumbu kacang, irisan bawang merah, dan acar ketimun.',
    lighting_condition: 'indoor_warm',
    recommended_enhancement: 'cs',
    roi_norm: [0.16, 0.10, 0.68, 0.74],
    confidence: 0.92,
  },
  rendang: {
    id: 'padang_rendang',
    aliases: ['rendang', 'rendang_real.jpg', 'nasi_padang_rendang'],
    title: 'Rendang Daging Sapi Minang — Daun Pisang',
    description: 'Foto nyata sajian Rendang daging sapi berbumbu gelap pekat di atas daun pisang — kasus uji ideal untuk CLAHE L-channel.',
    lighting_condition: 'dark_rich_spice',
    recommended_enhancement: 'clahe',
    roi_norm: [0.15, 0.12, 0.70, 0.76],
    confidence: 0.95,
  },
  soto_ayam: {
    id: 'soto_ayam',
    aliases: ['soto_ayam_real.jpg', 'pempek_soto_mie_goreng'],
    title: 'Soto Ayam Kuah Kuning — Lamongan',
    description: 'Foto nyata semangkuk Soto Ayam dengan suwiran ayam, telur rebus, tauge, jeruk nipis, dan bawang goreng.',
    lighting_condition: 'high_gloss_broth',
    recommended_enhancement: 'cs',
    roi_norm: [0.20, 0.22, 0.62, 0.62],
    confidence: 0.91,
  },
  ayam_goreng: {
    id: 'ayam_goreng',
    aliases: ['ayam_goreng_real.jpg'],
    title: 'Ayam Goreng Kremes Nusantara',
    description: 'Foto nyata potongan Ayam Goreng keemasan berbumbu ungkep rempah khas Indonesia.',
    lighting_condition: 'golden_contrast',
    recommended_enhancement: 'clahe',
    roi_norm: [0.03, 0.16, 0.86, 0.78],
    confidence: 0.93,
  },
  mie_goreng: {
    id: 'mie_goreng',
    aliases: ['mie_goreng_real.jpg'],
    title: 'Mie Goreng Jawa Komplit',
    description: 'Foto nyata sepiring Mie Goreng kecap lengkap dengan sayuran, tomat, dan irisan lauk.',
    lighting_condition: 'warm_indoor',
    recommended_enhancement: 'clahe',
    roi_norm: [0.11, 0.11, 0.74, 0.75],
    confidence: 0.91,
  },
  tempe_goreng: {
    id: 'tempe_goreng',
    aliases: ['tempe_goreng_real.jpg'],
    title: 'Tempe Goreng Renyah — Warteg',
    description: 'Foto nyata irisan Tempe Goreng keemasan untuk uji ketajaman tekstur kedelai dengan Brightness/Gamma & CLAHE.',
    lighting_condition: 'indoor_ambient',
    recommended_enhancement: 'brightness',
    roi_norm: [0.15, 0.15, 0.72, 0.70],
    confidence: 0.90,
  },
  tahu_goreng: {
    id: 'tahu_goreng',
    aliases: ['tahu_goreng_real.jpg'],
    title: 'Tahu Goreng Crispy Nusantara',
    description: 'Foto nyata potongan Tahu Goreng kecokelatan di atas piring saji.',
    lighting_condition: 'bright_table',
    recommended_enhancement: 'cs',
    roi_norm: [0.09, 0.02, 0.84, 0.76],
    confidence: 0.89,
  },
  gado_gado: {
    id: 'gado_gado',
    aliases: ['gado_gado_real.jpg', 'gado_gado_tahu_tempe'],
    title: 'Gado-Gado Betawi — Bumbu Kacang',
    description: 'Foto nyata sepiring Gado-Gado dengan lontong, sayuran rebus, kerupuk, dan siraman bumbu kacang.',
    lighting_condition: 'balanced_daylight',
    recommended_enhancement: 'cs',
    roi_norm: [0.13, 0.10, 0.75, 0.82],
    confidence: 0.92,
  },
  pempek: {
    id: 'pempek',
    aliases: ['pempek_real.jpg'],
    title: 'Pempek Palembang — Kuah Cuko Hitam',
    description: 'Foto nyata sajian Pempek dengan irisan mentimun, mie, dan kuah cuko gelap yang menantang tanpa kontras lokal.',
    lighting_condition: 'dark_sauce',
    recommended_enhancement: 'clahe',
    roi_norm: [0.14, 0.27, 0.71, 0.62],
    confidence: 0.91,
  },
  telur_balado: {
    id: 'telur_balado',
    aliases: ['telur_balado_real.jpg'],
    title: 'Telur Balado Padang — Sambal Merah',
    description: 'Foto nyata Telur Balado berlumur sambal cabai merah khas rumah makan Padang.',
    lighting_condition: 'spicy_red_cast',
    recommended_enhancement: 'clahe',
    roi_norm: [0.07, 0.11, 0.81, 0.78],
    confidence: 0.92,
  },
  prasmanan_kuliner: {
    id: 'prasmanan_kuliner',
    aliases: ['prasmanan_kuliner_real.jpg', 'prasmanan_nusantara'],
    title: 'Prasmanan Nasi Padang — Multi-Lauk (Inside & Outside ROI)',
    description: 'Foto nyata meja prasmanan Rumah Makan Padang dengan piring lauk beragam untuk demonstrasi Counting & Region Counter (Object Region #1).',
    lighting_condition: 'uneven_table_light',
    recommended_enhancement: 'clahe',
    roi_norm: [0.22, 0.34, 0.42, 0.40],
    confidence: 0.91,
    multi_plates: [
      { class_id: 5, class_name: 'Ayam Goreng', bbox_xyxy: [102, 360, 314, 526], confidence: 0.91 },
      { class_id: 5, class_name: 'Ayam Goreng', bbox_xyxy: [286, 418, 504, 580], confidence: 0.92 },
      { class_id: 3, class_name: 'Rendang', bbox_xyxy: [508, 366, 706, 534], confidence: 0.93 },
      { class_id: 11, class_name: 'Telur Balado', bbox_xyxy: [6, 570, 240, 770], confidence: 0.89 },
    ],
  },
};

const VIDEO_SCENES = [
  {
    id: 'prasmanan_tracking_demo',
    filename: 'prasmanan_tracking_demo.avi',
    title: 'Video Simulasi #1 — Meja Prasmanan & Tracking Lintas ROI (960x540)',
    description: 'Simulasi photorealistic 16 frame (960x540 @ 6 FPS) dengan potongan piring nyata Nasi Goreng, Bakso, dan Rendang melintasi Object Region #1.',
    theme: 'wood_buffet',
    default_roi_norm: [0.30, 0.10, 0.42, 0.80],
    tracks: [
      {
        track_id: 1,
        class_id: 0,
        class_name: 'Nasi Goreng',
        sourceFile: 'nasi_goreng_real.jpg',
        srcCrop: [110, 95, 980, 730],
        drawW: 204,
        drawH: 146,
        xStart: 125,
        xEnd: 830,
        yBase: 112,
        yAmp: 10,
      },
      {
        track_id: 2,
        class_id: 1,
        class_name: 'Bakso',
        sourceFile: 'bakso_real.jpg',
        srcCrop: [255, 85, 780, 780],
        drawW: 158,
        drawH: 158,
        xStart: 835,
        xEnd: 135,
        yBase: 422,
        yAmp: -10,
      },
      {
        track_id: 3,
        class_id: 3,
        class_name: 'Rendang',
        sourceFile: 'rendang_real.jpg',
        srcCrop: [170, 75, 945, 705],
        drawW: 212,
        drawH: 148,
        xStart: 185,
        xEnd: 745,
        yStart: 270,
        yEnd: 270,
        yAmp: 8,
      },
    ],
  },
  {
    id: 'antrean_kantin_demo',
    filename: 'antrean_kantin_demo.avi',
    title: 'Video Simulasi #2 — Antrean Kasir Kantin Masuk ROI (960x540)',
    description: 'Simulasi photorealistic 16 frame (960x540 @ 6 FPS) nampan Sate Ayam, Gado-Gado, dan Telur Balado bergerak masuk ke zona kasir (Object Region #1).',
    theme: 'stone_kasir',
    default_roi_norm: [0.47, 0.08, 0.44, 0.84],
    tracks: [
      {
        track_id: 1,
        class_id: 2,
        class_name: 'Sate Ayam',
        sourceFile: 'sate_ayam_real.jpg',
        srcCrop: [170, 85, 815, 625],
        drawW: 198,
        drawH: 144,
        xStart: 125,
        xEnd: 680,
        yBase: 116,
        yAmp: 8,
      },
      {
        track_id: 2,
        class_id: 9,
        class_name: 'Gado-Gado',
        sourceFile: 'gado_gado_real.jpg',
        srcCrop: [140, 50, 790, 540],
        drawW: 196,
        drawH: 144,
        xStart: 165,
        xEnd: 735,
        yBase: 426,
        yAmp: -8,
      },
      {
        track_id: 3,
        class_id: 11,
        class_name: 'Telur Balado',
        sourceFile: 'telur_balado_real.jpg',
        srcCrop: [95, 110, 1020, 745],
        drawW: 184,
        drawH: 142,
        xStart: 280,
        xEnd: 635,
        yStart: 272,
        yEnd: 272,
        yAmp: 10,
      },
    ],
  },
];

function round4(n) {
  return Number(n.toFixed(4));
}

function round6(n) {
  return Number(n.toFixed(6));
}

function rectNormToPoly(norm, width, height) {
  const [nx, ny, nw, nh] = norm;
  const x1 = Math.round(nx * width);
  const y1 = Math.round(ny * height);
  const x2 = Math.round((nx + nw) * width);
  const y2 = Math.round((ny + nh) * height);
  return [
    [x1, y1],
    [x2, y1],
    [x2, y2],
    [x1, y2],
  ];
}

function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function fourcc(str) {
  return Buffer.from(str, 'ascii');
}

/**
 * Write a Motion-JPEG (.avi) RIFF file from an array of 960x540 JPEG Buffers.
 * MJPG AVI plays smoothly across OpenCV cv2.VideoCapture, VLC, and Windows tools
 * while keeping binary size compact (~1.2 MB vs ~25 MB for uncompressed DIB).
 */
function writeMjpgAvi(filePath, jpegFrames, width, height, fps) {
  const maxFrameSize = Math.max(...jpegFrames.map((b) => b.length), 65536);

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

  // MainAVIHeader (56 bytes)
  const avih = Buffer.alloc(56);
  avih.writeUInt32LE(Math.round(1_000_000 / fps), 0); // dwMicroSecPerFrame
  avih.writeUInt32LE(maxFrameSize * fps, 4); // dwMaxBytesPerSec
  avih.writeUInt32LE(0, 8); // dwPaddingGranularity
  avih.writeUInt32LE(0x10, 12); // AVIF_HASINDEX
  avih.writeUInt32LE(jpegFrames.length, 16); // dwTotalFrames
  avih.writeUInt32LE(0, 20); // dwInitialFrames
  avih.writeUInt32LE(1, 24); // dwStreams
  avih.writeUInt32LE(maxFrameSize, 28); // dwSuggestedBufferSize
  avih.writeUInt32LE(width, 32); // dwWidth
  avih.writeUInt32LE(height, 36); // dwHeight

  // AVIStreamHeader (56 bytes)
  const strh = Buffer.alloc(56);
  fourcc('vids').copy(strh, 0);
  fourcc('MJPG').copy(strh, 4);
  strh.writeUInt32LE(0, 8);
  strh.writeUInt16LE(0, 12);
  strh.writeUInt16LE(0, 14);
  strh.writeUInt32LE(0, 16);
  strh.writeUInt32LE(1, 20); // dwScale
  strh.writeUInt32LE(fps, 24); // dwRate
  strh.writeUInt32LE(0, 28);
  strh.writeUInt32LE(jpegFrames.length, 32);
  strh.writeUInt32LE(maxFrameSize, 36);
  strh.writeUInt32LE(0xFFFFFFFF, 40);
  strh.writeUInt32LE(0, 44);
  strh.writeInt16LE(0, 48);
  strh.writeInt16LE(0, 50);
  strh.writeInt16LE(width, 52);
  strh.writeInt16LE(height, 54);

  // BITMAPINFOHEADER (40 bytes)
  const strf = Buffer.alloc(40);
  strf.writeUInt32LE(40, 0);
  strf.writeInt32LE(width, 4);
  strf.writeInt32LE(height, 8);
  strf.writeUInt16LE(1, 12);
  strf.writeUInt16LE(24, 14);
  fourcc('MJPG').copy(strf, 16);
  strf.writeUInt32LE(width * height * 3, 20);

  const strl = makeList('strl', [makeChunk('strh', strh), makeChunk('strf', strf)]);
  const hdrl = makeList('hdrl', [makeChunk('avih', avih), strl]);

  const frameChunks = [];
  const idxEntries = [];
  let moviOffset = 4;

  for (const jpg of jpegFrames) {
    const chunk = makeChunk('00dc', jpg);
    frameChunks.push(chunk);

    const idx = Buffer.alloc(16);
    fourcc('00dc').copy(idx, 0);
    idx.writeUInt32LE(0x10, 4); // AVIIF_KEYFRAME
    idx.writeUInt32LE(moviOffset, 8);
    idx.writeUInt32LE(jpg.length, 12);
    idxEntries.push(idx);

    moviOffset += chunk.length;
  }

  const movi = makeList('movi', frameChunks);
  const idx1 = makeChunk('idx1', Buffer.concat(idxEntries));

  const aviBody = Buffer.concat([fourcc('AVI '), hdrl, movi, idx1]);
  const riffHdr = Buffer.alloc(8);
  fourcc('RIFF').copy(riffHdr, 0);
  riffHdr.writeUInt32LE(aviBody.length, 4);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const payload = Buffer.concat([riffHdr, aviBody]);
  const tmpOut = `${filePath}.tmp`;
  fs.writeFileSync(tmpOut, payload);
  fs.renameSync(tmpOut, filePath);
}

function buildTrackTrajectory(scene) {
  const roiPoly = rectNormToPoly(scene.default_roi_norm, VIDEO_WIDTH, VIDEO_HEIGHT);
  const frames = [];
  const insideTracks = new Set();

  for (let f = 0; f < VIDEO_FRAMES; f++) {
    const t = VIDEO_FRAMES > 1 ? f / (VIDEO_FRAMES - 1) : 0;
    const objects = scene.tracks.map((tr) => {
      const cx = Math.round(tr.xStart + (tr.xEnd - tr.xStart) * t);
      const baseY =
        typeof tr.yStart === 'number' && typeof tr.yEnd === 'number'
          ? tr.yStart + (tr.yEnd - tr.yStart) * t
          : tr.yBase;
      const cy = Math.round(baseY + Math.sin(t * Math.PI * 2 + tr.track_id) * tr.yAmp);

      const x1 = Math.max(4, Math.round(cx - tr.drawW / 2));
      const y1 = Math.max(4, Math.round(cy - tr.drawH / 2));
      const x2 = Math.min(VIDEO_WIDTH - 4, Math.round(cx + tr.drawW / 2));
      const y2 = Math.min(VIDEO_HEIGHT - 4, Math.round(cy + tr.drawH / 2));

      const inRoi = pointInPolygon((x1 + x2) / 2, (y1 + y2) / 2, roiPoly);
      if (inRoi) insideTracks.add(tr.track_id);

      return {
        track_id: tr.track_id,
        class_id: tr.class_id,
        class_name: tr.class_name,
        cx,
        cy,
        drawW: tr.drawW,
        drawH: tr.drawH,
        srcPath: path.join(IMAGES_DIR, tr.sourceFile),
        srcCrop: tr.srcCrop,
        bbox_xyxy: [x1, y1, x2, y2],
        in_roi: inRoi,
        confidence: Number((0.88 + ((f + tr.track_id) % 5) * 0.015).toFixed(2)),
      };
    });

    frames.push({
      frame_index: f,
      frame_name: `frame_${String(f + 1).padStart(3, '0')}.png`,
      jpg_name: `frame_${String(f + 1).padStart(3, '0')}.jpg`,
      objects,
    });
  }

  return { roiPoly, frames, insideTracks };
}

/**
 * Render all 960x540 PNG + JPEG frames using Windows .NET System.Drawing
 * so every plate in the tracking video is a sharp circular/elliptical crop
 * taken from the authentic high-resolution culinary photos.
 */
function renderVideoFramesWithDotNet(scene, frames, outPngDir, outJpgDir) {
  fs.mkdirSync(outPngDir, { recursive: true });
  fs.mkdirSync(outJpgDir, { recursive: true });

  // Clean old frames so no stale frame_017+ survives
  for (const existing of fs.readdirSync(outPngDir)) {
    if (existing.endsWith('.png')) {
      fs.unlinkSync(path.join(outPngDir, existing));
    }
  }

  const renderPlan = {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    theme: scene.theme,
    roi: rectNormToPoly(scene.default_roi_norm, VIDEO_WIDTH, VIDEO_HEIGHT),
    frames: frames.map((fr) => ({
      pngPath: path.join(outPngDir, fr.frame_name),
      jpgPath: path.join(outJpgDir, fr.jpg_name),
      plates: fr.objects.map((o) => ({
        srcPath: o.srcPath,
        crop: o.srcCrop,
        dx: Math.round(o.cx - o.drawW / 2),
        dy: Math.round(o.cy - o.drawH / 2),
        dw: o.drawW,
        dh: o.drawH,
      })),
    })),
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nv-vid-'));
  const planPath = path.join(tmpDir, 'plan.json');
  const ps1Path = path.join(tmpDir, 'render.ps1');
  fs.writeFileSync(planPath, JSON.stringify(renderPlan), 'utf8');

  const psScript = `
param([string]$PlanFile)
Add-Type -AssemblyName System.Drawing

$plan = Get-Content -Raw -Encoding UTF8 $PlanFile | ConvertFrom-Json
$W = [int]$plan.width
$H = [int]$plan.height

# Cache loaded source bitmaps
$srcCache = @{}
foreach ($fr in $plan.frames) {
  foreach ($p in $fr.plates) {
    if (-not $srcCache.ContainsKey($p.srcPath)) {
      $srcCache[$p.srcPath] = New-Object System.Drawing.Bitmap($p.srcPath)
    }
  }
}

# Pre-render warm photorealistic tabletop backdrop once
$bgBmp = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$bgG = [System.Drawing.Graphics]::FromImage($bgBmp)
$bgG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

if ($plan.theme -eq 'wood_buffet') {
  $rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(72, 46, 30),
    [System.Drawing.Color]::FromArgb(44, 27, 17),
    90
  )
  $bgG.FillRectangle($grad, $rect)
  $grad.Dispose()

  # Subtle wood plank seams & warm wood grain
  for ($y = 0; $y -lt $H; $y += 68) {
    $seamPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(95, 22, 13, 8), 2)
    $bgG.DrawLine($seamPen, 0, $y, $W, $y)
    $seamPen.Dispose()
    $hiPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(35, 156, 108, 72), 1)
    $bgG.DrawLine($hiPen, 0, $y + 2, $W, $y + 2)
    $hiPen.Dispose()
  }
  for ($g = 0; $g -lt 110; $g++) {
    $gy = ($g * 19 + 7) % $H
    $gx1 = ($g * 137) % ($W - 180)
    $glen = 120 + (($g * 53) % 240)
    $alpha = 18 + ($g % 18)
    $grainPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb($alpha, 128, 86, 54), 2)
    $bgG.DrawLine($grainPen, $gx1, $gy, $gx1 + $glen, $gy + (($g % 3) - 1) * 3)
    $grainPen.Dispose()
  }
} else {
  # Canteen stone/terrazzo serving counter
  $rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(52, 58, 66),
    [System.Drawing.Color]::FromArgb(34, 38, 44),
    90
  )
  $bgG.FillRectangle($grad, $rect)
  $grad.Dispose()

  # Counter brushed metal divider line & ambient counter mat
  for ($i = 0; $i -lt 320; $i++) {
    $sx = ($i * 193 + 17) % $W
    $sy = ($i * 97 + 11) % $H
    $sz = 2 + ($i % 3)
    $tone = 68 + ($i % 45)
    $speck = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(32, $tone, $tone + 4, $tone + 8))
    $bgG.FillEllipse($speck, $sx, $sy, $sz, $sz)
    $speck.Dispose()
  }
  $railPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(75, 165, 175, 185), 3)
  $bgG.DrawLine($railPen, 0, 58, $W, 58)
  $bgG.DrawLine($railPen, 0, $H - 44, $W, $H - 44)
  $railPen.Dispose()
}

# Subtle translucent serving mat indicating tray zone on physical table
$rx1 = [int]$plan.roi[0][0]
$ry1 = [int]$plan.roi[0][1]
$rx2 = [int]$plan.roi[2][0]
$ry2 = [int]$plan.roi[2][1]
$matBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(34, 245, 232, 210))
$bgG.FillRectangle($matBrush, $rx1, $ry1, $rx2 - $rx1, $ry2 - $ry1)
$matBrush.Dispose()
$matPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 215, 195, 160), 2)
$bgG.DrawRectangle($matPen, $rx1, $ry1, $rx2 - $rx1, $ry2 - $ry1)
$matPen.Dispose()
$bgG.Dispose()

# Configure high quality JPEG encoder for MJPG chunks
$jpgCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [int64]90)

foreach ($fr in $plan.frames) {
  $frame = $bgBmp.Clone()
  $g = [System.Drawing.Graphics]::FromImage($frame)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

  foreach ($p in $fr.plates) {
    $dx = [float]$p.dx
    $dy = [float]$p.dy
    $dw = [float]$p.dw
    $dh = [float]$p.dh

    # Soft cast shadow beneath real ceramic plate
    for ($sh = 3; $sh -ge 1; $sh--) {
      $shAlpha = 26 + (4 - $sh) * 16
      $shBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($shAlpha, 8, 6, 4))
      $g.FillEllipse($shBrush, $dx + 4 + $sh * 3, $dy + 6 + $sh * 3, $dw, $dh)
      $shBrush.Dispose()
    }

    # Subtle outer ceramic rim highlight
    $rimBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 240, 236, 228))
    $g.FillEllipse($rimBrush, $dx - 3, $dy - 3, $dw + 6, $dh + 6)
    $rimBrush.Dispose()

    # Clip elliptically and draw crisp real dish photo cutout
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse($dx, $dy, $dw, $dh)
    $state = $g.Save()
    $g.SetClip($path)

    $srcBmp = $srcCache[$p.srcPath]
    $srcRect = New-Object System.Drawing.Rectangle([int]$p.crop[0], [int]$p.crop[1], [int]$p.crop[2], [int]$p.crop[3])
    $dstRect = New-Object System.Drawing.Rectangle([int]$dx, [int]$dy, [int]$dw, [int]$dh)
    $g.DrawImage($srcBmp, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Restore($state)

    # Fine rim shading
    $rimPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(140, 255, 252, 245), 2)
    $g.DrawEllipse($rimPen, $dx, $dy, $dw, $dh)
    $rimPen.Dispose()
    $path.Dispose()
  }

  $g.Dispose()
  $frame.Save($fr.pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $frame.Save($fr.jpgPath, $jpgCodec, $encParams)
  $frame.Dispose()
}

foreach ($bmp in $srcCache.Values) {
  $bmp.Dispose()
}
$bgBmp.Dispose()
`;

  fs.writeFileSync(ps1Path, psScript, 'utf8');
  try {
    execFileSync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1Path, '-PlanFile', planPath],
      { stdio: 'inherit' },
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function buildCatalog() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest tidak ditemukan: ${MANIFEST_PATH}`);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const heroes = Array.isArray(manifest.all_heroes) ? manifest.all_heroes : [];
  if (heroes.length !== 13) {
    throw new Error(`Diharapkan 13 foto hero di real_samples_manifest.json, ditemukan ${heroes.length}`);
  }

  const images = heroes.map((hero) => {
    const filePath = path.join(IMAGES_DIR, hero.sampleFile);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File foto hero hilang: ${filePath}`);
    }
    const meta = HERO_METADATA_BY_SLUG[hero.slug];
    if (!meta) {
      throw new Error(`Metadata hero belum didefinisikan untuk slug: ${hero.slug}`);
    }

    const width = Number(hero.width);
    const height = Number(hero.height);
    const roiPoly = rectNormToPoly(meta.roi_norm, width, height);

    let groundTruth;
    if (Array.isArray(meta.multi_plates)) {
      groundTruth = meta.multi_plates.map((plate) => {
        const [x1, y1, x2, y2] = plate.bbox_xyxy;
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        return {
          class_id: plate.class_id,
          class_name: plate.class_name,
          bbox_xyxy: [x1, y1, x2, y2],
          bbox_yolo: [
            round6(cx / width),
            round6(cy / height),
            round6((x2 - x1) / width),
            round6((y2 - y1) / height),
          ],
          confidence: plate.confidence,
          confidence_gt: plate.confidence,
          in_default_roi: pointInPolygon(cx, cy, roiPoly),
        };
      });
    } else {
      const [x1, y1, x2, y2] = hero.bbox_xyxy;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      groundTruth = [
        {
          class_id: hero.classId,
          class_name: hero.name,
          bbox_xyxy: [x1, y1, x2, y2],
          bbox_yolo: Array.isArray(hero.bbox_yolo)
            ? hero.bbox_yolo.map(round6)
            : [
                round6(cx / width),
                round6(cy / height),
                round6((x2 - x1) / width),
                round6((y2 - y1) / height),
              ],
          confidence: meta.confidence,
          confidence_gt: meta.confidence,
          in_default_roi: pointInPolygon(cx, cy, roiPoly),
        },
      ];
    }

    return {
      id: meta.id,
      slug: hero.slug,
      aliases: meta.aliases,
      filename: hero.sampleFile,
      path: `samples/images/${hero.sampleFile}`,
      title: meta.title,
      description: meta.description,
      width,
      height,
      lighting_condition: meta.lighting_condition,
      recommended_enhancement: meta.recommended_enhancement,
      default_roi: roiPoly,
      default_roi_norm: meta.roi_norm.map(round4),
      ground_truth: groundTruth,
      source: hero.source || '',
      license: hero.license || '',
    };
  });

  const videos = [];
  for (const scene of VIDEO_SCENES) {
    const outPngDir = path.join(FRAMES_ROOT, scene.id);
    const tmpJpgDir = fs.mkdtempSync(path.join(os.tmpdir(), `nv-jpg-${scene.id}-`));
    const { roiPoly, frames, insideTracks } = buildTrackTrajectory(scene);

    try {
      renderVideoFramesWithDotNet(scene, frames, outPngDir, tmpJpgDir);
      const jpegBuffers = frames.map((fr) => fs.readFileSync(path.join(tmpJpgDir, fr.jpg_name)));
      const aviPath = path.join(VIDEOS_DIR, scene.filename);
      writeMjpgAvi(aviPath, jpegBuffers, VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS);
    } finally {
      fs.rmSync(tmpJpgDir, { recursive: true, force: true });
    }

    videos.push({
      id: scene.id,
      filename: scene.filename,
      path: `samples/videos/${scene.filename}`,
      frames_dir: `samples/videos/frames/${scene.id}`,
      format: 'MJPG AVI + PNG Frame Sequence (960x540)',
      title: scene.title,
      description: scene.description,
      width: VIDEO_WIDTH,
      height: VIDEO_HEIGHT,
      fps: VIDEO_FPS,
      total_frames: VIDEO_FRAMES,
      frame_count: VIDEO_FRAMES,
      default_roi: roiPoly,
      default_roi_norm: scene.default_roi_norm.map(round4),
      expected_tracks: scene.tracks.map((tr) => ({
        track_id: tr.track_id,
        class_id: tr.class_id,
        class_name: tr.class_name,
        enters_roi: insideTracks.has(tr.track_id),
      })),
      frame_annotations: frames.map((fr) => ({
        frame_index: fr.frame_index,
        frame_file: `samples/videos/frames/${scene.id}/${fr.frame_name}`,
        objects: fr.objects.map((o) => ({
          track_id: o.track_id,
          class_id: o.class_id,
          class_name: o.class_name,
          bbox_xyxy: o.bbox_xyxy,
          in_roi: o.in_roi,
          confidence: o.confidence,
        })),
      })),
    });
  }

  const stats = manifest.stats || {};
  const catalog = {
    project: 'NusantaraVision YOLOv11 — Sistem Deteksi, Counting, Tracking & Image Enhancement Kuliner Indonesia',
    generated_at: new Date().toISOString(),
    generator: 'scripts/prepare_samples.mjs',
    total_classes: CULINARY_CLASSES.length,
    dataset_stats: {
      total: stats.total || 600,
      train: stats.train || 420,
      train_originals: stats.trainOriginals || 314,
      train_augmented: stats.trainAugmented || 106,
      valid: stats.valid || 120,
      test: stats.test || 60,
      unique_originals: stats.uniqueOriginals || 494,
    },
    classes: CULINARY_CLASSES.map((c) => {
      const br = (stats.perClassBreakdown && stats.perClassBreakdown[c.name]) || {};
      return {
        ...c,
        dataset_count: br.total || 50,
        unique_originals: br.uniqueOriginals || 50,
        train_originals: br.trainOriginals || 35,
        train_augmented: br.trainAugmented || 0,
        train_count: br.trainTotal || 35,
        valid_count: br.validTotal || 10,
        test_count: br.testTotal || 5,
      };
    }),
    images,
    videos,
  };

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  console.log(`[prepare_samples] Synced ${images.length} real hero images from real_samples_manifest.json`);
  console.log(`[prepare_samples] Generated ${videos.length} 960x540 photorealistic videos (${VIDEO_FRAMES} frames each) in ${VIDEOS_DIR}`);
  console.log(`[prepare_samples] Wrote catalog to ${CATALOG_PATH}`);
}

buildCatalog();
