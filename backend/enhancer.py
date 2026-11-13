"""Image Enhancement & Quality Metrics Module (OpenCV).

Implements 5 enhancement modes for Indonesian culinary object detection:
- "none" / "original": Unmodified BGR image
- "he": Histogram Equalization on Y channel in YCrCb color space
- "clahe": Contrast Limited Adaptive Histogram Equalization on L channel in LAB
- "cs": Contrast Stretching using 2nd-98th percentile intensity bounds
- "brightness": Linear contrast/brightness (alpha/beta) + Gamma LUT correction
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import cv2
import numpy as np


SUPPORTED_METHODS = ("none", "original", "he", "clahe", "cs", "brightness")


def _clamp_float(value: Any, default: float, min_val: float, max_val: float) -> float:
    """Safely parse and clamp a numeric parameter."""
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    if np.isnan(parsed) or np.isinf(parsed):
        return default
    return max(min_val, min(max_val, parsed))


def _apply_he(image_bgr: np.ndarray) -> np.ndarray:
    """Apply Histogram Equalization on the Y luminance channel in YCrCb space."""
    ycrcb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2YCrCb)
    y_ch, cr_ch, cb_ch = cv2.split(ycrcb)
    y_eq = cv2.equalizeHist(y_ch)
    merged = cv2.merge([y_eq, cr_ch, cb_ch])
    return cv2.cvtColor(merged, cv2.COLOR_YCrCb2BGR)


def _apply_clahe(image_bgr: np.ndarray, params: Dict[str, Any]) -> np.ndarray:
    """Apply CLAHE on the L lightness channel in LAB color space."""
    clip_limit = _clamp_float(params.get("clip_limit"), 2.5, 0.5, 10.0)
    grid_size = int(_clamp_float(params.get("tile_grid_size"), 8.0, 2.0, 32.0))

    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(grid_size, grid_size))
    l_enhanced = clahe.apply(l_ch)
    merged = cv2.merge([l_enhanced, a_ch, b_ch])
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def _apply_contrast_stretching(image_bgr: np.ndarray, params: Dict[str, Any]) -> np.ndarray:
    """Apply 2nd-98th percentile contrast stretching per BGR channel."""
    low_pct = _clamp_float(params.get("low_percentile"), 2.0, 0.0, 20.0)
    high_pct = _clamp_float(params.get("high_percentile"), 98.0, 80.0, 100.0)
    if high_pct <= low_pct:
        low_pct, high_pct = 2.0, 98.0

    stretched_channels: List[np.ndarray] = []
    for channel in cv2.split(image_bgr):
        p_low, p_high = np.percentile(channel, (low_pct, high_pct))
        if p_high - p_low < 1e-5:
            stretched_channels.append(channel.copy())
            continue
        scaled = (channel.astype(np.float32) - float(p_low)) * (255.0 / float(p_high - p_low))
        stretched_channels.append(np.clip(scaled, 0, 255).astype(np.uint8))

    return cv2.merge(stretched_channels)


def _apply_brightness_gamma(image_bgr: np.ndarray, params: Dict[str, Any]) -> np.ndarray:
    """Apply alpha/beta brightness-contrast scaling followed by gamma LUT correction."""
    alpha = _clamp_float(params.get("alpha", params.get("contrast")), 1.2, 0.2, 3.0)
    beta = _clamp_float(params.get("beta", params.get("brightness")), 20.0, -120.0, 120.0)
    gamma = _clamp_float(params.get("gamma"), 1.0, 0.2, 3.0)

    adjusted = cv2.convertScaleAbs(image_bgr, alpha=alpha, beta=beta)
    if abs(gamma - 1.0) > 1e-3:
        inv_gamma = 1.0 / gamma
        lut = np.array(
            [((idx / 255.0) ** inv_gamma) * 255.0 for idx in range(256)],
            dtype=np.uint8,
        )
        adjusted = cv2.LUT(adjusted, lut)
    return adjusted


def apply_enhancement(
    image_bgr: np.ndarray,
    method: str = "none",
    params: Optional[Dict[str, Any]] = None,
) -> np.ndarray:
    """Apply an image enhancement technique to a BGR OpenCV image.

    Args:
        image_bgr: Input BGR image array (uint8, HxWx3).
        method: One of "none", "original", "he", "clahe", "cs", "brightness".
        params: Optional dict of technique-specific tuning parameters.

    Returns:
        Enhanced BGR uint8 image array.
    """
    if image_bgr is None or image_bgr.size == 0:
        raise ValueError("Input image_bgr must be a non-empty numpy array.")

    norm_method = (method or "none").strip().lower()
    cfg = params or {}

    if norm_method in ("none", "original"):
        return image_bgr.copy()
    if norm_method == "he":
        return _apply_he(image_bgr)
    if norm_method == "clahe":
        return _apply_clahe(image_bgr, cfg)
    if norm_method in ("cs", "contrast_stretching"):
        return _apply_contrast_stretching(image_bgr, cfg)
    if norm_method in ("brightness", "brightness_contrast"):
        return _apply_brightness_gamma(image_bgr, cfg)

    raise ValueError(
        f"Unsupported enhancement method '{method}'. "
        f"Supported methods: {', '.join(SUPPORTED_METHODS)}."
    )


def _shannon_entropy(gray: np.ndarray) -> float:
    """Compute Shannon entropy (bits) of an 8-bit grayscale image."""
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).ravel()
    total = float(hist.sum())
    if total <= 0:
        return 0.0
    probs = hist[hist > 0] / total
    return float(-np.sum(probs * np.log2(probs)))


def compute_image_metrics(
    before_bgr: np.ndarray,
    after_bgr: np.ndarray,
) -> Dict[str, float]:
    """Compute quantitative image quality metrics comparing before and after images.

    Returns:
        Dict with keys: mean_brightness, rms_contrast, entropy, psnr,
        enhancement_gain_pct.
    """
    if before_bgr is None or after_bgr is None:
        raise ValueError("Both before_bgr and after_bgr must be non-empty arrays.")

    before_gray = cv2.cvtColor(before_bgr, cv2.COLOR_BGR2GRAY)
    after_gray = cv2.cvtColor(after_bgr, cv2.COLOR_BGR2GRAY)

    before_contrast = float(np.std(before_gray))
    after_brightness = float(np.mean(after_gray))
    after_contrast = float(np.std(after_gray))
    after_entropy = _shannon_entropy(after_gray)

    mse = float(np.mean((before_bgr.astype(np.float64) - after_bgr.astype(np.float64)) ** 2))
    if mse < 1e-10:
        psnr_val = 99.99
    else:
        psnr_val = float(10.0 * np.log10((255.0 ** 2) / mse))

    if before_contrast < 1e-5:
        gain_pct = 0.0
    else:
        gain_pct = ((after_contrast - before_contrast) / before_contrast) * 100.0

    return {
        "mean_brightness": round(after_brightness, 2),
        "rms_contrast": round(after_contrast, 2),
        "entropy": round(after_entropy, 3),
        "psnr": round(psnr_val, 2),
        "enhancement_gain_pct": round(gain_pct, 2),
    }


def compute_luminance_histogram(image_bgr: np.ndarray, bins: int = 32) -> List[int]:
    """Return a downsampled luminance histogram for UI visualization."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    hist = cv2.calcHist([gray], [0], None, [bins], [0, 256]).ravel()
    return [int(v) for v in hist]
