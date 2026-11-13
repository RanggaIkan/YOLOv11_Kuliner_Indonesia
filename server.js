/**
 * NusantaraVision YOLOv11 — Zero-Dependency Node.js v24 Local Server
 *
 * Serves frontend/, samples/, and reports/ static assets and implements
 * /api/health, /api/classes, /api/samples, /api/detect/image,
 * /api/detect/video, /api/compare-enhancements, and /api/export/excel
 * so the full web application runs locally on Windows without Python or GPU.
 *
 * Usage:
 *   node server.js
 *   PORT=8000 node server.js
 */

"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const ROOT_DIR = __dirname;
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");
const SAMPLES_DIR = path.join(ROOT_DIR, "samples");
const REPORTS_DIR = path.join(ROOT_DIR, "reports");
const SAMPLE_CATALOG_PATH = path.join(SAMPLES_DIR, "sample_catalog.json");
const FALLBACK_DB_PATH = path.join(REPORTS_DIR, "local_db_fallback.json");
const REPORT_XLSX_PATH = path.join(REPORTS_DIR, "Laporan_Before_After_Enhancement.xlsx");

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || "127.0.0.1";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avi": "video/x-msvideo",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".csv": "text/csv; charset=utf-8",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ipynb": "application/x-ipynb+json",
  ".md": "text/markdown; charset=utf-8",
  ".ico": "image/x-icon",
};

const DEFAULT_CLASSES = [
  { id: 1, name: "Nasi Goreng", slug: "nasi-goreng", region_origin: "Nusantara", category: "Makanan Pokok", dataset_count: 55 },
  { id: 2, name: "Bakso", slug: "bakso", region_origin: "Jawa Tengah / Jawa Timur", category: "Berkuah", dataset_count: 55 },
  { id: 3, name: "Sate Ayam", slug: "sate-ayam", region_origin: "Madura, Jawa Timur", category: "Panggang", dataset_count: 52 },
  { id: 4, name: "Rendang", slug: "rendang", region_origin: "Minangkabau, Sumatera Barat", category: "Lauk Utama", dataset_count: 50 },
  { id: 5, name: "Soto Ayam", slug: "soto-ayam", region_origin: "Lamongan / Jawa", category: "Berkuah", dataset_count: 50 },
  { id: 6, name: "Ayam Goreng", slug: "ayam-goreng", region_origin: "Nusantara", category: "Lauk Utama", dataset_count: 52 },
  { id: 7, name: "Mie Goreng", slug: "mie-goreng", region_origin: "Jawa / Nusantara", category: "Makanan Pokok", dataset_count: 50 },
  { id: 8, name: "Tempe Goreng", slug: "tempe-goreng", region_origin: "Jawa", category: "Lauk Pendamping", dataset_count: 48 },
  { id: 9, name: "Tahu Goreng", slug: "tahu-goreng", region_origin: "Jawa", category: "Lauk Pendamping", dataset_count: 48 },
  { id: 10, name: "Gado-Gado", slug: "gado-gado", region_origin: "Betawi, DKI Jakarta", category: "Sayuran", dataset_count: 48 },
  { id: 11, name: "Pempek", slug: "pempek", region_origin: "Palembang, Sumatera Selatan", category: "Kudapan", dataset_count: 46 },
  { id: 12, name: "Telur Balado", slug: "telur-balado", region_origin: "Minangkabau, Sumatera Barat", category: "Lauk Pendamping", dataset_count: 46 },
];

const DEFAULT_COMPARISONS = [
  {
    image_name: "nasi_goreng_spesial.png",
    ground_truth_count: 4,
    before_count: 3,
    before_conf: 0.624,
    he_count: 4,
    he_conf: 0.758,
    clahe_count: 4,
    clahe_conf: 0.892,
    cs_count: 4,
    cs_conf: 0.821,
    brightness_count: 3,
    brightness_conf: 0.774,
    best_method: "CLAHE",
    conf_improvement_pct: 42.95,
    psnr_db: 28.45,
  },
  {
    image_name: "bakso_komplit.png",
    ground_truth_count: 4,
    before_count: 3,
    before_conf: 0.641,
    he_count: 4,
    he_conf: 0.794,
    clahe_count: 4,
    clahe_conf: 0.884,
    cs_count: 4,
    cs_conf: 0.836,
    brightness_count: 4,
    brightness_conf: 0.768,
    best_method: "CLAHE",
    conf_improvement_pct: 37.91,
    psnr_db: 29.12,
  },
  {
    image_name: "sate_ayam_madura.png",
    ground_truth_count: 4,
    before_count: 2,
    before_conf: 0.592,
    he_count: 3,
    he_conf: 0.739,
    clahe_count: 4,
    clahe_conf: 0.869,
    cs_count: 4,
    cs_conf: 0.818,
    brightness_count: 3,
    brightness_conf: 0.752,
    best_method: "CLAHE",
    conf_improvement_pct: 46.79,
    psnr_db: 27.84,
  },
  {
    image_name: "nasi_padang_rendang.png",
    ground_truth_count: 5,
    before_count: 4,
    before_conf: 0.668,
    he_count: 5,
    he_conf: 0.788,
    clahe_count: 5,
    clahe_conf: 0.905,
    cs_count: 5,
    cs_conf: 0.847,
    brightness_count: 4,
    brightness_conf: 0.793,
    best_method: "CLAHE",
    conf_improvement_pct: 35.48,
    psnr_db: 30.11,
  },
];

