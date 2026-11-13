"""Supabase client wrapper with automatic local JSON fallback.

Connects to Supabase (via ``supabase-py`` when configured with valid
``SUPABASE_URL`` and ``SUPABASE_PUBLISHABLE_KEY`` / ``SUPABASE_ANON_KEY``),
and seamlessly falls back to ``reports/local_db_fallback.json`` when
environment variables are missing, placeholder values are detected, or the
remote Supabase instance is unreachable.
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

try:
    from supabase import Client, create_client  # type: ignore

    HAS_SUPABASE_SDK = True
except ImportError:
    Client = Any  # type: ignore
    create_client = None  # type: ignore
    HAS_SUPABASE_SDK = False


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_FALLBACK_PATH = PROJECT_ROOT / "reports" / "local_db_fallback.json"

_PLACEHOLDER_MARKERS = (
    "your-project-ref",
    "your_publishable_key_here",
    "your_legacy_anon_key_here",
    "example.supabase.co",
)


def _is_valid_config(url: str, key: str) -> bool:
    """Return True if Supabase URL and key appear to be real credentials."""
    if not url or not key:
        return False
    lower_url = url.strip().lower()
    lower_key = key.strip().lower()
    if not (lower_url.startswith("http://") or lower_url.startswith("https://")):
        return False
    for marker in _PLACEHOLDER_MARKERS:
        if marker in lower_url or marker in lower_key:
            return False
    return True


def _utc_now_iso() -> str:
    """Return current UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class SupabaseCulinaryClient:
    """Client for culinary classes, detection sessions, and enhancement benchmarks."""

    def __init__(self, fallback_path: Optional[Path | str] = None) -> None:
        self.fallback_path = Path(
            fallback_path or os.getenv("LOCAL_DB_FALLBACK_PATH") or DEFAULT_FALLBACK_PATH
        )
        if not self.fallback_path.is_absolute():
            self.fallback_path = PROJECT_ROOT / self.fallback_path

        self.url: str = os.getenv("SUPABASE_URL", "").strip()
        self.key: str = (
            os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
            or os.getenv("SUPABASE_ANON_KEY", "").strip()
        )
        self._lock = threading.Lock()
        self._client: Optional[Client] = None
        self._last_error: Optional[str] = None

        if HAS_SUPABASE_SDK and _is_valid_config(self.url, self.key):
            try:
                self._client = create_client(self.url, self.key)
            except Exception as exc:  # pragma: no cover - defensive fallback
                self._last_error = str(exc)
                self._client = None

    @property
    def is_connected(self) -> bool:
        """True when an active Supabase SDK client is initialized."""
        return self._client is not None

    def status(self) -> Dict[str, Any]:
        """Return current persistence mode and connection metadata."""
        return {
            "mode": "supabase" if self.is_connected else "local_fallback",
            "connected": self.is_connected,
            "sdk_available": HAS_SUPABASE_SDK,
            "url": self.url if self.is_connected else None,
            "fallback_path": str(self.fallback_path),
            "last_error": self._last_error,
        }

    def _read_local_db(self) -> Dict[str, Any]:
        """Load the local JSON fallback database from disk."""
        if not self.fallback_path.exists():
            return {
                "metadata": {"total_classes": 12, "total_dataset_images": 600},
                "culinary_classes": [],
                "detection_sessions": [],
                "enhancement_comparisons": [],
            }
        with self.fallback_path.open("r", encoding="utf-8") as fh:
            return json.load(fh)

    def _write_local_db(self, data: Dict[str, Any]) -> None:
        """Persist the local JSON fallback database atomically."""
        self.fallback_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self.fallback_path.with_suffix(".json.tmp")
        with tmp_path.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        tmp_path.replace(self.fallback_path)

    def get_classes(self) -> List[Dict[str, Any]]:
        """Fetch all 12 Indonesian culinary classes ordered by id."""
        if self._client is not None:
            try:
                resp = (
                    self._client.table("culinary_classes")
                    .select("*")
                    .order("id", desc=False)
                    .execute()
                )
                if resp.data is not None:
                    return list(resp.data)
            except Exception as exc:
                self._last_error = str(exc)

        with self._lock:
            db = self._read_local_db()
            return list(db.get("culinary_classes", []))

    def get_sessions(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetch detection sessions ordered newest first."""
        if self._client is not None:
            try:
                resp = (
                    self._client.table("detection_sessions")
                    .select("*")
                    .order("created_at", desc=True)
                    .limit(limit)
                    .execute()
                )
                if resp.data is not None:
                    return list(resp.data)
            except Exception as exc:
                self._last_error = str(exc)

        with self._lock:
            db = self._read_local_db()
            sessions = list(db.get("detection_sessions", []))
            sessions.sort(key=lambda row: row.get("created_at", ""), reverse=True)
            return sessions[:limit]

    def save_session(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a detection session into Supabase or local fallback JSON."""
        record = {
            "media_name": str(payload.get("media_name") or "untitled_media.jpg"),
            "media_type": "video" if payload.get("media_type") == "video" else "image",
            "model_name": str(payload.get("model_name") or "yolo11n-culinary-best.pt"),
            "enhancement_method": str(payload.get("enhancement_method") or "clahe"),
            "mode": "tracking" if payload.get("mode") == "tracking" else "counting",
            "total_detected": int(payload.get("total_detected", 0)),
            "region_inside_count": int(payload.get("region_inside_count", 0)),
            "region_outside_count": int(payload.get("region_outside_count", 0)),
            "avg_confidence": round(float(payload.get("avg_confidence", 0.0)), 4),
            "inference_ms": round(float(payload.get("inference_ms", 0.0)), 2),
            "class_breakdown": payload.get("class_breakdown") or {},
        }

        if self._client is not None:
            try:
                resp = self._client.table("detection_sessions").insert(record).execute()
                if resp.data:
                    return {"data": resp.data[0], "source": "supabase"}
            except Exception as exc:
                self._last_error = str(exc)

        with self._lock:
            db = self._read_local_db()
            sessions = db.setdefault("detection_sessions", [])
            next_id = max((int(item.get("id", 0)) for item in sessions), default=0) + 1
            local_record = {
                "id": next_id,
                **record,
                "created_at": payload.get("created_at") or _utc_now_iso(),
            }
            sessions.append(local_record)
            self._write_local_db(db)
            return {"data": local_record, "source": "local_fallback"}

    def get_comparisons(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Fetch enhancement comparison benchmark rows ordered newest first."""
        if self._client is not None:
            try:
                resp = (
                    self._client.table("enhancement_comparisons")
                    .select("*")
                    .order("created_at", desc=True)
                    .limit(limit)
                    .execute()
                )
                if resp.data is not None:
                    return list(resp.data)
            except Exception as exc:
                self._last_error = str(exc)

        with self._lock:
            db = self._read_local_db()
            rows = list(db.get("enhancement_comparisons", []))
            rows.sort(key=lambda row: row.get("created_at", ""), reverse=True)
            return rows[:limit]

    def save_comparison(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a Before vs After enhancement comparison row."""
        record = {
            "session_id": payload.get("session_id"),
            "image_name": str(payload.get("image_name") or "sample_image.jpg"),
            "ground_truth_count": int(payload.get("ground_truth_count", 0)),
            "before_count": int(payload.get("before_count", 0)),
            "before_conf": round(float(payload.get("before_conf", 0.0)), 4),
            "he_count": int(payload.get("he_count", 0)),
            "he_conf": round(float(payload.get("he_conf", 0.0)), 4),
            "clahe_count": int(payload.get("clahe_count", 0)),
            "clahe_conf": round(float(payload.get("clahe_conf", 0.0)), 4),
            "cs_count": int(payload.get("cs_count", 0)),
            "cs_conf": round(float(payload.get("cs_conf", 0.0)), 4),
            "brightness_count": int(payload.get("brightness_count", 0)),
            "brightness_conf": round(float(payload.get("brightness_conf", 0.0)), 4),
            "best_method": str(payload.get("best_method") or "clahe"),
            "conf_improvement_pct": round(float(payload.get("conf_improvement_pct", 0.0)), 2),
            "psnr_db": round(float(payload.get("psnr_db", 0.0)), 2),
        }

        if self._client is not None:
            try:
                resp = self._client.table("enhancement_comparisons").insert(record).execute()
                if resp.data:
                    return {"data": resp.data[0], "source": "supabase"}
            except Exception as exc:
                self._last_error = str(exc)

        with self._lock:
            db = self._read_local_db()
            rows = db.setdefault("enhancement_comparisons", [])
            next_id = max((int(item.get("id", 0)) for item in rows), default=0) + 1
            local_record = {
                "id": next_id,
                **record,
                "created_at": payload.get("created_at") or _utc_now_iso(),
            }
            rows.append(local_record)
            self._write_local_db(db)
            return {"data": local_record, "source": "local_fallback"}

    def get_dashboard_summary(self) -> Dict[str, Any]:
        """Return combined classes, sessions, comparisons, and connection status."""
        return {
            "status": self.status(),
            "culinary_classes": self.get_classes(),
            "detection_sessions": self.get_sessions(limit=50),
            "enhancement_comparisons": self.get_comparisons(limit=50),
        }


_DEFAULT_CLIENT: Optional[SupabaseCulinaryClient] = None


def get_supabase_client() -> SupabaseCulinaryClient:
    """Return a shared singleton instance of ``SupabaseCulinaryClient``."""
    global _DEFAULT_CLIENT
    if _DEFAULT_CLIENT is None:
        _DEFAULT_CLIENT = SupabaseCulinaryClient()
    return _DEFAULT_CLIENT
