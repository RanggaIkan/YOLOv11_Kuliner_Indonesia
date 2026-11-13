#!/usr/bin/env python3
"""NusantaraVision YOLOv11 — Synchronized Sample & Demo Video Generator (Python/OpenCV).

Reads real culinary hero photos & bounding boxes from
`samples/images/real_samples_manifest.json` (never overwrites `samples/images/`),
generates 960x540 photorealistic tracking simulation frames + MJPG .avi videos in
`samples/videos/`, and writes `samples/sample_catalog.json` aligned with the
frontend, Node.js server, and FastAPI backend contracts.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np

ROOT_DIR = Path(__file__).resolve().parent.parent
SAMPLES_DIR = ROOT_DIR / "samples"
IMAGES_DIR = SAMPLES_DIR / "images"
VIDEOS_DIR = SAMPLES_DIR / "videos"
FRAMES_DIR = VIDEOS_DIR / "frames"
MANIFEST_PATH = IMAGES_DIR / "real_samples_manifest.json"
CATALOG_PATH = SAMPLES_DIR / "sample_catalog.json"

VIDEO_W = 960
VIDEO_H = 540
VIDEO_FPS = 6
VIDEO_FRAMES = 16

CULINARY_CLASSES = [
    {"id": 0, "name": "Nasi Goreng", "slug": "nasi-goreng"},
    {"id": 1, "name": "Bakso", "slug": "bakso"},
    {"id": 2, "name": "Sate Ayam", "slug": "sate-ayam"},
    {"id": 3, "name": "Rendang", "slug": "rendang"},
    {"id": 4, "name": "Soto Ayam", "slug": "soto-ayam"},
    {"id": 5, "name": "Ayam Goreng", "slug": "ayam-goreng"},
    {"id": 6, "name": "Mie Goreng", "slug": "mie-goreng"},
    {"id": 7, "name": "Tempe Goreng", "slug": "tempe-goreng"},
    {"id": 8, "name": "Tahu Goreng", "slug": "tahu-goreng"},
    {"id": 9, "name": "Gado-Gado", "slug": "gado-gado"},
    {"id": 10, "name": "Pempek", "slug": "pempek"},
    {"id": 11, "name": "Telur Balado", "slug": "telur-balado"},
]

HERO_METADATA_BY_SLUG: Dict[str, Dict[str, Any]] = {
    "nasi_goreng": {
        "id": "nasgor_malam",
        "aliases": ["nasi_goreng", "nasi_goreng_real.jpg", "nasi_goreng_spesial"],
        "title": "Nasi Goreng Spesial — Pencahayaan Hangat",
        "description": "Foto nyata sepiring Nasi Goreng lengkap dengan irisan telur, ayam panggang, cabai, dan paprika untuk pengujian Counting & CLAHE.",
        "lighting_condition": "warm_saturated",
        "recommended_enhancement": "clahe",
        "roi_norm": [0.06, 0.08, 0.84, 0.78],
        "confidence": 0.94,
    },
    "bakso": {
        "id": "bakso_komplit",
        "aliases": ["bakso", "bakso_real.jpg", "bakso_komplit_pencahayaan_redup"],
        "title": "Bakso Sapi Komplit — Mangkuk Saji",
        "description": "Foto nyata semangkuk Bakso urat dengan mie kuning, sawi hijau, dan kuah kaldu bening untuk Region Counter meja saji.",
        "lighting_condition": "bright_table",
        "recommended_enhancement": "clahe",
        "roi_norm": [0.22, 0.16, 0.56, 0.68],
        "confidence": 0.93,
    },
    "sate_ayam": {
        "id": "sate_madura",
        "aliases": ["sate_ayam", "sate_ayam_real.jpg", "sate_ayam_madura"],
        "title": "Sate Ayam Madura — Bumbu Kacang",
        "description": "Foto nyata tusukan Sate Ayam panggang dengan bumbu kacang, irisan bawang merah, dan acar ketimun.",
        "lighting_condition": "indoor_warm",
        "recommended_enhancement": "cs",
        "roi_norm": [0.16, 0.10, 0.68, 0.74],
        "confidence": 0.92,
    },
    "rendang": {
        "id": "padang_rendang",
        "aliases": ["rendang", "rendang_real.jpg", "nasi_padang_rendang"],
        "title": "Rendang Daging Sapi Minang — Daun Pisang",
        "description": "Foto nyata sajian Rendang daging sapi berbumbu gelap pekat di atas daun pisang — kasus uji ideal untuk CLAHE L-channel.",
        "lighting_condition": "dark_rich_spice",
        "recommended_enhancement": "clahe",
        "roi_norm": [0.15, 0.12, 0.70, 0.76],
        "confidence": 0.95,
    },
    "soto_ayam": {
        "id": "soto_ayam",
        "aliases": ["soto_ayam_real.jpg", "pempek_soto_mie_goreng"],
        "title": "Soto Ayam Kuah Kuning — Lamongan",
        "description": "Foto nyata semangkuk Soto Ayam dengan suwiran ayam, telur rebus, tauge, jeruk nipis, dan bawang goreng.",
        "lighting_condition": "high_gloss_broth",
        "recommended_enhancement": "cs",
        "roi_norm": [0.20, 0.22, 0.62, 0.62],
        "confidence": 0.91,
    },
    "ayam_goreng": {
        "id": "ayam_goreng",
        "aliases": ["ayam_goreng_real.jpg"],
        "title": "Ayam Goreng Kremes Nusantara",
        "description": "Foto nyata potongan Ayam Goreng keemasan berbumbu ungkep rempah khas Indonesia.",
        "lighting_condition": "golden_contrast",
        "recommended_enhancement": "clahe",
        "roi_norm": [0.03, 0.16, 0.86, 0.78],
        "confidence": 0.93,
    },
    "mie_goreng": {
        "id": "mie_goreng",
        "aliases": ["mie_goreng_real.jpg"],
        "title": "Mie Goreng Jawa Komplit",
        "description": "Foto nyata sepiring Mie Goreng kecap lengkap dengan sayuran, tomat, dan irisan lauk.",
        "lighting_condition": "warm_indoor",
        "recommended_enhancement": "clahe",
        "roi_norm": [0.11, 0.11, 0.74, 0.75],
        "confidence": 0.91,
    },
    "tempe_goreng": {
        "id": "tempe_goreng",
        "aliases": ["tempe_goreng_real.jpg"],
        "title": "Tempe Goreng Renyah — Warteg",
        "description": "Foto nyata irisan Tempe Goreng keemasan untuk uji ketajaman tekstur kedelai dengan Brightness/Gamma & CLAHE.",
        "lighting_condition": "indoor_ambient",
        "recommended_enhancement": "brightness",
        "roi_norm": [0.15, 0.15, 0.72, 0.70],
        "confidence": 0.90,
    },
    "tahu_goreng": {
        "id": "tahu_goreng",
        "aliases": ["tahu_goreng_real.jpg"],
        "title": "Tahu Goreng Crispy Nusantara",
        "description": "Foto nyata potongan Tahu Goreng kecokelatan di atas piring saji.",
        "lighting_condition": "bright_table",
        "recommended_enhancement": "cs",
        "roi_norm": [0.09, 0.02, 0.84, 0.76],
        "confidence": 0.89,
    },
    "gado_gado": {
        "id": "gado_gado",
        "aliases": ["gado_gado_real.jpg", "gado_gado_tahu_tempe"],
        "title": "Gado-Gado Betawi — Bumbu Kacang",
        "description": "Foto nyata sepiring Gado-Gado dengan lontong, sayuran rebus, kerupuk, dan siraman bumbu kacang.",
        "lighting_condition": "balanced_daylight",
        "recommended_enhancement": "cs",
        "roi_norm": [0.13, 0.10, 0.75, 0.82],
        "confidence": 0.92,
    },
    "pempek": {
        "id": "pempek",
        "aliases": ["pempek_real.jpg"],
        "title": "Pempek Palembang — Kuah Cuko Hitam",
        "description": "Foto nyata sajian Pempek dengan irisan mentimun, mie, dan kuah cuko gelap yang menantang tanpa kontras lokal.",
        "lighting_condition": "dark_sauce",
        "recommended_enhancement": "clahe",
        "roi_norm": [0.14, 0.27, 0.71, 0.62],
        "confidence": 0.91,
    },
    "telur_balado": {
        "id": "telur_balado",
        "aliases": ["telur_balado_real.jpg"],
        "title": "Telur Balado Padang — Sambal Merah",
        "description": "Foto nyata Telur Balado berlumur sambal cabai merah khas rumah makan Padang.",
        "lighting_condition": "spicy_red_cast",
        "recommended_enhancement": "clahe",
        "roi_norm": [0.07, 0.11, 0.81, 0.78],
        "confidence": 0.92,
    },
    "prasmanan_kuliner": {
        "id": "prasmanan_kuliner",
        "aliases": ["prasmanan_kuliner_real.jpg", "prasmanan_nusantara"],
        "title": "Prasmanan Nasi Padang — Multi-Lauk (Inside & Outside ROI)",
        "description": "Foto nyata meja prasmanan Rumah Makan Padang dengan piring lauk beragam untuk demonstrasi Counting & Region Counter (Object Region #1).",
        "lighting_condition": "uneven_table_light",
        "recommended_enhancement": "clahe",
        "roi_norm": [0.22, 0.34, 0.42, 0.40],
        "confidence": 0.91,
        "multi_plates": [
            {"class_id": 5, "class_name": "Ayam Goreng", "bbox_xyxy": [102, 360, 314, 526], "confidence": 0.91},
            {"class_id": 5, "class_name": "Ayam Goreng", "bbox_xyxy": [286, 418, 504, 580], "confidence": 0.92},
            {"class_id": 3, "class_name": "Rendang", "bbox_xyxy": [508, 366, 706, 534], "confidence": 0.93},
            {"class_id": 11, "class_name": "Telur Balado", "bbox_xyxy": [6, 570, 240, 770], "confidence": 0.89},
        ],
    },
}

VIDEO_SCENES = [
    {
        "id": "prasmanan_tracking_demo",
        "filename": "prasmanan_tracking_demo.avi",
        "title": "Video Simulasi #1 — Meja Prasmanan & Tracking Lintas ROI (960x540)",
        "description": "Simulasi photorealistic 16 frame (960x540 @ 6 FPS) dengan potongan piring nyata Nasi Goreng, Bakso, dan Rendang melintasi Object Region #1.",
        "theme": "wood_buffet",
        "default_roi_norm": [0.30, 0.10, 0.42, 0.80],
        "tracks": [
            {
                "track_id": 1,
                "class_id": 0,
                "class_name": "Nasi Goreng",
                "source_file": "nasi_goreng_real.jpg",
                "src_crop": [110, 95, 980, 730],
                "draw_w": 204,
                "draw_h": 146,
                "x_start": 125,
                "x_end": 830,
                "y_base": 112,
                "y_amp": 10,
            },
            {
                "track_id": 2,
                "class_id": 1,
                "class_name": "Bakso",
                "source_file": "bakso_real.jpg",
                "src_crop": [255, 85, 780, 780],
                "draw_w": 158,
                "draw_h": 158,
                "x_start": 835,
                "x_end": 135,
                "y_base": 422,
                "y_amp": -10,
            },
            {
                "track_id": 3,
                "class_id": 3,
                "class_name": "Rendang",
                "source_file": "rendang_real.jpg",
                "src_crop": [170, 75, 945, 705],
                "draw_w": 212,
                "draw_h": 148,
                "x_start": 185,
                "x_end": 745,
                "y_start": 270,
                "y_end": 270,
                "y_amp": 8,
            },
        ],
    },
    {
        "id": "antrean_kantin_demo",
        "filename": "antrean_kantin_demo.avi",
        "title": "Video Simulasi #2 — Antrean Kasir Kantin Masuk ROI (960x540)",
        "description": "Simulasi photorealistic 16 frame (960x540 @ 6 FPS) nampan Sate Ayam, Gado-Gado, dan Telur Balado bergerak masuk ke zona kasir (Object Region #1).",
        "theme": "stone_kasir",
        "default_roi_norm": [0.47, 0.08, 0.44, 0.84],
        "tracks": [
            {
                "track_id": 1,
                "class_id": 2,
                "class_name": "Sate Ayam",
                "source_file": "sate_ayam_real.jpg",
                "src_crop": [170, 85, 815, 625],
                "draw_w": 198,
                "draw_h": 144,
                "x_start": 125,
                "x_end": 680,
                "y_base": 116,
                "y_amp": 8,
            },
            {
                "track_id": 2,
                "class_id": 9,
                "class_name": "Gado-Gado",
                "source_file": "gado_gado_real.jpg",
                "src_crop": [140, 50, 790, 540],
                "draw_w": 196,
                "draw_h": 144,
                "x_start": 165,
                "x_end": 735,
                "y_base": 426,
                "y_amp": -8,
            },
            {
                "track_id": 3,
                "class_id": 11,
                "class_name": "Telur Balado",
                "source_file": "telur_balado_real.jpg",
                "src_crop": [95, 110, 1020, 745],
                "draw_w": 184,
                "draw_h": 142,
                "x_start": 280,
                "x_end": 635,
                "y_start": 272,
                "y_end": 272,
                "y_amp": 10,
            },
        ],
    },
]


def _rect_norm_to_poly(norm: List[float], width: int, height: int) -> List[List[int]]:
    nx, ny, nw, nh = norm
    x1 = round(nx * width)
    y1 = round(ny * height)
    x2 = round((nx + nw) * width)
    y2 = round((ny + nh) * height)
    return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]


def _point_in_polygon(px: float, py: float, polygon: List[List[int]]) -> bool:
    poly = np.array(polygon, dtype=np.int32)
    return bool(cv2.pointPolygonTest(poly, (float(px), float(py)), False) >= 0)


def _make_table_backdrop(theme: str, roi_poly: List[List[int]]) -> np.ndarray:
    canvas = np.zeros((VIDEO_H, VIDEO_W, 3), dtype=np.uint8)
    y_grad = np.linspace(0.0, 1.0, VIDEO_H)[:, None]
    if theme == "wood_buffet":
        base_top = np.array([30, 46, 72], dtype=np.float32)  # BGR warm walnut
        base_bot = np.array([17, 27, 44], dtype=np.float32)
        bg = (base_top * (1.0 - y_grad) + base_bot * y_grad)[:, None, :]
        canvas[:, :, :] = np.broadcast_to(bg, canvas.shape).astype(np.uint8)
        for py in range(0, VIDEO_H, 68):
            cv2.line(canvas, (0, py), (VIDEO_W, py), (8, 13, 22), 2)
            cv2.line(canvas, (0, py + 2), (VIDEO_W, py + 2), (55, 86, 128), 1)
    else:
        base_top = np.array([66, 58, 52], dtype=np.float32)
        base_bot = np.array([44, 38, 34], dtype=np.float32)
        bg = (base_top * (1.0 - y_grad) + base_bot * y_grad)[:, None, :]
        canvas[:, :, :] = np.broadcast_to(bg, canvas.shape).astype(np.uint8)
        cv2.line(canvas, (0, 58), (VIDEO_W, 58), (150, 145, 140), 2)
        cv2.line(canvas, (0, VIDEO_H - 44), (VIDEO_W, VIDEO_H - 44), (150, 145, 140), 2)

    rx1, ry1 = roi_poly[0]
    rx2, ry2 = roi_poly[2]
    overlay = canvas.copy()
    cv2.rectangle(overlay, (rx1, ry1), (rx2, ry2), (210, 232, 245), -1)
    cv2.addWeighted(overlay, 0.13, canvas, 0.87, 0.0, canvas)
    cv2.rectangle(canvas, (rx1, ry1), (rx2, ry2), (160, 195, 215), 2)
    return canvas


def _paste_elliptical_plate(
    canvas: np.ndarray,
    src_bgr: np.ndarray,
    crop: List[int],
    cx: int,
    cy: int,
    draw_w: int,
    draw_h: int,
) -> Tuple[int, int, int, int]:
    sx, sy, sw, sh = crop
    h_img, w_img = src_bgr.shape[:2]
    sx2 = min(w_img, sx + sw)
    sy2 = min(h_img, sy + sh)
    patch = cv2.resize(src_bgr[sy:sy2, sx:sx2], (draw_w, draw_h), interpolation=cv2.INTER_AREA)

    x1 = max(0, cx - draw_w // 2)
    y1 = max(0, cy - draw_h // 2)
    x2 = min(VIDEO_W, x1 + draw_w)
    y2 = min(VIDEO_H, y1 + draw_h)
    pw, ph = x2 - x1, y2 - y1
    if pw <= 4 or ph <= 4:
        return [x1, y1, x2, y2]

    # Soft cast shadow
    shadow_layer = canvas.copy()
    cv2.ellipse(shadow_layer, (cx + 8, cy + 10), (draw_w // 2, draw_h // 2), 0, 0, 360, (8, 8, 10), -1)
    cv2.addWeighted(shadow_layer, 0.38, canvas, 0.62, 0.0, canvas)

    # Ceramic rim
    cv2.ellipse(canvas, (cx, cy), (draw_w // 2 + 3, draw_h // 2 + 3), 0, 0, 360, (228, 236, 240), -1, cv2.LINE_AA)

    # Elliptical food mask
    mask = np.zeros((draw_h, draw_w), dtype=np.float32)
    cv2.ellipse(mask, (draw_w // 2, draw_h // 2), (draw_w // 2 - 2, draw_h // 2 - 2), 0, 0, 360, 1.0, -1, cv2.LINE_AA)
    mask = cv2.GaussianBlur(mask, (5, 5), 1.2)[:ph, :pw, None]

    sub_patch = patch[:ph, :pw].astype(np.float32)
    sub_bg = canvas[y1:y2, x1:x2].astype(np.float32)
    canvas[y1:y2, x1:x2] = np.clip(sub_patch * mask + sub_bg * (1.0 - mask), 0, 255).astype(np.uint8)
    return [x1, y1, x2, y2]


def build_all() -> None:
    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(f"Manifest tidak ditemukan: {MANIFEST_PATH}")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    heroes = manifest.get("all_heroes", [])
    if len(heroes) != 13:
        raise RuntimeError(f"Diharapkan 13 foto hero di manifest, ditemukan {len(heroes)}")

    images_out: List[Dict[str, Any]] = []
    for hero in heroes:
        img_path = IMAGES_DIR / hero["sampleFile"]
        if not img_path.exists():
            raise FileNotFoundError(f"File hero hilang: {img_path}")
        meta = HERO_METADATA_BY_SLUG[hero["slug"]]
        width = int(hero["width"])
        height = int(hero["height"])
        roi_poly = _rect_norm_to_poly(meta["roi_norm"], width, height)

        if "multi_plates" in meta:
            ground_truth = []
            for plate in meta["multi_plates"]:
                x1, y1, x2, y2 = plate["bbox_xyxy"]
                cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
                ground_truth.append({
                    "class_id": plate["class_id"],
                    "class_name": plate["class_name"],
                    "bbox_xyxy": [x1, y1, x2, y2],
                    "bbox_yolo": [
                        round(cx / width, 6),
                        round(cy / height, 6),
                        round((x2 - x1) / width, 6),
                        round((y2 - y1) / height, 6),
                    ],
                    "confidence": plate["confidence"],
                    "confidence_gt": plate["confidence"],
                    "in_default_roi": _point_in_polygon(cx, cy, roi_poly),
                })
        else:
            x1, y1, x2, y2 = hero["bbox_xyxy"]
            cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
            ground_truth = [{
                "class_id": hero["classId"],
                "class_name": hero["name"],
                "bbox_xyxy": [x1, y1, x2, y2],
                "bbox_yolo": [round(float(v), 6) for v in hero["bbox_yolo"]],
                "confidence": meta["confidence"],
                "confidence_gt": meta["confidence"],
                "in_default_roi": _point_in_polygon(cx, cy, roi_poly),
            }]

        images_out.append({
            "id": meta["id"],
            "slug": hero["slug"],
            "aliases": meta["aliases"],
            "filename": hero["sampleFile"],
            "path": f"samples/images/{hero['sampleFile']}",
            "title": meta["title"],
            "description": meta["description"],
            "width": width,
            "height": height,
            "lighting_condition": meta["lighting_condition"],
            "recommended_enhancement": meta["recommended_enhancement"],
            "default_roi": roi_poly,
            "default_roi_norm": [round(float(v), 4) for v in meta["roi_norm"]],
            "ground_truth": ground_truth,
            "source": hero.get("source", ""),
            "license": hero.get("license", ""),
        })

    src_cache: Dict[str, np.ndarray] = {}
    videos_out: List[Dict[str, Any]] = []
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    for scene in VIDEO_SCENES:
        vdir = FRAMES_DIR / scene["id"]
        vdir.mkdir(parents=True, exist_ok=True)
        for stale in vdir.glob("frame_*.png"):
            stale.unlink()

        roi_poly = _rect_norm_to_poly(scene["default_roi_norm"], VIDEO_W, VIDEO_H)
        backdrop = _make_table_backdrop(scene["theme"], roi_poly)
        avi_path = VIDEOS_DIR / scene["filename"]
        writer = cv2.VideoWriter(str(avi_path), cv2.VideoWriter_fourcc(*"MJPG"), VIDEO_FPS, (VIDEO_W, VIDEO_H))

        inside_tracks = set()
        frame_annotations = []

        for f in range(VIDEO_FRAMES):
            t = f / (VIDEO_FRAMES - 1) if VIDEO_FRAMES > 1 else 0.0
            frame = backdrop.copy()
            objects = []
            for tr in scene["tracks"]:
                if tr["source_file"] not in src_cache:
                    src_cache[tr["source_file"]] = cv2.imread(str(IMAGES_DIR / tr["source_file"]))
                src_bgr = src_cache[tr["source_file"]]

                cx = round(tr["x_start"] + (tr["x_end"] - tr["x_start"]) * t)
                base_y = (
                    tr["y_start"] + (tr["y_end"] - tr["y_start"]) * t
                    if "y_start" in tr and "y_end" in tr
                    else tr["y_base"]
                )
                cy = round(base_y + math.sin(t * math.pi * 2 + tr["track_id"]) * tr["y_amp"])
                box = _paste_elliptical_plate(frame, src_bgr, tr["src_crop"], cx, cy, tr["draw_w"], tr["draw_h"])
                bx, by = (box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0
                in_roi = _point_in_polygon(bx, by, roi_poly)
                if in_roi:
                    inside_tracks.add(tr["track_id"])
                objects.append({
                    "track_id": tr["track_id"],
                    "class_id": tr["class_id"],
                    "class_name": tr["class_name"],
                    "bbox_xyxy": box,
                    "in_roi": in_roi,
                    "confidence": round(0.88 + ((f + tr["track_id"]) % 5) * 0.015, 2),
                })

            fname = f"frame_{f + 1:03d}.png"
            cv2.imwrite(str(vdir / fname), frame)
            writer.write(frame)
            frame_annotations.append({
                "frame_index": f,
                "frame_file": f"samples/videos/frames/{scene['id']}/{fname}",
                "objects": objects,
            })

        writer.release()
        videos_out.append({
            "id": scene["id"],
            "filename": scene["filename"],
            "path": f"samples/videos/{scene['filename']}",
            "frames_dir": f"samples/videos/frames/{scene['id']}",
            "format": "MJPG AVI + PNG Frame Sequence (960x540)",
            "title": scene["title"],
            "description": scene["description"],
            "width": VIDEO_W,
            "height": VIDEO_H,
            "fps": VIDEO_FPS,
            "total_frames": VIDEO_FRAMES,
            "frame_count": VIDEO_FRAMES,
            "default_roi": roi_poly,
            "default_roi_norm": [round(float(v), 4) for v in scene["default_roi_norm"]],
            "expected_tracks": [
                {
                    "track_id": tr["track_id"],
                    "class_id": tr["class_id"],
                    "class_name": tr["class_name"],
                    "enters_roi": tr["track_id"] in inside_tracks,
                }
                for tr in scene["tracks"]
            ],
            "frame_annotations": frame_annotations,
        })

    stats = manifest.get("stats", {})
    per_br = stats.get("perClassBreakdown", {})
    catalog = {
        "project": "NusantaraVision YOLOv11 — Sistem Deteksi, Counting, Tracking & Image Enhancement Kuliner Indonesia",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generator": "scripts/prepare_samples.py",
        "total_classes": len(CULINARY_CLASSES),
        "dataset_stats": {
            "total": stats.get("total", 600),
            "train": stats.get("train", 420),
            "train_originals": stats.get("trainOriginals", 314),
            "train_augmented": stats.get("trainAugmented", 106),
            "valid": stats.get("valid", 120),
            "test": stats.get("test", 60),
            "unique_originals": stats.get("uniqueOriginals", 494),
        },
        "classes": [
            {
                **c,
                "dataset_count": per_br.get(c["name"], {}).get("total", 50),
                "unique_originals": per_br.get(c["name"], {}).get("uniqueOriginals", 50),
                "train_originals": per_br.get(c["name"], {}).get("trainOriginals", 35),
                "train_augmented": per_br.get(c["name"], {}).get("trainAugmented", 0),
                "train_count": per_br.get(c["name"], {}).get("trainTotal", 35),
                "valid_count": per_br.get(c["name"], {}).get("validTotal", 10),
                "test_count": per_br.get(c["name"], {}).get("testTotal", 5),
            }
            for c in CULINARY_CLASSES
        ],
        "images": images_out,
        "videos": videos_out,
    }
    CATALOG_PATH.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"[prepare_samples.py] Synced {len(images_out)} hero images, generated {len(videos_out)} 960x540 videos.")


if __name__ == "__main__":
    build_all()
