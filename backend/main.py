"""FastAPI Application for NusantaraVision YOLOv11 Indonesian Culinary CV.

Exposes REST endpoints for image/video detection, ByteTrack/BoT-SORT tracking,
Region Counter (ROI), 5-mode Image Enhancement comparison, Excel/CSV export,
and static mounting of frontend/, samples/, and reports/.
"""

from __future__ import annotations

import base64
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from backend import CULINARY_CLASSES, __app_name__, __version__
from backend.detector import CulinaryYOLODetector
from backend.enhancer import apply_enhancement, compute_image_metrics, compute_luminance_histogram
from backend.excel_exporter import (
    DEFAULT_REPORT_PATH,
    export_before_after_excel,
    generate_csv_bytes,
)

# Optional Supabase client owned by supabase-db module
try:
    from backend import supabase_client  # type: ignore
except Exception:  # pragma: no cover - safe fallback when module unavailable
    supabase_client = None  # type: ignore


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
SAMPLES_DIR = BASE_DIR / "samples"
REPORTS_DIR = BASE_DIR / "reports"
FALLBACK_DB_PATH = REPORTS_DIR / "local_db_fallback.json"

app = FastAPI(
    title=__app_name__,
    version=__version__,
    description=(
        "Sistem Deteksi, Object Counting, Multi-Object Tracking, Region Counter, "
        "dan Evaluasi Image Enhancement Kuliner Indonesia berbasis YOLOv11."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_detector_instance: Optional[CulinaryYOLODetector] = None


def get_detector() -> CulinaryYOLODetector:
    """Lazily initialize the YOLOv11 detector singleton."""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = CulinaryYOLODetector()
    return _detector_instance


def _load_fallback_db() -> Dict[str, Any]:
    """Read reports/local_db_fallback.json if available."""
    if FALLBACK_DB_PATH.exists():
        try:
            return json.loads(FALLBACK_DB_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _get_db_client() -> Any:
    """Return SupabaseCulinaryClient singleton if module is available."""
    if supabase_client is None:
        return None
    factory = getattr(supabase_client, "get_supabase_client", None)
    if callable(factory):
        try:
            return factory()
        except Exception:
            return None
    return None


def _default_classes_payload() -> List[Dict[str, Any]]:
    """Return 12 Indonesian culinary classes from Supabase/JSON fallback or defaults."""
    db_client = _get_db_client()
    if db_client is not None:
        try:
            data = db_client.get_classes()
            if isinstance(data, list) and data:
                return data
        except Exception:
            pass

    fallback = _load_fallback_db()
    if isinstance(fallback.get("culinary_classes"), list) and fallback["culinary_classes"]:
        return fallback["culinary_classes"]

    return [
        {
            "id": idx + 1,
            "name": name,
            "slug": name.lower().replace(" ", "-"),
            "region_origin": "Indonesia",
            "category": "Kuliner Nusantara",
            "dataset_count": 50,
        }
        for idx, name in enumerate(CULINARY_CLASSES)
    ]


def _decode_image_bytes(raw_bytes: bytes) -> np.ndarray:
    """Decode raw image bytes into a BGR OpenCV numpy array."""
    arr = np.frombuffer(raw_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Gagal mendekode file gambar.")
    return img


def _decode_base64_image(data_url_or_b64: str) -> np.ndarray:
    """Decode base64 or data URL image string into BGR numpy array."""
    payload = data_url_or_b64.split(",", 1)[-1]
    try:
        raw = base64.b64decode(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Base64 gambar tidak valid: {exc}") from exc
    return _decode_image_bytes(raw)


def _resolve_sample_image(sample_id: str) -> np.ndarray:
    """Load sample image from samples/images/ based on sample_id or filename."""
    candidates = [
        SAMPLES_DIR / "images" / sample_id,
        SAMPLES_DIR / "images" / f"{sample_id}.png",
        SAMPLES_DIR / "images" / f"{sample_id}.jpg",
    ]
    for path in candidates:
        if path.exists() and path.is_file():
            img = cv2.imread(str(path))
            if img is not None:
                return img
    raise HTTPException(status_code=404, detail=f"Sampel gambar '{sample_id}' tidak ditemukan.")


def _parse_json_field(raw: Optional[str], default: Any = None) -> Any:
    """Safely parse optional JSON string form field."""
    if not raw:
        return default
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return default


def _maybe_save_session(payload: Dict[str, Any]) -> None:
    """Persist detection session to Supabase if client helper is available."""
    db_client = _get_db_client()
    if db_client is None:
        return
    try:
        db_client.save_session(payload)
    except Exception:
        return


@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    """Return server, model, and database readiness status."""
    model_exists = (BASE_DIR / "models" / "best.pt").exists()
    detector_status = "ready" if _detector_instance and _detector_instance.model else "lazy"
    return {
        "status": "ok",
        "app": __app_name__,
        "version": __version__,
        "runtime": "python-fastapi",
        "custom_model_present": model_exists,
        "detector_state": detector_status,
        "classes_count": len(CULINARY_CLASSES),
        "supabase_module_loaded": supabase_client is not None,
    }


@app.get("/api/classes")
def list_classes() -> Dict[str, Any]:
    """Return the 12 Indonesian culinary classes and dataset statistics."""
    classes = _default_classes_payload()
    total_images = sum(int(c.get("dataset_count", 0)) for c in classes)
    return {
        "total_classes": len(classes),
        "total_dataset_images": total_images or 600,
        "classes": classes,
    }


@app.post("/api/detect/image")
async def detect_image_endpoint(
    request: Request,
    file: Optional[UploadFile] = File(default=None),
    sample_id: Optional[str] = Form(default=None),
    enhancement: str = Form(default="none"),
    mode: str = Form(default="counting"),
    conf: float = Form(default=0.25),
    region_points: Optional[str] = Form(default=None),
    params: Optional[str] = Form(default=None),
    save_session: bool = Form(default=False),
) -> JSONResponse:
    """Detect Indonesian food objects in an uploaded image or sample scene."""
    content_type = request.headers.get("content-type", "")
    parsed_region = _parse_json_field(region_points, None)
    parsed_params = _parse_json_field(params, {})
    media_name = "upload.jpg"

    if "application/json" in content_type:
        body = await request.json()
        enhancement = str(body.get("enhancement", enhancement))
        mode = str(body.get("mode", mode))
        conf = float(body.get("conf", conf))
        parsed_region = body.get("region_points", parsed_region)
        parsed_params = body.get("params", parsed_params)
        save_session = bool(body.get("save_session", save_session))
        if body.get("image_base64"):
            image_bgr = _decode_base64_image(body["image_base64"])
            media_name = str(body.get("filename", "canvas_capture.jpg"))
        elif body.get("sample_id"):
            image_bgr = _resolve_sample_image(str(body["sample_id"]))
            media_name = str(body["sample_id"])
        else:
            raise HTTPException(status_code=400, detail="Berikan image_base64 atau sample_id.")
    elif file is not None:
        raw_bytes = await file.read()
        image_bgr = _decode_image_bytes(raw_bytes)
        media_name = file.filename or "upload.jpg"
    elif sample_id:
        image_bgr = _resolve_sample_image(sample_id)
        media_name = sample_id
    else:
        raise HTTPException(status_code=400, detail="File gambar atau sample_id wajib diisi.")

    detector = get_detector()
    result = detector.detect_image(
        image_bgr=image_bgr,
        enhancement=enhancement,
        enhancement_params=parsed_params,
        region_points=parsed_region,
        conf=conf,
        mode=mode,
        include_annotated_image=True,
    )
    enhanced_bgr = apply_enhancement(image_bgr, enhancement, parsed_params)
    result["luminance_histogram"] = compute_luminance_histogram(enhanced_bgr)
    result["media_name"] = media_name

    if save_session:
        _maybe_save_session(
            {
                "media_name": media_name,
                "media_type": "image",
                "model_name": result["model_name"],
                "enhancement_method": enhancement,
                "mode": mode,
                "total_detected": result["total_detected"],
                "region_inside_count": result["inside_region_count"],
                "region_outside_count": result["outside_region_count"],
                "avg_confidence": result["avg_confidence"],
                "inference_ms": result["inference_ms"],
                "class_breakdown": result["class_counts"],
            }
        )

    return JSONResponse(content=result)


@app.post("/api/detect/video")
async def detect_video_endpoint(
    file: Optional[UploadFile] = File(default=None),
    sample_id: Optional[str] = Form(default=None),
    enhancement: str = Form(default="none"),
    mode: str = Form(default="tracking"),
    tracker: str = Form(default="bytetrack.yaml"),
    conf: float = Form(default=0.25),
    region_points: Optional[str] = Form(default=None),
    params: Optional[str] = Form(default=None),
) -> JSONResponse:
    """Run YOLOv11 + ByteTrack/BoT-SORT + Region Counter on an uploaded or sample video."""
    parsed_region = _parse_json_field(region_points, None)
    parsed_params = _parse_json_field(params, {})
    temp_path: Optional[Path] = None

    try:
        if file is not None:
            suffix = Path(file.filename or "video.mp4").suffix or ".mp4"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(await file.read())
                temp_path = Path(tmp.name)
            video_path = temp_path
            media_name = file.filename or "video.mp4"
        elif sample_id:
            candidates = [
                SAMPLES_DIR / "videos" / sample_id,
                SAMPLES_DIR / "videos" / f"{sample_id}.avi",
                SAMPLES_DIR / "videos" / f"{sample_id}.mp4",
            ]
            found = next((p for p in candidates if p.exists() and p.is_file()), None)
            if not found:
                raise HTTPException(status_code=404, detail=f"Sampel video '{sample_id}' tidak ditemukan.")
            video_path = found
            media_name = found.name
        else:
            raise HTTPException(status_code=400, detail="File video atau sample_id wajib diisi.")

        detector = get_detector()
        result = detector.detect_video(
            video_path=str(video_path),
            enhancement=enhancement,
            enhancement_params=parsed_params,
            region_points=parsed_region,
            conf=conf,
            mode=mode,
            tracker=tracker,
        )
        result["media_name"] = media_name
        return JSONResponse(content=result)
    finally:
        if temp_path and temp_path.exists():
            os.unlink(temp_path)


@app.post("/api/compare-enhancements")
async def compare_enhancements_endpoint(
    request: Request,
    file: Optional[UploadFile] = File(default=None),
    sample_id: Optional[str] = Form(default=None),
    conf: float = Form(default=0.25),
    region_points: Optional[str] = Form(default=None),
    params: Optional[str] = Form(default=None),
) -> JSONResponse:
    """Compare Original (Before) vs HE, CLAHE, CS, and Brightness on one image."""
    content_type = request.headers.get("content-type", "")
    parsed_region = _parse_json_field(region_points, None)
    parsed_params = _parse_json_field(params, {})

    if "application/json" in content_type:
        body = await request.json()
        conf = float(body.get("conf", conf))
        parsed_region = body.get("region_points", parsed_region)
        parsed_params = body.get("params", parsed_params)
        if body.get("image_base64"):
            image_bgr = _decode_base64_image(body["image_base64"])
        elif body.get("sample_id"):
            image_bgr = _resolve_sample_image(str(body["sample_id"]))
        else:
            raise HTTPException(status_code=400, detail="Berikan image_base64 atau sample_id.")
    elif file is not None:
        image_bgr = _decode_image_bytes(await file.read())
    elif sample_id:
        image_bgr = _resolve_sample_image(sample_id)
    else:
        raise HTTPException(status_code=400, detail="File gambar atau sample_id wajib diisi.")

    detector = get_detector()
    result = detector.compare_before_after(
        image_bgr=image_bgr,
        region_points=parsed_region,
        enhancement_params=parsed_params,
        conf=conf,
    )
    return JSONResponse(content=result)


@app.api_route("/api/export/excel", methods=["GET", "POST"])
async def export_excel_endpoint(
    request: Request,
    format: str = Query(default="xlsx"),
) -> Response:
    """Export Before vs After Enhancement comparison report as .xlsx or .csv."""
    comparisons: Optional[List[Dict[str, Any]]] = None
    if request.method == "POST":
        try:
            body = await request.json()
            if isinstance(body, dict) and isinstance(body.get("comparisons"), list):
                comparisons = body["comparisons"]
        except Exception:
            comparisons = None

    if not comparisons:
        db_client = _get_db_client()
        if db_client is not None:
            try:
                comparisons = db_client.get_comparisons(limit=100)
            except Exception:
                comparisons = None
    if not comparisons:
        fallback = _load_fallback_db()
        if isinstance(fallback.get("enhancement_comparisons"), list):
            comparisons = fallback["enhancement_comparisons"]

    if format.lower() == "csv":
        csv_bytes = generate_csv_bytes(comparisons)
        return Response(
            content=csv_bytes,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": 'attachment; filename="Laporan_Before_After_Enhancement.csv"'
            },
        )

    classes = _default_classes_payload()
    if comparisons or not DEFAULT_REPORT_PATH.exists():
        report_path = export_before_after_excel(comparisons=comparisons, classes_info=classes)
    else:
        report_path = DEFAULT_REPORT_PATH

    return FileResponse(
        path=str(report_path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="Laporan_Before_After_Enhancement.xlsx",
    )


@app.post("/api/enhance-preview")
async def enhance_preview_endpoint(
    file: Optional[UploadFile] = File(default=None),
    sample_id: Optional[str] = Form(default=None),
    enhancement: str = Form(default="clahe"),
    params: Optional[str] = Form(default=None),
) -> JSONResponse:
    """Return enhanced image preview and metrics without running YOLO."""
    if file is not None:
        image_bgr = _decode_image_bytes(await file.read())
    elif sample_id:
        image_bgr = _resolve_sample_image(sample_id)
    else:
        raise HTTPException(status_code=400, detail="File atau sample_id wajib diisi.")

    parsed_params = _parse_json_field(params, {})
    enhanced_bgr = apply_enhancement(image_bgr, enhancement, parsed_params)
    metrics = compute_image_metrics(image_bgr, enhanced_bgr)
    ok, buf = cv2.imencode(".jpg", enhanced_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    img_b64 = base64.b64encode(buf.tobytes()).decode("ascii") if ok else ""

    return JSONResponse(
        content={
            "enhancement": enhancement,
            "image_metrics": metrics,
            "luminance_histogram": compute_luminance_histogram(enhanced_bgr),
            "enhanced_image": f"data:image/jpeg;base64,{img_b64}" if img_b64 else "",
        }
    )


# Mount static directories when present
if SAMPLES_DIR.exists():
    app.mount("/samples", StaticFiles(directory=str(SAMPLES_DIR)), name="samples")
if REPORTS_DIR.exists():
    app.mount("/reports", StaticFiles(directory=str(REPORTS_DIR)), name="reports")
if FRONTEND_DIR.exists():
    app.mount("/frontend", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


@app.get("/")
def serve_root() -> Response:
    """Serve frontend/index.html at the root path."""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return JSONResponse(
        content={
            "message": f"{__app_name__} FastAPI running. Open /docs for Swagger UI."
        }
    )
