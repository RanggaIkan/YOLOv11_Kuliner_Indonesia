"""NusantaraVision YOLOv11 Backend Package.

Menyediakan modul Image Enhancement (OpenCV), Deteksi & Tracking Kuliner
Indonesia (Ultralytics YOLOv11 + ByteTrack + Region Counter), Ekspor Laporan
Excel (.xlsx), serta FastAPI server.
"""

__version__ = "1.0.0"
__app_name__ = "NusantaraVision YOLOv11"

CULINARY_CLASSES = [
    "Nasi Goreng",
    "Bakso",
    "Sate Ayam",
    "Rendang",
    "Soto Ayam",
    "Ayam Goreng",
    "Mie Goreng",
    "Tempe Goreng",
    "Tahu Goreng",
    "Gado-Gado",
    "Pempek",
    "Telur Balado",
]

__all__ = ["__version__", "__app_name__", "CULINARY_CLASSES"]