const ENHANCEMENT_PROFILES = {
  none: {
    label: "Original (Before)",
    confFactor: 0.74,
    brightness: 88.4,
    contrast: 31.2,
    entropy: 6.18,
    psnr: 99.99,
    gainPct: 0.0,
    dropWeakest: true,
  },
  original: {
    label: "Original (Before)",
    confFactor: 0.74,
    brightness: 88.4,
    contrast: 31.2,
    entropy: 6.18,
    psnr: 99.99,
    gainPct: 0.0,
    dropWeakest: true,
  },
  he: {
    label: "Histogram Equalization (HE)",
    confFactor: 0.88,
    brightness: 127.6,
    contrast: 52.4,
    entropy: 7.12,
    psnr: 24.85,
    gainPct: 67.95,
    dropWeakest: false,
  },
  clahe: {
    label: "CLAHE (LAB L-Channel)",
    confFactor: 0.99,
    brightness: 121.8,
    contrast: 58.1,
    entropy: 7.46,
    psnr: 29.34,
    gainPct: 86.22,
    dropWeakest: false,
  },
  cs: {
    label: "Contrast Stretching (2-98%)",
    confFactor: 0.93,
    brightness: 116.5,
    contrast: 54.8,
    entropy: 7.28,
    psnr: 27.62,
    gainPct: 75.64,
    dropWeakest: false,
  },
  brightness: {
    label: "Brightness & Gamma",
    confFactor: 0.9,
    brightness: 134.2,
    contrast: 46.9,
    entropy: 6.95,
    psnr: 26.15,
    gainPct: 50.32,
    dropWeakest: false,
  },
};

function readJsonSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch {
    // Ignore malformed optional JSON and fall back cleanly
  }
  return null;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message, status: statusCode });
}

function readRawBody(req, maxBytes = 64 * 1024 * 1024) {
  if (req.readableEnded) {
    return Promise.resolve(Buffer.alloc(0));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Payload melebihi batas ukuran maksimum 64MB."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipartForm(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType || "");
  if (!match) {
    return { fields: {}, files: {} };
  }
  const boundary = match[1] || match[2];
  const rawStr = buffer.toString("latin1");
  const delimiter = `--${boundary}`;
  const parts = rawStr.split(delimiter).slice(1, -1);

  const fields = {};
  const files = {};

  for (const part of parts) {
    const cleanPart = part.startsWith("\r\n") ? part.slice(2) : part;
    const headerEnd = cleanPart.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headerStr = cleanPart.slice(0, headerEnd);
    let bodyStr = cleanPart.slice(headerEnd + 4);
    if (bodyStr.endsWith("\r\n")) {
      bodyStr = bodyStr.slice(0, -2);
    }

    const nameMatch = /name="([^"]+)"/i.exec(headerStr);
    if (!nameMatch) continue;
    const fieldName = nameMatch[1];
    const fileMatch = /filename="([^"]*)"/i.exec(headerStr);

    if (fileMatch) {
      files[fieldName] = {
        filename: fileMatch[1] || "upload.bin",
        buffer: Buffer.from(bodyStr, "latin1"),
      };
    } else {
      fields[fieldName] = Buffer.from(bodyStr, "latin1").toString("utf8");
    }
  }

  return { fields, files };
}

