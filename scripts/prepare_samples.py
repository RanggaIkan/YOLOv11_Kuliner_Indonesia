"""
Python generator for Indonesian culinary sample images, tracking videos (AVI + PNG frames),
and samples/sample_catalog.json. Uses OpenCV + NumPy so it works seamlessly in Google Colab
or any local Python environment with opencv-python installed.

Usage:
    python scripts/prepare_samples.py
"""

from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

ROOT_DIR = Path(__file__).resolve().parent.parent
IMAGES_DIR = ROOT_DIR / "samples" / "images"
VIDEOS_DIR = ROOT_DIR / "samples" / "videos"
FRAMES_DIR = VIDEOS_DIR / "frames"
CATALOG_PATH = ROOT_DIR / "samples" / "sample_catalog.json"

CULINARY_CLASSES = [
    {"id": 0, "name": "Nasi Goreng", "slug": "nasi-goreng", "color": "#E67E22", "category": "Makanan Pokok", "region_origin": "Nusantara"},
    {"id": 1, "name": "Bakso", "slug": "bakso", "color": "#7F8C8D", "category": "Berkuah", "region_origin": "Jawa Tengah / Jawa Timur"},
    {"id": 2, "name": "Sate Ayam", "slug": "sate-ayam", "color": "#D35400", "category": "Panggang", "region_origin": "Madura, Jawa Timur"},
    {"id": 3, "name": "Rendang", "slug": "rendang", "color": "#6E2C00", "category": "Lauk Utama", "region_origin": "Minangkabau, Sumatera Barat"},
    {"id": 4, "name": "Soto Ayam", "slug": "soto-ayam", "color": "#F1C40F", "category": "Berkuah", "region_origin": "Lamongan / Jawa"},
    {"id": 5, "name": "Ayam Goreng", "slug": "ayam-goreng", "color": "#CA6F1E", "category": "Lauk Utama", "region_origin": "Nusantara"},
    {"id": 6, "name": "Mie Goreng", "slug": "mie-goreng", "color": "#F39C12", "category": "Makanan Pokok", "region_origin": "Jawa / Nusantara"},
    {"id": 7, "name": "Tempe Goreng", "slug": "tempe-goreng", "color": "#B7950B", "category": "Lauk Pendamping", "region_origin": "Jawa"},
    {"id": 8, "name": "Tahu Goreng", "slug": "tahu-goreng", "color": "#F5B041", "category": "Lauk Pendamping", "region_origin": "Jawa"},
    {"id": 9, "name": "Gado-Gado", "slug": "gado-gado", "color": "#27AE60", "category": "Sayuran", "region_origin": "Betawi, DKI Jakarta"},
    {"id": 10, "name": "Pempek", "slug": "pempek", "color": "#D4AC0D", "category": "Kudapan", "region_origin": "Palembang, Sumatera Selatan"},
    {"id": 11, "name": "Telur Balado", "slug": "telur-balado", "color": "#C0392B", "category": "Lauk Pendamping", "region_origin": "Minangkabau, Sumatera Barat"},
]

CLASS_BY_NAME = {c["name"]: c for c in CULINARY_CLASSES}


def _bgr(rgb: tuple[int, int, int]) -> tuple[int, int, int]:
    return (rgb[2], rgb[1], rgb[0])


def _point_in_polygon(x: float, y: float, poly: list[list[int]]) -> bool:
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi):
            inside = not inside
        j = i
    return inside


def _to_yolo_norm(box: list[int], width: int, height: int) -> list[float]:
    x1, y1, x2, y2 = box
    return [
        round((x1 + x2) / (2 * width), 6),
        round((y1 + y2) / (2 * height), 6),
        round((x2 - x1) / width, 6),
        round((y2 - y1) / height, 6),
    ]


def _clamp_box(x1: float, y1: float, x2: float, y2: float, w: int, h: int) -> list[int]:
    return [
        max(0, int(round(x1))),
        max(0, int(round(y1))),
        min(w, int(round(x2))),
        min(h, int(round(y2))),
    ]


