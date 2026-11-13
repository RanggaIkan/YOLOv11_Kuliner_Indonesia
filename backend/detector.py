"""YOLOv11 Indonesian Culinary Detector, Tracker, Region Counter & Comparator.

Loads custom-trained Ultralytics YOLOv11 weights (`models/best.pt`) with
automatic fallback to `yolo11n.pt`. Supports:
- Image & Video detection
- Object Counting (per-class and total)
- Multi-Object Tracking (ByteTrack / BoT-SORT with persistent track IDs & trails)
- Region Counter (Object Region #1 using cv2.pointPolygonTest on bbox centroids)
- Before vs After Image Enhancement evaluation across 5 modes
"""

from __future__ import annotations

import base64
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Sequence, Tuple

import cv2
import numpy as np

from backend import CULINARY_CLASSES
from backend.enhancer import apply_enhancement, compute_image_metrics


BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_CUSTOM_MODEL = BASE_DIR / "models" / "best.pt"
DEFAULT_FALLBACK_MODEL = "yolo11n.pt"

# Distinct BGR palette for the 12 Indonesian culinary classes
CLASS_COLORS: Dict[str, Tuple[int, int, int]] = {
    "Nasi Goreng": (60, 140, 255),
    "Bakso": (80, 200, 120),
    "Sate Ayam": (50, 190, 240),
    "Rendang": (60, 80, 210),
    "Soto Ayam": (70, 220, 220),
    "Ayam Goreng": (40, 160, 245),
    "Mie Goreng": (120, 210, 255),
    "Tempe Goreng": (90, 150, 190),
    "Tahu Goreng": (140, 225, 240),
    "Gado-Gado": (100, 210, 90),
    "Pempek": (210, 180, 90),
    "Telur Balado": (75, 95, 245),
}

# Fallback mapping when generic COCO yolo11n.pt weights are used before best.pt is placed
COCO_TO_CULINARY_MAP: Dict[str, str] = {
    "bowl": "Bakso",
    "plate": "Nasi Goreng",
    "sandwich": "Tempe Goreng",
    "hot dog": "Sate Ayam",
    "pizza": "Gado-Gado",
    "donut": "Pempek",
    "cake": "Rendang",
    "banana": "Ayam Goreng",
    "orange": "Telur Balado",
    "apple": "Tahu Goreng",
    "broccoli": "Gado-Gado",
    "carrot": "Soto Ayam",
    "fork": "Mie Goreng",
    "spoon": "Soto Ayam",
    "cup": "Bakso",
}