async function parseRequestPayload(req) {
  const contentType = req.headers["content-type"] || "";

  // Vercel Serverless runtime may pre-consume and attach req.body
  if (req.body !== undefined && !Buffer.isBuffer(req.body) && typeof req.body === "object" && req.body !== null) {
    return { fields: req.body, files: {}, json: req.body };
  }

  let rawBody;
  if (Buffer.isBuffer(req.body)) {
    rawBody = req.body;
  } else if (typeof req.body === "string") {
    rawBody = Buffer.from(req.body, "utf8");
  } else {
    rawBody = await readRawBody(req);
  }

  if (!rawBody.length) {
    return { fields: {}, files: {}, json: {} };
  }
  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(rawBody.toString("utf8"));
      return { fields: parsed, files: {}, json: parsed };
    } catch {
      throw new Error("Body JSON tidak valid.");
    }
  }
  if (contentType.includes("multipart/form-data")) {
    const { fields, files } = parseMultipartForm(rawBody, contentType);
    return { fields, files, json: {} };
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody.toString("utf8"));
    const fields = Object.fromEntries(params.entries());
    return { fields, files: {}, json: fields };
  }
  return { fields: {}, files: {}, json: {} };
}

function parseJsonMaybe(value, fallback = null) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function normalizePolygon(regionPoints, width, height) {
  if (!Array.isArray(regionPoints) || regionPoints.length < 3) {
    return [
      [Math.round(width * 0.18), Math.round(height * 0.16)],
      [Math.round(width * 0.82), Math.round(height * 0.16)],
      [Math.round(width * 0.82), Math.round(height * 0.86)],
      [Math.round(width * 0.18), Math.round(height * 0.86)],
    ];
  }
  return regionPoints.map(([px, py]) => {
    let x = Number(px);
    let y = Number(py);
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      x *= width;
      y *= height;
    }
    return [Math.round(x), Math.round(y)];
  });
}