def create_wooden_table(width: int, height: int, seed: int = 101, lighting: str = "normal") -> np.ndarray:
    rng = np.random.default_rng(seed)
    y_idx, x_idx = np.mgrid[0:height, 0:width]
    plank = (y_idx // 64)
    plank_off = ((plank % 3) - 1) * 7
    seam = np.where((y_idx % 64) < 2, -24, 0)
    grain = np.sin(x_idx * 0.03 + y_idx * 0.14 + plank * 2.1) * 8 + np.sin(x_idx * 0.09 - plank) * 4
    noise = rng.uniform(-3, 3, size=(height, width))

    r = np.clip(110 + plank_off + seam + grain + noise, 15, 235)
    g = np.clip(74 + plank_off * 0.7 + seam + grain * 0.75 + noise * 0.7, 12, 220)
    b = np.clip(46 + plank_off * 0.5 + seam + grain * 0.5 + noise * 0.5, 10, 200)
    img = np.stack([b, g, r], axis=-1).astype(np.float32)

    # Woven mat in center
    x0, x1 = int(width * 0.06), int(width * 0.94)
    y0, y1 = int(height * 0.08), int(height * 0.92)
    weave = (((x_idx[y0:y1, x0:x1] // 6) + (y_idx[y0:y1, x0:x1] // 6)) % 2 == 0).astype(np.float32) * 18 - 8
    mat = np.stack([92 + weave, 136 + weave, 168 + weave], axis=-1)
    img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * 0.64 + mat * 0.36

    if lighting == "low_light":
        img = np.clip(img * 0.62 - 18, 0, 255)
        img = 255 * ((img / 255.0) ** 1.15)
    elif lighting == "uneven_shadow":
        t = (x_idx / width) * 0.55 + (y_idx / height) * 0.45
        factor = (0.58 + 0.42 * (1.0 - t))[..., None]
        img = img * factor
    elif lighting == "hazy_fluorescent":
        img = np.clip(img * 0.78 + 22, 0, 255)

    return np.clip(img, 0, 255).astype(np.uint8)


def draw_plate(img: np.ndarray, cx: int, cy: int, rx: int, ry: int) -> None:
    overlay = img.copy()
    cv2.ellipse(overlay, (cx + 6, cy + 8), (int(rx * 1.03), int(ry * 1.03)), 0, 0, 360, (10, 14, 20), -1)
    cv2.addWeighted(overlay, 0.35, img, 0.65, 0, img)
    cv2.ellipse(img, (cx, cy), (rx, ry), 0, 0, 360, _bgr((238, 234, 224)), -1, cv2.LINE_AA)
    cv2.ellipse(img, (cx, cy), (int(rx * 0.88), int(ry * 0.88)), 0, 0, 360, _bgr((212, 206, 195)), 2, cv2.LINE_AA)
    cv2.ellipse(img, (cx, cy), (int(rx * 0.83), int(ry * 0.83)), 0, 0, 360, _bgr((248, 246, 240)), -1, cv2.LINE_AA)


def draw_banana_leaf(img: np.ndarray, cx: int, cy: int, rx: int, ry: int) -> None:
    cv2.ellipse(img, (cx, cy), (rx, ry), 0, 0, 360, _bgr((52, 126, 48)), -1, cv2.LINE_AA)
    cv2.line(img, (cx - rx + 10, cy), (cx + rx - 10, cy), _bgr((78, 152, 68)), 3, cv2.LINE_AA)


def paint_dish(img: np.ndarray, class_name: str, cx: int, cy: int, scale: float = 1.0, seed: int = 1) -> list[int]:
    rng = np.random.default_rng(seed)
    h, w = img.shape[:2]

    if class_name == "Nasi Goreng":
        rx, ry = int(74 * scale), int(56 * scale)
        cv2.ellipse(img, (cx, cy), (rx, ry), 0, 0, 360, _bgr((186, 118, 52)), -1, cv2.LINE_AA)
        for _ in range(int(180 * scale)):
            ang = rng.uniform(0, 2 * math.pi)
            rad = math.sqrt(rng.uniform(0, 1))
            gx = int(cx + math.cos(ang) * rx * 0.84 * rad)
            gy = int(cy + math.sin(ang) * ry * 0.82 * rad)
            col = _bgr((142, 62, 24)) if rng.random() < 0.25 else _bgr((216, 148, 72)) if rng.random() < 0.7 else _bgr((68, 138, 48))
            cv2.circle(img, (gx, gy), max(2, int(3 * scale)), col, -1)
        cv2.ellipse(img, (int(cx - 40 * scale), int(cy - 14 * scale)), (int(15 * scale), int(11 * scale)), 0, 0, 360, _bgr((238, 224, 196)), -1)
        cv2.ellipse(img, (int(cx + 40 * scale), int(cy + 14 * scale)), (int(11 * scale), int(8 * scale)), 0, 0, 360, _bgr((94, 178, 72)), -1)
        return _clamp_box(cx - rx, cy - ry, cx + rx, cy + ry, w, h)

    if class_name == "Bakso":
        r = int(68 * scale)
        cv2.ellipse(img, (cx, cy), (r, int(r * 0.9)), 0, 0, 360, _bgr((232, 232, 228)), -1, cv2.LINE_AA)
        cv2.ellipse(img, (cx, cy), (int(r * 0.86), int(r * 0.76)), 0, 0, 360, _bgr((196, 164, 96)), -1, cv2.LINE_AA)
        for bx, by, br in [(-22, -12, 16), (16, -15, 15), (-4, 8, 18), (24, 10, 14), (-25, 14, 13)]:
            cv2.circle(img, (int(cx + bx * scale), int(cy + by * scale)), max(3, int(br * scale)), _bgr((148, 134, 122)), -1, cv2.LINE_AA)
        for _ in range(16):
            cv2.circle(img, (int(cx + rng.uniform(-0.5, 0.5) * r), int(cy + rng.uniform(-0.4, 0.4) * r)), max(1, int(2.5 * scale)), _bgr((54, 156, 58)), -1)
        return _clamp_box(cx - r * 0.9, cy - r * 0.82, cx + r * 0.9, cy + r * 0.82, w, h)

    if class_name == "Sate Ayam":
        cv2.ellipse(img, (int(cx + 8 * scale), int(cy + 12 * scale)), (int(62 * scale), int(38 * scale)), 0, 0, 360, _bgr((138, 86, 36)), -1)
        for s in range(-2, 3):
            oy = int(s * 13 * scale)
            ox = int(s * 6 * scale)
            cv2.line(img, (int(cx - 62 * scale + ox), int(cy + oy - 16 * scale)), (int(cx + 62 * scale + ox), int(cy + oy + 12 * scale)), _bgr((214, 186, 134)), max(1, int(2 * scale)))
            for m in range(-2, 2):
                mx = int(cx + ox + m * 19 * scale)
                my = int(cy + oy + m * 4.5 * scale)
                cv2.ellipse(img, (mx, my), (max(3, int(9 * scale)), max(2, int(7 * scale))), 0, 0, 360, _bgr((148, 80, 30)), -1)
        return _clamp_box(cx - 72 * scale, cy - 48 * scale, cx + 72 * scale, cy + 48 * scale, w, h)

    if class_name == "Rendang":
        cv2.ellipse(img, (cx, int(cy + 4 * scale)), (int(52 * scale), int(38 * scale)), 0, 0, 360, _bgr((94, 42, 16)), -1)
        for dx, dy, rx, ry in [(-16, -8, 22, 17), (14, -6, 20, 16), (-4, 12, 24, 18), (20, 12, 16, 13)]:
            cv2.ellipse(img, (int(cx + dx * scale), int(cy + dy * scale)), (max(4, int(rx * scale)), max(3, int(ry * scale))), 0, 0, 360, _bgr((72, 30, 12)), -1)
        return _clamp_box(cx - 54 * scale, cy - 38 * scale, cx + 54 * scale, cy + 40 * scale, w, h)

    if class_name == "Soto Ayam":
        r = int(64 * scale)
        cv2.ellipse(img, (cx, cy), (r, int(r * 0.88)), 0, 0, 360, _bgr((238, 238, 234)), -1)
        cv2.ellipse(img, (cx, cy), (int(r * 0.86), int(r * 0.75)), 0, 0, 360, _bgr((226, 188, 52)), -1)
        cv2.ellipse(img, (int(cx - 18 * scale), int(cy - 8 * scale)), (max(4, int(13 * scale)), max(3, int(10 * scale))), 0, 0, 360, _bgr((250, 248, 238)), -1)
        cv2.circle(img, (int(cx - 18 * scale), int(cy - 8 * scale)), max(2, int(6 * scale)), _bgr((242, 172, 28)), -1)
        cv2.circle(img, (int(cx + 20 * scale), int(cy + 10 * scale)), max(3, int(10 * scale)), _bgr((76, 168, 54)), -1)
        return _clamp_box(cx - r * 0.88, cy - r * 0.78, cx + r * 0.88, cy + r * 0.78, w, h)

    if class_name == "Ayam Goreng":
        cv2.rectangle(img, (int(cx - 42 * scale), int(cy - 6 * scale)), (int(cx + 4 * scale), int(cy + 8 * scale)), _bgr((228, 198, 148)), -1)
        cv2.ellipse(img, (int(cx + 8 * scale), int(cy - 2 * scale)), (int(34 * scale), int(24 * scale)), 0, 0, 360, _bgr((192, 112, 34)), -1)
        return _clamp_box(cx - 48 * scale, cy - 30 * scale, cx + 46 * scale, cy + 28 * scale, w, h)

    if class_name == "Mie Goreng":
        rx, ry = int(68 * scale), int(48 * scale)
        cv2.ellipse(img, (cx, cy), (rx, ry), 0, 0, 360, _bgr((198, 134, 48)), -1)
        for _ in range(60):
            x1 = int(cx + rng.uniform(-0.6, 0.6) * rx)
            y1 = int(cy + rng.uniform(-0.6, 0.6) * ry)
            x2 = int(x1 + rng.uniform(-18, 18) * scale)
            y2 = int(y1 + rng.uniform(-14, 14) * scale)
            cv2.line(img, (x1, y1), (x2, y2), _bgr((232, 168, 56)), max(1, int(2.5 * scale)))
        cv2.ellipse(img, (int(cx - 22 * scale), int(cy + 10 * scale)), (max(3, int(11 * scale)), max(2, int(7 * scale))), 0, 0, 360, _bgr((64, 152, 56)), -1)
        return _clamp_box(cx - rx, cy - ry, cx + rx, cy + ry, w, h)

    if class_name == "Tempe Goreng":
        for dx, dy in [(-14, -8), (14, 8)]:
            x0, y0 = int(cx + dx * scale - 22 * scale), int(cy + dy * scale - 13 * scale)
            x1, y1 = int(cx + dx * scale + 22 * scale), int(cy + dy * scale + 13 * scale)
            cv2.rectangle(img, (x0, y0), (x1, y1), _bgr((188, 128, 42)), -1)
        return _clamp_box(cx - 44 * scale, cy - 30 * scale, cx + 44 * scale, cy + 30 * scale, w, h)

    if class_name == "Tahu Goreng":
        for dx, dy in [(-14, -7), (14, 7)]:
            x0, y0 = int(cx + dx * scale - 18 * scale), int(cy + dy * scale - 15 * scale)
            x1, y1 = int(cx + dx * scale + 18 * scale), int(cy + dy * scale + 15 * scale)
            cv2.rectangle(img, (x0, y0), (x1, y1), _bgr((224, 158, 54)), -1)
            cv2.rectangle(img, (x0 + 4, y0 + 4), (x1 - 4, y1 - 4), _bgr((246, 204, 118)), -1)
        return _clamp_box(cx - 40 * scale, cy - 30 * scale, cx + 40 * scale, cy + 30 * scale, w, h)

    if class_name == "Gado-Gado":
        rx, ry = int(74 * scale), int(56 * scale)
        cv2.ellipse(img, (cx, cy), (rx, ry), 0, 0, 360, _bgr((62, 146, 56)), -1)
        cv2.ellipse(img, (cx, int(cy + 4 * scale)), (int(40 * scale), int(28 * scale)), 0, 0, 360, _bgr((158, 96, 42)), -1)
        cv2.ellipse(img, (int(cx - 34 * scale), int(cy - 18 * scale)), (int(17 * scale), int(12 * scale)), 0, 0, 360, _bgr((242, 182, 162)), -1)
        return _clamp_box(cx - rx, cy - ry, cx + rx, cy + ry, w, h)

    if class_name == "Pempek":
        cv2.ellipse(img, (int(cx + 30 * scale), int(cy + 12 * scale)), (int(19 * scale), int(15 * scale)), 0, 0, 360, _bgr((42, 22, 12)), -1)
        cv2.ellipse(img, (int(cx - 12 * scale), int(cy - 6 * scale)), (int(32 * scale), int(20 * scale)), 0, 0, 360, _bgr((228, 194, 126)), -1)
        cv2.rectangle(img, (int(cx - 36 * scale), int(cy + 12 * scale)), (int(cx + 10 * scale), int(cy + 28 * scale)), _bgr((218, 182, 112)), -1)
        return _clamp_box(cx - 48 * scale, cy - 30 * scale, cx + 54 * scale, cy + 34 * scale, w, h)

    # Telur Balado
    cv2.ellipse(img, (cx, int(cy + 4 * scale)), (int(34 * scale), int(26 * scale)), 0, 0, 360, _bgr((186, 36, 24)), -1)
    cv2.ellipse(img, (cx, cy), (int(24 * scale), int(18 * scale)), 0, 0, 360, _bgr((214, 58, 36)), -1)
    return _clamp_box(cx - 36 * scale, cy - 26 * scale, cx + 36 * scale, cy + 30 * scale, w, h)


def make_gt_item(class_name: str, box: list[int], width: int, height: int, roi: list[list[int]], conf: float = 0.92) -> dict:
    cls = CLASS_BY_NAME[class_name]
    cx = (box[0] + box[2]) / 2.0
    cy = (box[1] + box[3]) / 2.0
    return {
        "class_id": cls["id"],
        "class_name": cls["name"],
        "bbox_xyxy": box,
        "bbox_yolo": _to_yolo_norm(box, width, height),
        "confidence_gt": conf,
        "in_default_roi": _point_in_polygon(cx, cy, roi),
    }


def generate_images() -> list[dict]:
    W, H = 640, 480
    specs = [
        {
            "id": "nasi_goreng_spesial",
            "filename": "nasi_goreng_spesial.png",
            "title": "Nasi Goreng Spesial Komplit",
            "description": "Piring nasi goreng dengan telur balado, ayam goreng, dan tempe goreng dalam pencahayaan redup warung malam.",
            "lighting_condition": "low_light",
            "recommended_enhancement": "clahe",
            "seed": 101,
            "default_roi": [[110, 80], [530, 80], [530, 410], [110, 410]],
            "items": [
                ("plate", 320, 245, 225, 168),
                ("leaf", 320, 250, 195, 140),
                ("dish", "Nasi Goreng", 285, 255, 1.35, 0.95),
                ("dish", "Telur Balado", 405, 195, 1.05, 0.91),
                ("dish", "Ayam Goreng", 415, 295, 1.0, 0.93),
                ("dish", "Tempe Goreng", 195, 175, 0.95, 0.89),
            ],
        },
        {
            "id": "bakso_komplit",
            "filename": "bakso_komplit.png",
            "title": "Bakso Komplit & Tahu Goreng",
            "description": "Mangkuk bakso urat dengan pendamping tahu goreng dan mie goreng dalam pencahayaan bayangan tidak merata.",
            "lighting_condition": "uneven_shadow",
            "recommended_enhancement": "he",
            "seed": 202,
            "default_roi": [[70, 70], [390, 70], [390, 415], [70, 415]],
            "items": [
                ("dish", "Bakso", 225, 245, 1.45, 0.96),
                ("plate", 485, 165, 112, 84),
                ("dish", "Tahu Goreng", 485, 165, 1.05, 0.90),
                ("plate", 485, 340, 118, 86),
                ("dish", "Mie Goreng", 485, 340, 1.05, 0.92),
            ],
        },
        {
            "id": "sate_ayam_madura",
            "filename": "sate_ayam_madura.png",
            "title": "Sate Ayam Madura & Soto Ayam",
            "description": "Seporsi sate ayam bumbu kacang bersama semangkuk soto ayam dan tahu goreng di meja kantin.",
            "lighting_condition": "hazy_fluorescent",
            "recommended_enhancement": "cs",
            "seed": 303,
            "default_roi": [[60, 110], [375, 110], [375, 390], [60, 390]],
            "items": [
                ("plate", 225, 250, 170, 128),
                ("leaf", 225, 252, 145, 102),
                ("dish", "Sate Ayam", 225, 250, 1.45, 0.96),
                ("dish", "Soto Ayam", 495, 185, 1.15, 0.93),
                ("plate", 495, 355, 96, 72),
                ("dish", "Tahu Goreng", 495, 355, 0.95, 0.88),
            ],
        },
        {
            "id": "nasi_padang_rendang",
            "filename": "nasi_padang_rendang.png",
            "title": "Nasi Padang Rendang & Lauk Komplit",
            "description": "Sajian hidangan Padang berisi rendang daging, telur balado, ayam goreng, dan tempe goreng.",
            "lighting_condition": "low_light",
            "recommended_enhancement": "brightness",
            "seed": 404,
            "default_roi": [[120, 75], [520, 75], [520, 405], [120, 405]],
            "items": [
                ("plate", 320, 240, 232, 174),
                ("leaf", 320, 245, 200, 146),
                ("dish", "Rendang", 235, 195, 1.2, 0.95),
                ("dish", "Telur Balado", 395, 185, 1.1, 0.94),
                ("dish", "Ayam Goreng", 255, 315, 1.1, 0.92),
                ("dish", "Tempe Goreng", 410, 315, 1.0, 0.90),
            ],
        },
        {
            "id": "prasmanan_kuliner_nusantara",
            "filename": "prasmanan_kuliner_nusantara.png",
            "title": "Prasmanan Kuliner Nusantara (12 Kelas)",
            "description": "Meja prasmanan besar menampilkan representasi seluruh 12 kelas kuliner Indonesia untuk pengujian counting dan Region ROI.",
            "lighting_condition": "uneven_shadow",
            "recommended_enhancement": "clahe",
            "seed": 505,
            "default_roi": [[140, 110], [500, 110], [500, 370], [140, 370]],
            "items": [
                ("plate", 95, 92, 66, 52), ("dish", "Nasi Goreng", 95, 92, 0.78, 0.91),
                ("dish", "Bakso", 245, 92, 0.78, 0.91),
                ("plate", 395, 92, 66, 52), ("dish", "Sate Ayam", 395, 92, 0.78, 0.91),
                ("plate", 545, 92, 66, 52), ("dish", "Rendang", 545, 92, 0.88, 0.91),
                ("dish", "Soto Ayam", 95, 240, 0.80, 0.91),
                ("plate", 245, 240, 66, 52), ("dish", "Ayam Goreng", 245, 240, 0.88, 0.91),
                ("plate", 395, 240, 66, 52), ("dish", "Mie Goreng", 395, 240, 0.78, 0.91),
                ("plate", 545, 240, 66, 52), ("dish", "Tempe Goreng", 545, 240, 0.88, 0.91),
                ("plate", 95, 388, 66, 52), ("dish", "Tahu Goreng", 95, 388, 0.92, 0.91),
                ("plate", 245, 388, 66, 52), ("dish", "Gado-Gado", 245, 388, 0.76, 0.91),
                ("plate", 395, 388, 66, 52), ("dish", "Pempek", 395, 388, 0.88, 0.91),
                ("plate", 545, 388, 66, 52), ("dish", "Telur Balado", 545, 388, 0.95, 0.91),
            ],
        },
        {
            "id": "gado_gado_tahu_tempe",
            "filename": "gado_gado_tahu_tempe.png",
            "title": "Gado-Gado, Pempek & Tahu Tempe",
            "description": "Hidangan gado-gado Betawi lengkap dengan tempe goreng, tahu goreng, dan pempek kapal selam.",
            "lighting_condition": "normal",
            "recommended_enhancement": "clahe",
            "seed": 606,
            "default_roi": [[80, 90], [380, 90], [380, 400], [80, 400]],
            "items": [
                ("plate", 225, 245, 164, 126),
                ("dish", "Gado-Gado", 225, 245, 1.32, 0.95),
                ("plate", 488, 130, 102, 76),
                ("dish", "Tempe Goreng", 488, 130, 1.0, 0.91),
                ("plate", 488, 255, 96, 72),
                ("dish", "Tahu Goreng", 488, 255, 0.98, 0.90),
                ("plate", 488, 380, 108, 78),
                ("dish", "Pempek", 488, 380, 1.02, 0.92),
            ],
        },
    ]

    results = []
    for idx, spec in enumerate(specs):
        img = create_wooden_table(W, H, seed=spec["seed"], lighting=spec["lighting_condition"])
        gt = []
        for item in spec["items"]:
            kind = item[0]
            if kind == "plate":
                draw_plate(img, item[1], item[2], item[3], item[4])
            elif kind == "leaf":
                draw_banana_leaf(img, item[1], item[2], item[3], item[4])
            elif kind == "dish":
                _, cls_name, cx, cy, scale, conf = item
                box = paint_dish(img, cls_name, cx, cy, scale=scale, seed=spec["seed"] + idx + len(gt))
                gt.append(make_gt_item(cls_name, box, W, H, spec["default_roi"], conf))

        cv2.imwrite(str(IMAGES_DIR / spec["filename"]), img)
        results.append({
            "id": spec["id"],
            "filename": spec["filename"],
            "path": f"samples/images/{spec['filename']}",
            "title": spec["title"],
            "description": spec["description"],
            "width": W,
            "height": H,
            "lighting_condition": spec["lighting_condition"],
            "recommended_enhancement": spec["recommended_enhancement"],
            "default_roi": spec["default_roi"],
            "default_roi_norm": [[round(x / W, 4), round(y / H, 4)] for x, y in spec["default_roi"]],
            "ground_truth": gt,
        })
    return results


def generate_videos() -> list[dict]:
    W, H, FPS, FRAME_COUNT = 320, 240, 6, 16
    configs = [
        {
            "id": "prasmanan_tracking_demo",
            "filename": "prasmanan_tracking_demo.avi",
            "title": "Demo Tracking Nampan Prasmanan (ByteTrack & Region Counter)",
            "description": "Simulasi video 16 frame piring kuliner bergerak melintasi zona ROI meja kasir untuk pengujian ByteTrack dan Region Counter.",
            "default_roi": [[105, 35], [225, 35], [225, 205], [105, 205]],
            "tracks": [
                {"track_id": 1, "class_name": "Nasi Goreng", "xStart": 42, "xEnd": 278, "yBase": 68, "scale": 0.56, "plate": True},
                {"track_id": 2, "class_name": "Bakso", "xStart": 270, "xEnd": 46, "yBase": 145, "scale": 0.58, "plate": False},
                {"track_id": 3, "class_name": "Rendang", "xStart": 165, "xEnd": 165, "yBase": 192, "scale": 0.56, "plate": True},
            ],
        },
        {
            "id": "antrean_kantin_demo",
            "filename": "antrean_kantin_demo.avi",
            "title": "Demo Antrean Kasir Kantin Nusantara",
            "description": "Simulasi video 16 frame menu Sate Ayam, Gado-Gado, dan Telur Balado bergerak masuk ke Region Counter kasir.",
            "default_roi": [[135, 30], [295, 30], [295, 210], [135, 210]],
            "tracks": [
                {"track_id": 1, "class_name": "Sate Ayam", "xStart": 36, "xEnd": 255, "yBase": 72, "scale": 0.54, "plate": True},
                {"track_id": 2, "class_name": "Gado-Gado", "xStart": 48, "xEnd": 245, "yBase": 168, "scale": 0.54, "plate": True},
                {"track_id": 3, "class_name": "Telur Balado", "xStart": 220, "xEnd": 220, "yBase": 118, "scale": 0.62, "plate": True},
            ],
        },
    ]

    results = []
    for cfg in configs:
        vdir = FRAMES_DIR / cfg["id"]
        vdir.mkdir(parents=True, exist_ok=True)
        out_path = VIDEOS_DIR / cfg["filename"]
        writer = cv2.VideoWriter(str(out_path), cv2.VideoWriter_fourcc(*"MJPG"), FPS, (W, H))

        frame_annotations = []
        inside_tracks = set()

        for f in range(FRAME_COUNT):
            t = f / (FRAME_COUNT - 1)
            frame = create_wooden_table(W, H, seed=900 + f, lighting="normal")
            detections = []
            for tr in cfg["tracks"]:
                cx = int(round(tr["xStart"] + (tr["xEnd"] - tr["xStart"]) * t))
                cy = int(round(tr["yBase"] + math.sin(t * math.pi * 2 + tr["track_id"]) * 6))
                if tr["plate"]:
                    draw_plate(frame, cx, cy, int(48 * tr["scale"] * 1.35), int(36 * tr["scale"] * 1.35))
                box = paint_dish(frame, tr["class_name"], cx, cy, scale=tr["scale"], seed=70 + tr["track_id"])
                bx, by = (box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0
                in_roi = _point_in_polygon(bx, by, cfg["default_roi"])
                if in_roi:
                    inside_tracks.add(tr["track_id"])
                cls = CLASS_BY_NAME[tr["class_name"]]
                detections.append({
                    "track_id": tr["track_id"],
                    "class_id": cls["id"],
                    "class_name": cls["name"],
                    "bbox_xyxy": box,
                    "in_roi": in_roi,
                    "confidence": round(0.88 + (f % 4) * 0.02, 2),
                })

            fname = f"frame_{f + 1:03d}.png"
            cv2.imwrite(str(vdir / fname), frame)
            writer.write(frame)
            frame_annotations.append({
                "frame_index": f,
                "frame_file": f"samples/videos/frames/{cfg['id']}/{fname}",
                "detections": detections,
            })

        writer.release()
        results.append({
            "id": cfg["id"],
            "filename": cfg["filename"],
            "path": f"samples/videos/{cfg['filename']}",
            "frames_dir": f"samples/videos/frames/{cfg['id']}",
            "format": "AVI + PNG Frame Sequence",
            "title": cfg["title"],
            "description": cfg["description"],
            "width": W,
            "height": H,
            "fps": FPS,
            "frame_count": FRAME_COUNT,
            "default_roi": cfg["default_roi"],
            "expected_tracks": [
                {
                    "track_id": tr["track_id"],
                    "class_id": CLASS_BY_NAME[tr["class_name"]]["id"],
                    "class_name": tr["class_name"],
                    "enters_roi": tr["track_id"] in inside_tracks,
                }
                for tr in cfg["tracks"]
            ],
            "frame_annotations": frame_annotations,
        })
    return results


def main() -> None:
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)

    images = generate_images()
    videos = generate_videos()
    catalog = {
        "project": "Sistem Deteksi, Counting, Tracking & Image Enhancement Kuliner Indonesia (YOLOv11)",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generator": "scripts/prepare_samples.py",
        "total_classes": len(CULINARY_CLASSES),
        "classes": CULINARY_CLASSES,
        "images": images,
        "videos": videos,
    }
    CATALOG_PATH.write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    print(f"[prepare_samples.py] Generated {len(images)} images in {IMAGES_DIR}")
    print(f"[prepare_samples.py] Generated {len(videos)} videos in {VIDEOS_DIR}")
    print(f"[prepare_samples.py] Wrote catalog to {CATALOG_PATH}")


if __name__ == "__main__":
    main()