class CulinaryYOLODetector:
    """Wrapper around Ultralytics YOLOv11 for Indonesian culinary CV tasks."""

    def __init__(
        self,
        model_path: Optional[str] = None,
        fallback_model: str = DEFAULT_FALLBACK_MODEL,
    ) -> None:
        self.requested_model_path = Path(model_path) if model_path else DEFAULT_CUSTOM_MODEL
        self.fallback_model = fallback_model
        self.model: Any = None
        self.model_name: str = "uninitialized"
        self.is_custom_trained: bool = False
        self._load_error: Optional[str] = None
        self._load_model()

    def _load_model(self) -> None:
        """Load models/best.pt if available, otherwise fall back to yolo11n.pt."""
        try:
            from ultralytics import YOLO  # type: ignore
        except ImportError as exc:
            self._load_error = f"ultralytics not installed: {exc}"
            self.model = None
            return

        if self.requested_model_path.exists():
            try:
                self.model = YOLO(str(self.requested_model_path))
                self.model_name = str(self.requested_model_path.name)
                self.is_custom_trained = True
                return
            except Exception as exc:  # pragma: no cover - runtime weight fallback
                self._load_error = f"Failed loading {self.requested_model_path}: {exc}"

        try:
            self.model = YOLO(self.fallback_model)
            self.model_name = self.fallback_model
            self.is_custom_trained = False
        except Exception as exc:  # pragma: no cover
            self._load_error = f"Failed loading fallback {self.fallback_model}: {exc}"
            self.model = None

    def _normalize_class_name(self, raw_name: str, class_id: int) -> str:
        """Map raw model class name to one of the 12 Indonesian culinary classes."""
        if raw_name in CULINARY_CLASSES:
            return raw_name
        lower_map = {c.lower(): c for c in CULINARY_CLASSES}
        if raw_name.lower() in lower_map:
            return lower_map[raw_name.lower()]
        if self.is_custom_trained and 0 <= class_id < len(CULINARY_CLASSES):
            return CULINARY_CLASSES[class_id]
        mapped = COCO_TO_CULINARY_MAP.get(raw_name.lower())
        if mapped:
            return mapped
        return CULINARY_CLASSES[class_id % len(CULINARY_CLASSES)]

    @staticmethod
    def _default_region_points(width: int, height: int) -> List[List[int]]:
        """Return default Object Region #1 rectangle polygon covering center-plate area."""
        x1 = int(width * 0.18)
        y1 = int(height * 0.16)
        x2 = int(width * 0.82)
        y2 = int(height * 0.86)
        return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]

    @staticmethod
    def _parse_region_polygon(
        region_points: Optional[Sequence[Sequence[float]]],
        width: int,
        height: int,
    ) -> np.ndarray:
        """Normalize ROI polygon points into an Nx2 int32 numpy array."""
        if not region_points or len(region_points) < 3:
            pts = CulinaryYOLODetector._default_region_points(width, height)
            return np.array(pts, dtype=np.int32)

        normalized: List[List[int]] = []
        for pt in region_points:
            px, py = float(pt[0]), float(pt[1])
            # Support normalized [0..1] coordinates as well as pixel coordinates
            if 0.0 <= px <= 1.0 and 0.0 <= py <= 1.0:
                px *= width
                py *= height
            normalized.append([int(round(px)), int(round(py))])
        return np.array(normalized, dtype=np.int32)

    @staticmethod
    def _encode_bgr_base64(image_bgr: np.ndarray, quality: int = 88) -> str:
        """Encode BGR image as a JPEG data URL string."""
        ok, buffer = cv2.imencode(".jpg", image_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        if not ok:
            return ""
        encoded = base64.b64encode(buffer.tobytes()).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"

    @staticmethod
    def draw_roi_and_detections(
        image_bgr: np.ndarray,
        detections: List[Dict[str, Any]],
        polygon: np.ndarray,
        inside_count: int,
        outside_count: int,
        trails: Optional[Dict[int, Deque[Tuple[int, int]]]] = None,
        region_name: str = "Object Region #1",
    ) -> np.ndarray:
        """Draw semi-transparent Region Counter overlay, bounding boxes, and trails."""
        canvas = image_bgr.copy()
        overlay = canvas.copy()

        cv2.fillPoly(overlay, [polygon], (255, 191, 0))
        cv2.addWeighted(overlay, 0.14, canvas, 0.86, 0, canvas)
        cv2.polylines(canvas, [polygon], isClosed=True, color=(0, 215, 255), thickness=2)

        top_pt = polygon[0]
        header_text = f"{region_name} | Inside: {inside_count} | Outside: {outside_count}"
        cv2.rectangle(
            canvas,
            (int(top_pt[0]), max(0, int(top_pt[1]) - 28)),
            (int(top_pt[0]) + 340, max(24, int(top_pt[1]))),
            (18, 28, 45),
            -1,
        )
        cv2.putText(
            canvas,
            header_text,
            (int(top_pt[0]) + 8, max(18, int(top_pt[1]) - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.52,
            (0, 230, 255),
            1,
            cv2.LINE_AA,
        )

        if trails:
            for track_id, pts in trails.items():
                if len(pts) < 2:
                    continue
                pts_arr = np.array(list(pts), dtype=np.int32).reshape((-1, 1, 2))
                cv2.polylines(canvas, [pts_arr], False, (255, 220, 90), 2)

        for det in detections:
            x1, y1, x2, y2 = [int(round(v)) for v in det["bbox"]]
            cx, cy = int(round(det["centroid"][0])), int(round(det["centroid"][1]))
            cls_name = det["class_name"]
            conf = det["confidence"]
            in_roi = det["in_region"]
            track_id = det.get("track_id")

            color = CLASS_COLORS.get(cls_name, (80, 220, 180))
            border_color = (0, 255, 140) if in_roi else color
            cv2.rectangle(canvas, (x1, y1), (x2, y2), border_color, 2)
            cv2.circle(canvas, (cx, cy), 4, (0, 255, 255) if in_roi else (200, 200, 200), -1)

            prefix = f"#{track_id} " if track_id is not None else ""
            roi_tag = " [ROI]" if in_roi else ""
            label = f"{prefix}{cls_name} {conf * 100:.1f}%{roi_tag}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(canvas, (x1, max(0, y1 - th - 10)), (x1 + tw + 10, y1), border_color, -1)
            cv2.putText(
                canvas,
                label,
                (x1 + 5, max(12, y1 - 5)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (10, 14, 22),
                1,
                cv2.LINE_AA,
            )

        return canvas

    def _extract_detections(
        self,
        result: Any,
        polygon: np.ndarray,
    ) -> Tuple[List[Dict[str, Any]], int, int, Dict[str, int], Dict[str, int]]:
        """Parse Ultralytics result boxes and compute Region Counter stats."""
        detections: List[Dict[str, Any]] = []
        class_counts: Dict[str, int] = defaultdict(int)
        class_counts_in_region: Dict[str, int] = defaultdict(int)
        inside_region_count = 0
        outside_region_count = 0

        boxes = getattr(result, "boxes", None)
        names = getattr(result, "names", {}) or {}
        if boxes is None or len(boxes) == 0:
            return detections, 0, 0, {}, {}

        xyxy_arr = boxes.xyxy.cpu().numpy()
        conf_arr = boxes.conf.cpu().numpy()
        cls_arr = boxes.cls.cpu().numpy().astype(int)
        id_arr = (
            boxes.id.cpu().numpy().astype(int)
            if getattr(boxes, "id", None) is not None
            else None
        )

        for idx, (box, conf, cls_id) in enumerate(zip(xyxy_arr, conf_arr, cls_arr)):
            x1, y1, x2, y2 = [float(v) for v in box]
            cx = (x1 + x2) / 2.0
            cy = (y1 + y2) / 2.0
            raw_name = str(names.get(int(cls_id), f"class_{cls_id}"))
            cls_name = self._normalize_class_name(raw_name, int(cls_id))

            test_val = cv2.pointPolygonTest(polygon, (cx, cy), False)
            in_region = bool(test_val >= 0)

            class_counts[cls_name] += 1
            if in_region:
                inside_region_count += 1
                class_counts_in_region[cls_name] += 1
            else:
                outside_region_count += 1

            track_id = int(id_arr[idx]) if id_arr is not None else None
            detections.append(
                {
                    "class_id": int(cls_id),
                    "class_name": cls_name,
                    "raw_class_name": raw_name,
                    "confidence": round(float(conf), 4),
                    "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                    "centroid": [round(cx, 1), round(cy, 1)],
                    "in_region": in_region,
                    "track_id": track_id,
                }
            )

        return (
            detections,
            inside_region_count,
            outside_region_count,
            dict(class_counts),
            dict(class_counts_in_region),
        )

    def detect_image(
        self,
        image_bgr: np.ndarray,
        enhancement: str = "none",
        enhancement_params: Optional[Dict[str, Any]] = None,
        region_points: Optional[Sequence[Sequence[float]]] = None,
        conf: float = 0.25,
        mode: str = "counting",
        tracker: str = "bytetrack.yaml",
        include_annotated_image: bool = True,
    ) -> Dict[str, Any]:
        """Run enhancement + YOLOv11 detection/tracking + Region Counter on one image."""
        if self.model is None:
            raise RuntimeError(self._load_error or "YOLO model is not loaded.")

        t0 = time.perf_counter()
        enhanced_bgr = apply_enhancement(image_bgr, enhancement, enhancement_params)
        metrics = compute_image_metrics(image_bgr, enhanced_bgr)

        height, width = enhanced_bgr.shape[:2]
        polygon = self._parse_region_polygon(region_points, width, height)

        if mode == "tracking":
            results = self.model.track(
                enhanced_bgr,
                conf=conf,
                persist=True,
                tracker=tracker,
                verbose=False,
            )
        else:
            results = self.model.predict(enhanced_bgr, conf=conf, verbose=False)

        result = results[0]
        (
            detections,
            inside_count,
            outside_count,
            class_counts,
            class_counts_in_region,
        ) = self._extract_detections(result, polygon)

        inference_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        avg_conf = (
            round(sum(d["confidence"] for d in detections) / len(detections), 4)
            if detections
            else 0.0
        )

        annotated_b64 = ""
        if include_annotated_image:
            annotated = self.draw_roi_and_detections(
                enhanced_bgr,
                detections,
                polygon,
                inside_count,
                outside_count,
            )
            annotated_b64 = self._encode_bgr_base64(annotated)

        return {
            "model_name": self.model_name,
            "is_custom_trained": self.is_custom_trained,
            "mode": mode,
            "enhancement": enhancement,
            "image_size": {"width": width, "height": height},
            "inference_ms": inference_ms,
            "total_detected": len(detections),
            "avg_confidence": avg_conf,
            "inside_region_count": inside_count,
            "outside_region_count": outside_count,
            "class_counts": class_counts,
            "class_counts_in_region": class_counts_in_region,
            "region_points": polygon.tolist(),
            "image_metrics": metrics,
            "detections": detections,
            "annotated_image": annotated_b64,
        }

    def detect_video(
        self,
        video_path: str,
        enhancement: str = "none",
        enhancement_params: Optional[Dict[str, Any]] = None,
        region_points: Optional[Sequence[Sequence[float]]] = None,
        conf: float = 0.25,
        mode: str = "tracking",
        tracker: str = "bytetrack.yaml",
        max_frames: int = 120,
        frame_stride: int = 2,
    ) -> Dict[str, Any]:
        """Run YOLOv11 detection & ByteTrack/BoT-SORT tracking over a video file."""
        if self.model is None:
            raise RuntimeError(self._load_error or "YOLO model is not loaded.")

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video file: {video_path}")

        t0 = time.perf_counter()
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 25.0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 640)
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 480)
        polygon = self._parse_region_polygon(region_points, width, height)

        trails: Dict[int, Deque[Tuple[int, int]]] = defaultdict(lambda: deque(maxlen=24))
        unique_track_ids_inside: set[int] = set()
        unique_track_ids_total: set[int] = set()
        class_counts_total: Dict[str, int] = defaultdict(int)
        class_counts_in_region: Dict[str, int] = defaultdict(int)
        frame_summaries: List[Dict[str, Any]] = []
        preview_frame_b64 = ""

        frame_idx = 0
        processed_frames = 0
        all_confs: List[float] = []

        try:
            while processed_frames < max_frames:
                ret, frame = cap.read()
                if not ret:
                    break

                if frame_idx % max(1, frame_stride) != 0:
                    frame_idx += 1
                    continue

                enhanced = apply_enhancement(frame, enhancement, enhancement_params)
                if mode == "tracking":
                    results = self.model.track(
                        enhanced,
                        conf=conf,
                        persist=True,
                        tracker=tracker,
                        verbose=False,
                    )
                else:
                    results = self.model.predict(enhanced, conf=conf, verbose=False)

                (
                    detections,
                    inside_count,
                    outside_count,
                    frame_class_counts,
                    frame_roi_counts,
                ) = self._extract_detections(results[0], polygon)

                for det in detections:
                    all_confs.append(det["confidence"])
                    tid = det.get("track_id")
                    if tid is not None:
                        cx, cy = int(round(det["centroid"][0])), int(round(det["centroid"][1]))
                        trails[tid].append((cx, cy))
                        unique_track_ids_total.add(tid)
                        if det["in_region"]:
                            unique_track_ids_inside.add(tid)

                for k, v in frame_class_counts.items():
                    class_counts_total[k] = max(class_counts_total[k], v)
                for k, v in frame_roi_counts.items():
                    class_counts_in_region[k] = max(class_counts_in_region[k], v)

                if processed_frames == 0 or processed_frames == 5:
                    annotated = self.draw_roi_and_detections(
                        enhanced,
                        detections,
                        polygon,
                        inside_count,
                        outside_count,
                        trails=trails if mode == "tracking" else None,
                    )
                    preview_frame_b64 = self._encode_bgr_base64(annotated)

                frame_summaries.append(
                    {
                        "frame_index": frame_idx,
                        "timestamp_sec": round(frame_idx / max(fps, 1.0), 2),
                        "total_detected": len(detections),
                        "inside_region_count": inside_count,
                        "outside_region_count": outside_count,
                        "detections": detections,
                    }
                )

                frame_idx += 1
                processed_frames += 1
        finally:
            cap.release()

        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        avg_conf = round(sum(all_confs) / len(all_confs), 4) if all_confs else 0.0
        last_summary = frame_summaries[-1] if frame_summaries else {}

        return {
            "model_name": self.model_name,
            "is_custom_trained": self.is_custom_trained,
            "mode": mode,
            "tracker": tracker if mode == "tracking" else None,
            "enhancement": enhancement,
            "image_size": {"width": width, "height": height},
            "video_info": {"fps": round(fps, 2), "width": width, "height": height, "total_frames": processed_frames},
            "frames_processed": processed_frames,
            "inference_ms": elapsed_ms,
            "total_detected": last_summary.get("total_detected", 0),
            "unique_tracks_total": len(unique_track_ids_total),
            "inside_region_count": (
                len(unique_track_ids_inside)
                if mode == "tracking" and unique_track_ids_inside
                else last_summary.get("inside_region_count", 0)
            ),
            "outside_region_count": last_summary.get("outside_region_count", 0),
            "avg_confidence": avg_conf,
            "class_counts": dict(class_counts_total),
            "class_counts_in_region": dict(class_counts_in_region),
            "region_points": polygon.tolist(),
            "detections": last_summary.get("detections", []),
            "trails": {str(tid): list(pts) for tid, pts in trails.items()},
            "frame_summaries": frame_summaries,
            "preview_frame": preview_frame_b64,
        }

    def compare_before_after(
        self,
        image_bgr: np.ndarray,
        region_points: Optional[Sequence[Sequence[float]]] = None,
        enhancement_params: Optional[Dict[str, Any]] = None,
        conf: float = 0.25,
    ) -> Dict[str, Any]:
        """Compare Original (Before) vs HE, CLAHE, Contrast Stretching, and Brightness."""
        methods = [
            ("none", "Original (Before)"),
            ("he", "Histogram Equalization (HE)"),
            ("clahe", "CLAHE (LAB L-Channel)"),
            ("cs", "Contrast Stretching (2-98%)"),
            ("brightness", "Brightness & Gamma"),
        ]

        comparisons: List[Dict[str, Any]] = []
        baseline_conf = 0.0
        baseline_count = 0

        for method_key, method_label in methods:
            res = self.detect_image(
                image_bgr=image_bgr,
                enhancement=method_key,
                enhancement_params=enhancement_params,
                region_points=region_points,
                conf=conf,
                mode="counting",
                include_annotated_image=True,
            )
            if method_key == "none":
                baseline_conf = res["avg_confidence"]
                baseline_count = res["total_detected"]

            conf_gain = (
                round(((res["avg_confidence"] - baseline_conf) / max(baseline_conf, 1e-4)) * 100.0, 2)
                if method_key != "none" and baseline_conf > 0
                else 0.0
            )
            comparisons.append(
                {
                    "method": method_key,
                    "label": method_label,
                    "total_detected": res["total_detected"],
                    "inside_region_count": res["inside_region_count"],
                    "outside_region_count": res["outside_region_count"],
                    "avg_confidence": res["avg_confidence"],
                    "conf_improvement_pct": conf_gain,
                    "inference_ms": res["inference_ms"],
                    "image_metrics": res["image_metrics"],
                    "class_counts": res["class_counts"],
                    "detections": res["detections"],
                    "annotated_image": res["annotated_image"],
                }
            )

        best_entry = max(
            comparisons,
            key=lambda item: (item["total_detected"], item["avg_confidence"]),
        )
        return {
            "model_name": self.model_name,
            "baseline_detected": baseline_count,
            "baseline_confidence": baseline_conf,
            "best_method": best_entry["method"],
            "best_label": best_entry["label"],
            "comparisons": comparisons,
        }