function pointInPolygon(point, polygon) {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const onSegment =
      px >= Math.min(xi, xj) - 0.5 &&
      px <= Math.max(xi, xj) + 0.5 &&
      py >= Math.min(yi, yj) - 0.5 &&
      py <= Math.max(yi, yj) + 0.5 &&
      Math.abs((xj - xi) * (py - yi) - (px - xi) * (yj - yi)) <= 1e-3;
    if (onSegment) return true;

    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const SAMPLE_ID_ALIASES = {
  nasgor_malam: "nasi_goreng_spesial",
  sate_madura: "sate_ayam_madura",
  padang_rendang: "nasi_padang_rendang",
  gado_gado: "gado_gado_tahu_tempe",
};

function findCatalogSample(sampleId, filename) {
  const catalog = readJsonSafe(SAMPLE_CATALOG_PATH);
  if (!catalog || !Array.isArray(catalog.images)) return null;
  const rawTarget = (sampleId || filename || "").toLowerCase().replace(/\.[a-z0-9]+$/i, "");
  if (!rawTarget) return catalog.images[0] || null;
  const target = SAMPLE_ID_ALIASES[rawTarget] || rawTarget;
  return (
    catalog.images.find(
      (img) =>
        img.id.toLowerCase() === target ||
        img.filename.toLowerCase().replace(/\.[a-z0-9]+$/i, "") === target
    ) || null
  );
}

function findPrimaryClassFromText(text) {
  const norm = String(text || "").toLowerCase().replace(/[_-]+/g, " ");
  if (!norm) return null;
  return (
    DEFAULT_CLASSES.find(
      (cls) => norm.includes(cls.name.toLowerCase()) || norm.includes(cls.slug.replace(/-/g, " "))
    ) || null
  );
}

function buildFallbackDetections(seedName) {
  const seed = hashSeed(seedName || "kuliner_nusantara.jpg");
  const matchedPrimary = findPrimaryClassFromText(seedName);
  const count = matchedPrimary ? 3 : 3 + (seed % 3);
  const layouts = matchedPrimary
    ? [
        [155, 105, 485, 390],
        [455, 130, 585, 270],
        [75, 250, 210, 390],
      ]
    : [
        [130, 115, 290, 260],
        [325, 110, 495, 255],
        [165, 265, 320, 405],
        [350, 265, 510, 405],
        [60, 165, 175, 295],
      ];
  const detections = [];
  for (let i = 0; i < count; i += 1) {
    let cls;
    if (i === 0 && matchedPrimary) {
      cls = matchedPrimary;
    } else {
      cls = DEFAULT_CLASSES[(seed + i * 3) % DEFAULT_CLASSES.length];
      if (matchedPrimary && cls.id === matchedPrimary.id) {
        cls = DEFAULT_CLASSES[(cls.id + i) % DEFAULT_CLASSES.length];
      }
    }
    const bbox = layouts[i % layouts.length];
    detections.push({
      class_id: cls.id - 1,
      class_name: cls.name,
      bbox_xyxy: bbox,
      confidence_gt: i === 0 && matchedPrimary ? 0.935 : Number((0.84 + ((seed + i * 7) % 12) * 0.01).toFixed(3)),
    });
  }
  return {
    id: seedName || "uploaded_image",
    title: seedName || "Citra Unggahan Pengguna",
    width: 640,
    height: 480,
    lighting_condition: "low_light",
    default_roi: [
      [110, 80],
      [530, 80],
      [530, 410],
      [110, 410],
    ],
    ground_truth: detections,
  };
}

function runSimulatedImageDetection(options) {
  const {
    sampleId = "",
    filename = "",
    enhancement = "none",
    mode = "counting",
    confThreshold = 0.25,
    regionPoints = null,
    params = {},
  } = options;

  const normMethod = (enhancement || "none").toLowerCase();
  const profile = ENHANCEMENT_PROFILES[normMethod] || ENHANCEMENT_PROFILES.none;
  const sample = findCatalogSample(sampleId, filename) || buildFallbackDetections(filename || sampleId);

  const width = sample.width || 640;
  const height = sample.height || 480;
  const polygon = normalizePolygon(regionPoints || sample.default_roi, width, height);

  const rawItems = Array.isArray(sample.ground_truth) ? sample.ground_truth : [];
  const detections = [];
  const classCounts = {};
  const classCountsInRegion = {};
  let insideCount = 0;
  let outsideCount = 0;

  rawItems.forEach((item, idx) => {
    const baseConf = Number(item.confidence_gt || 0.88);
    let adjustedConf = Math.min(0.985, Math.max(0.2, baseConf * profile.confFactor));

    if (normMethod === "brightness" && params && params.brightness != null) {
      const bShift = Math.abs(Number(params.brightness) || 0) > 75 ? -0.04 : 0.01;
      adjustedConf = Math.min(0.97, Math.max(0.25, adjustedConf + bShift));
    }

    // Simulate missed small/low-contrast object before enhancement in low-light scenes
    if (
      profile.dropWeakest &&
      rawItems.length >= 3 &&
      idx === rawItems.length - 1 &&
      (sample.lighting_condition === "low_light" || sample.lighting_condition === "uneven_shadow")
    ) {
      adjustedConf = Math.min(adjustedConf, Math.max(0.18, confThreshold - 0.03));
    }

    if (adjustedConf < confThreshold) {
      return;
    }

    const [x1, y1, x2, y2] = item.bbox_xyxy || [120, 120, 260, 260];
    const cx = Number(((x1 + x2) / 2).toFixed(1));
    const cy = Number(((y1 + y2) / 2).toFixed(1));
    const inRegion = pointInPolygon([cx, cy], polygon);
    const clsName = item.class_name || "Nasi Goreng";

    classCounts[clsName] = (classCounts[clsName] || 0) + 1;
    if (inRegion) {
      insideCount += 1;
      classCountsInRegion[clsName] = (classCountsInRegion[clsName] || 0) + 1;
    } else {
      outsideCount += 1;
    }

    detections.push({
      class_id: item.class_id ?? idx,
      class_name: clsName,
      confidence: Number(adjustedConf.toFixed(4)),
      bbox: [x1, y1, x2, y2],
      centroid: [cx, cy],
      in_region: inRegion,
      track_id: mode === "tracking" ? idx + 1 : null,
    });
  });

  const avgConf = detections.length
    ? Number((detections.reduce((acc, d) => acc + d.confidence, 0) / detections.length).toFixed(4))
    : 0;

  return {
    model_name: "yolo11n.pt (node-local-simulator)",
    is_custom_trained: false,
    runtime: "node-local-fallback",
    media_name: sample.filename || filename || sample.id,
    mode,
    enhancement: normMethod,
    image_size: { width, height },
    inference_ms: Number((18.5 + detections.length * 2.4).toFixed(2)),
    total_detected: detections.length,
    avg_confidence: avgConf,
    inside_region_count: insideCount,
    outside_region_count: outsideCount,
    class_counts: classCounts,
    class_counts_in_region: classCountsInRegion,
    region_points: polygon,
    image_metrics: {
      mean_brightness: profile.brightness,
      rms_contrast: profile.contrast,
      entropy: profile.entropy,
      psnr: profile.psnr,
      enhancement_gain_pct: profile.gainPct,
    },
    detections,
  };
}

function runSimulatedVideoDetection(options) {
  const {
    sampleId = "",
    filename = "",
    enhancement = "none",
    mode = "tracking",
    tracker = "bytetrack.yaml",
    confThreshold = 0.25,
    regionPoints = null,
  } = options;

  const catalog = readJsonSafe(SAMPLE_CATALOG_PATH);
  const videos = catalog && Array.isArray(catalog.videos) ? catalog.videos : [];
  const target = (sampleId || filename || "").toLowerCase().replace(/\.[a-z0-9]+$/i, "");
  let videoSample =
    videos.find(
      (v) =>
        v.id.toLowerCase() === target ||
        v.filename.toLowerCase().replace(/\.[a-z0-9]+$/i, "") === target
    ) || videos[0];

  if (!videoSample) {
    videoSample = {
      id: "prasmanan_tracking_demo",
      filename: filename || "prasmanan_tracking_demo.avi",
      width: 320,
      height: 240,
      fps: 6,
      default_roi: [
        [105, 35],
        [225, 35],
        [225, 205],
        [105, 205],
      ],
      frame_annotations: Array.from({ length: 8 }, (_, fIdx) => ({
        frame_index: fIdx,
        detections: [
          {
            track_id: 1,
            class_id: 0,
            class_name: "Nasi Goreng",
            bbox_xyxy: [20 + fIdx * 24, 55, 95 + fIdx * 24, 115],
            confidence: 0.89,
          },
          {
            track_id: 2,
            class_id: 1,
            class_name: "Bakso",
            bbox_xyxy: [220 - fIdx * 18, 125, 290 - fIdx * 18, 185],
            confidence: 0.87,
          },
        ],
      })),
    };
  }

  const width = videoSample.width || 320;
  const height = videoSample.height || 240;
  const fps = videoSample.fps || 6;
  const polygon = normalizePolygon(regionPoints || videoSample.default_roi, width, height);
  const profile = ENHANCEMENT_PROFILES[(enhancement || "none").toLowerCase()] || ENHANCEMENT_PROFILES.none;

  const trails = {};
  const uniqueTracks = new Set();
  const uniqueTracksInside = new Set();
  const classCountsTotal = {};
  const classCountsInRegion = {};
  const allConfs = [];
  const frameSummaries = [];

  for (const frame of videoSample.frame_annotations || []) {
    const frameDets = [];
    const frameClassCounts = {};
    const frameRoiCounts = {};
    let inside = 0;
    let outside = 0;

    for (const det of frame.detections || []) {
      const conf = Math.min(0.98, Number((Number(det.confidence || 0.88) * profile.confFactor).toFixed(4)));
      if (conf < confThreshold) continue;

      const [x1, y1, x2, y2] = det.bbox_xyxy;
      const cx = Number(((x1 + x2) / 2).toFixed(1));
      const cy = Number(((y1 + y2) / 2).toFixed(1));
      const inRegion = pointInPolygon([cx, cy], polygon);
      const tid = det.track_id ?? 1;
      const clsName = det.class_name || "Nasi Goreng";

      allConfs.push(conf);
      uniqueTracks.add(tid);
      if (!trails[tid]) trails[tid] = [];
      trails[tid].push([Math.round(cx), Math.round(cy)]);

      frameClassCounts[clsName] = (frameClassCounts[clsName] || 0) + 1;
      if (inRegion) {
        inside += 1;
        uniqueTracksInside.add(tid);
        frameRoiCounts[clsName] = (frameRoiCounts[clsName] || 0) + 1;
      } else {
        outside += 1;
      }

      frameDets.push({
        track_id: mode === "tracking" ? tid : null,
        class_id: det.class_id ?? 0,
        class_name: clsName,
        confidence: conf,
        bbox: [x1, y1, x2, y2],
        centroid: [cx, cy],
        in_region: inRegion,
      });
    }

    for (const [k, v] of Object.entries(frameClassCounts)) {
      classCountsTotal[k] = Math.max(classCountsTotal[k] || 0, v);
    }
    for (const [k, v] of Object.entries(frameRoiCounts)) {
      classCountsInRegion[k] = Math.max(classCountsInRegion[k] || 0, v);
    }

    frameSummaries.push({
      frame_index: frame.frame_index,
      timestamp_sec: Number((frame.frame_index / Math.max(fps, 1)).toFixed(2)),
      total_detected: frameDets.length,
      inside_region_count: inside,
      outside_region_count: outside,
      detections: frameDets,
    });
  }

  const lastFrame = frameSummaries[frameSummaries.length - 1] || {};
  const avgConf = allConfs.length
    ? Number((allConfs.reduce((a, b) => a + b, 0) / allConfs.length).toFixed(4))
    : 0;

  return {
    model_name: "yolo11n.pt (node-local-simulator)",
    is_custom_trained: false,
    runtime: "node-local-fallback",
    media_name: videoSample.filename || filename,
    mode,
    tracker: mode === "tracking" ? tracker : null,
    enhancement: (enhancement || "none").toLowerCase(),
    video_info: { fps, width, height },
    frames_processed: frameSummaries.length,
    inference_ms: Number((frameSummaries.length * 14.2).toFixed(2)),
    total_detected: lastFrame.total_detected || 0,
    unique_tracks_total: uniqueTracks.size,
    inside_region_count: mode === "tracking" ? uniqueTracksInside.size : lastFrame.inside_region_count || 0,
    outside_region_count: lastFrame.outside_region_count || 0,
    avg_confidence: avgConf,
    class_counts: classCountsTotal,
    class_counts_in_region: classCountsInRegion,
    region_points: polygon,
    trails,
    frame_summaries: frameSummaries,
  };
}

function getComparisonRows(customRows) {
  if (Array.isArray(customRows) && customRows.length) return customRows;
  const fallbackDb = readJsonSafe(FALLBACK_DB_PATH);
  if (fallbackDb && Array.isArray(fallbackDb.enhancement_comparisons) && fallbackDb.enhancement_comparisons.length) {
    return fallbackDb.enhancement_comparisons;
  }
  return DEFAULT_COMPARISONS;
}

function formatPct(val) {
  const num = Number(val || 0);
  if (num > 0 && num <= 1) return Number((num * 100).toFixed(2));
  return Number(num.toFixed(2));
}

function generateCsvBuffer(rows) {
  const headers = [
    "No",
    "Nama Citra",
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
    "Metode Terbaik",
    "Peningkatan Conf (%)",
    "PSNR (dB)",
  ];
  const escapeCsv = (val) => {
    const str = String(val ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.map(escapeCsv).join(",")];
  rows.forEach((item, idx) => {
    lines.push(
      [
        idx + 1,
        item.image_name || `sample_${idx + 1}.jpg`,
        Number(item.ground_truth_count || 0),
        Number(item.before_count || 0),
        formatPct(item.before_conf),
        Number(item.he_count || 0),
        formatPct(item.he_conf),
        Number(item.clahe_count || 0),
        formatPct(item.clahe_conf),
        Number(item.cs_count || 0),
        formatPct(item.cs_conf),
        Number(item.brightness_count || 0),
        formatPct(item.brightness_conf),
        item.best_method || "CLAHE",
        Number(item.conf_improvement_pct || 0).toFixed(2),
        Number(item.psnr_db || 0).toFixed(2),
      ]
        .map(escapeCsv)
        .join(",")
    );
  });
  return Buffer.from(`\uFEFF${lines.join("\r\n")}`, "utf8");
}

// --- Minimal zero-dependency Store-ZIP + OOXML (.xlsx) builder ---
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const dataBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf8");
    const crc = crc32(dataBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    localHeader.writeUInt16LE(0, 8); // Store method (no compression)
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(dataBuf.length, 18);
    localHeader.writeUInt32LE(dataBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, dataBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + dataBuf.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

function escapeXml(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colLetter(indexZeroBased) {
  let n = indexZeroBased;
  let str = "";
  while (n >= 0) {
    str = String.fromCharCode((n % 26) + 65) + str;
    n = Math.floor(n / 26) - 1;
  }
  return str;
}

function buildWorksheetXml(matrix) {
  const rowXml = matrix
    .map((row, rIdx) => {
      const rNum = rIdx + 1;
      const cells = row
        .map((val, cIdx) => {
          const ref = `${colLetter(cIdx)}${rNum}`;
          if (typeof val === "number" && Number.isFinite(val)) {
            return `<c r="${ref}"><v>${val}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rNum}">${cells}</row>`;
    })
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${rowXml}</sheetData>` +
    `</worksheet>`
  );
}

function generateXlsxBuffer(rows) {
  const matrix = [
    ["Laporan Evaluasi YOLOv11 Kuliner Indonesia — Before vs After Image Enhancement"],
    [
      "No",
      "Nama Citra",
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
      "Metode Terbaik",
      "Peningkatan Conf (%)",
      "PSNR (dB)",
    ],
    ...rows.map((item, idx) => [
      idx + 1,
      item.image_name || `sample_${idx + 1}.jpg`,
      Number(item.ground_truth_count || 0),
      Number(item.before_count || 0),
      formatPct(item.before_conf),
      Number(item.he_count || 0),
      formatPct(item.he_conf),
      Number(item.clahe_count || 0),
      formatPct(item.clahe_conf),
      Number(item.cs_count || 0),
      formatPct(item.cs_conf),
      Number(item.brightness_count || 0),
      formatPct(item.brightness_conf),
      item.best_method || "CLAHE",
      Number(item.conf_improvement_pct || 0),
      Number(item.psnr_db || 0),
    ]),
  ];

  const entries = [
    {
      name: "[Content_Types].xml",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `</Types>`,
    },
    {
      name: "_rels/.rels",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="Before vs After" sheetId="1" r:id="rId1"/></sheets>` +
        `</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `</Relationships>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: buildWorksheetXml(matrix),
    },
  ];

  return buildZipBuffer(entries);
}

function serveStaticFile(req, res, filePath, allowedRoot) {
  const resolved = path.resolve(filePath);
  const rootResolved = path.resolve(allowedRoot);
  if (!resolved.startsWith(rootResolved)) {
    sendError(res, 403, "Akses path ditolak.");
    return true;
  }
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    return false;
  }

  const ext = path.extname(resolved).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  const stat = fs.statSync(resolved);
  const rangeHeader = req.headers.range;

  if (rangeHeader && (ext === ".mp4" || ext === ".webm" || ext === ".avi")) {
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (start <= end && start < stat.size) {
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
          "Content-Type": mime,
          "Access-Control-Allow-Origin": "*",
        });
        fs.createReadStream(resolved, { start, end }).pipe(res);
        return true;
      }
    }
  }

  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": stat.size,
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
  });
  fs.createReadStream(resolved).pipe(res);
  return true;
}

async function handleRequest(req, res) {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });
      res.end();
      return;
    }

    const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(reqUrl.pathname);

    if (pathname === "/api/health" && req.method === "GET") {
      const modelExists = fs.existsSync(path.join(ROOT_DIR, "models", "best.pt"));
      sendJson(res, 200, {
        status: "ok",
        app: "NusantaraVision YOLOv11",
        version: "1.0.0",
        runtime: "node-local-fallback",
        node_version: process.version,
        python_available: false,
        custom_model_present: modelExists,
        classes_count: DEFAULT_CLASSES.length,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (pathname === "/api/classes" && req.method === "GET") {
      const fallbackDb = readJsonSafe(FALLBACK_DB_PATH);
      const classes =
        fallbackDb && Array.isArray(fallbackDb.culinary_classes) && fallbackDb.culinary_classes.length
          ? fallbackDb.culinary_classes
          : DEFAULT_CLASSES;
      const totalImages = classes.reduce((sum, c) => sum + Number(c.dataset_count || 50), 0);
      sendJson(res, 200, {
        total_classes: classes.length,
        total_dataset_images: totalImages || 600,
        classes,
      });
      return;
    }

    if (pathname === "/api/samples" && req.method === "GET") {
      const catalog = readJsonSafe(SAMPLE_CATALOG_PATH);
      if (!catalog) {
        sendJson(res, 200, { classes: DEFAULT_CLASSES, images: [], videos: [] });
        return;
      }
      sendJson(res, 200, catalog);
      return;
    }

    if (pathname === "/api/detect/image" && req.method === "POST") {
      const { fields, files, json } = await parseRequestPayload(req);
      const data = Object.keys(json).length ? json : fields;
      const uploadedFile = files.file || null;
      const result = runSimulatedImageDetection({
        sampleId: data.sample_id || "",
        filename: data.filename || (uploadedFile ? uploadedFile.filename : ""),
        enhancement: data.enhancement || "none",
        mode: data.mode || "counting",
        confThreshold: Number(data.conf ?? 0.25),
        regionPoints: parseJsonMaybe(data.region_points, null),
        params: parseJsonMaybe(data.params, {}),
      });
      sendJson(res, 200, result);
      return;
    }

    if (pathname === "/api/detect/video" && req.method === "POST") {
      const { fields, files, json } = await parseRequestPayload(req);
      const data = Object.keys(json).length ? json : fields;
      const uploadedFile = files.file || null;
      const result = runSimulatedVideoDetection({
        sampleId: data.sample_id || "",
        filename: data.filename || (uploadedFile ? uploadedFile.filename : ""),
        enhancement: data.enhancement || "none",
        mode: data.mode || "tracking",
        tracker: data.tracker || "bytetrack.yaml",
        confThreshold: Number(data.conf ?? 0.25),
        regionPoints: parseJsonMaybe(data.region_points, null),
      });
      sendJson(res, 200, result);
      return;
    }

    if (pathname === "/api/compare-enhancements" && req.method === "POST") {
      const { fields, files, json } = await parseRequestPayload(req);
      const data = Object.keys(json).length ? json : fields;
      const uploadedFile = files.file || null;
      const regionPoints = parseJsonMaybe(data.region_points, null);
      const confThreshold = Number(data.conf ?? 0.25);
      const params = parseJsonMaybe(data.params, {});

      const methods = ["none", "he", "clahe", "cs", "brightness"];
      const comparisons = [];
      let baselineConf = 0;
      let baselineDetected = 0;

      for (const methodKey of methods) {
        const resObj = runSimulatedImageDetection({
          sampleId: data.sample_id || "",
          filename: data.filename || (uploadedFile ? uploadedFile.filename : ""),
          enhancement: methodKey,
          mode: "counting",
          confThreshold,
          regionPoints,
          params,
        });
        if (methodKey === "none") {
          baselineConf = resObj.avg_confidence;
          baselineDetected = resObj.total_detected;
        }
        const confGain =
          methodKey !== "none" && baselineConf > 0
            ? Number((((resObj.avg_confidence - baselineConf) / baselineConf) * 100).toFixed(2))
            : 0;
        comparisons.push({
          method: methodKey,
          label: ENHANCEMENT_PROFILES[methodKey].label,
          total_detected: resObj.total_detected,
          inside_region_count: resObj.inside_region_count,
          outside_region_count: resObj.outside_region_count,
          avg_confidence: resObj.avg_confidence,
          conf_improvement_pct: confGain,
          inference_ms: resObj.inference_ms,
          image_metrics: resObj.image_metrics,
          class_counts: resObj.class_counts,
          detections: resObj.detections,
        });
      }

      const best = comparisons.reduce((bestSoFar, cur) =>
        cur.total_detected > bestSoFar.total_detected ||
        (cur.total_detected === bestSoFar.total_detected &&
          cur.avg_confidence > bestSoFar.avg_confidence)
          ? cur
          : bestSoFar
      );

      sendJson(res, 200, {
        model_name: "yolo11n.pt (node-local-simulator)",
        runtime: "node-local-fallback",
        baseline_detected: baselineDetected,
        baseline_confidence: baselineConf,
        best_method: best.method,
        best_label: best.label,
        comparisons,
      });
      return;
    }

    if (pathname === "/api/export/excel" && (req.method === "GET" || req.method === "POST")) {
      const format = (reqUrl.searchParams.get("format") || "xlsx").toLowerCase();
      let customRows = null;
      if (req.method === "POST") {
        const { json } = await parseRequestPayload(req);
        if (json && Array.isArray(json.comparisons)) {
          customRows = json.comparisons;
        }
      }
      const rows = getComparisonRows(customRows);

      if (format === "csv") {
        const csvBuf = generateCsvBuffer(rows);
        res.writeHead(200, {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="Laporan_Before_After_Enhancement.csv"',
          "Content-Length": csvBuf.length,
          "Access-Control-Allow-Origin": "*",
        });
        res.end(csvBuf);
        return;
      }

      if (!customRows && fs.existsSync(REPORT_XLSX_PATH)) {
        serveStaticFile(req, res, REPORT_XLSX_PATH, REPORTS_DIR);
        return;
      }

      const xlsxBuf = generateXlsxBuffer(rows);
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[".xlsx"],
        "Content-Disposition": 'attachment; filename="Laporan_Before_After_Enhancement.xlsx"',
        "Content-Length": xlsxBuf.length,
        "Access-Control-Allow-Origin": "*",
      });
      res.end(xlsxBuf);
      return;
    }

    // Static routes
    if (pathname === "/" || pathname === "/index.html") {
      if (serveStaticFile(req, res, path.join(FRONTEND_DIR, "index.html"), FRONTEND_DIR)) return;
    }
    if (pathname.startsWith("/frontend/")) {
      const rel = pathname.slice("/frontend/".length) || "index.html";
      if (serveStaticFile(req, res, path.join(FRONTEND_DIR, rel), FRONTEND_DIR)) return;
    }
    if (pathname.startsWith("/samples/")) {
      const rel = pathname.slice("/samples/".length);
      if (serveStaticFile(req, res, path.join(SAMPLES_DIR, rel), SAMPLES_DIR)) return;
    }
    if (pathname.startsWith("/reports/")) {
      const rel = pathname.slice("/reports/".length);
      if (serveStaticFile(req, res, path.join(REPORTS_DIR, rel), REPORTS_DIR)) return;
    }

    // Convenience fallback for root-relative frontend assets (styles.css, app.js, supabase-service.js)
    const rootAssetCandidate = path.join(FRONTEND_DIR, pathname.replace(/^\/+/, ""));
    if (serveStaticFile(req, res, rootAssetCandidate, FRONTEND_DIR)) return;

    sendError(res, 404, `Endpoint atau berkas '${pathname}' tidak ditemukan.`);
  } catch (err) {
    sendError(res, 500, err instanceof Error ? err.message : "Internal Server Error");
  }
}

const server = http.createServer(handleRequest);

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`[NusantaraVision] Node.js server berjalan di http://${HOST}:${PORT}`);
    console.log(`[NusantaraVision] Buka di browser: http://localhost:${PORT}/`);
  });
}

module.exports = { server, handleRequest, generateXlsxBuffer, generateCsvBuffer, pointInPolygon };
