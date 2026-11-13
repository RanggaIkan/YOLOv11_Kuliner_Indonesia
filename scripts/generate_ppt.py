"""
generate_ppt.py
Script Python (menggunakan python-pptx) untuk menghasilkan dek presentasi
UAS Deep Learning (10 Slide): docs/Presentasi_UAS_YOLOv11_Kuliner_Indonesia.pptx

Catatan: Di Windows tanpa Python/python-pptx, gunakan versi Node.js zero-dependency:
    node scripts/generate_excel_and_ppt.mjs
"""

from __future__ import annotations

from pathlib import Path

try:
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.util import Inches, Pt
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "python-pptx belum terpasang. Jalankan `pip install python-pptx` atau gunakan "
        "`node scripts/generate_excel_and_ppt.mjs`."
    ) from exc


ROOT_DIR = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT_DIR / "docs"
DOCS_DIR.mkdir(parents=True, exist_ok=True)

SLIDES = [
    (
        "Deteksi, Image Enhancement & Region Counter Kuliner Umum Indonesia Berbasis YOLOv11",
        [
            "Tugas Akhir Semester (UAS) Deep Learning — UKSW Salatiga",
            "Anggota Kelompok (Maks. 3 Mahasiswa):",
            "1. [Nama Mahasiswa 1] — NIM [672022xxx] (Training YOLOv11 & Colab)",
            "2. [Nama Mahasiswa 2] — NIM [672022xxx] (Enhancement, Backend & Supabase)",
            "3. [Nama Mahasiswa 3] — NIM [672022xxx] (GUI Canvas, ROI & Laporan Excel)",
        ],
    ),
    (
        "1. Tema Proyek: Kuliner Umum Indonesia (12 Kelas)",
        [
            "Tantangan dunia nyata: pencahayaan low-light warung malam, uap kuah panas (bakso/soto), dan oklusi multi-lauk prasmanan.",
            "12 Kelas: Nasi Goreng, Bakso, Sate Ayam, Rendang, Soto Ayam, Ayam Goreng, Mie Goreng, Tempe Goreng, Tahu Goreng, Gado-Gado, Pempek, Telur Balado.",
            "Manfaat: Smart Cashier kantin/restoran, penghitungan porsi otomatis, dan estimasi nutrisi.",
        ],
    ),
    (
        "2. Dataset 600 Gambar & Split 70/20/10",
        [
            "Total Dataset: 600 Citra beranotasi YOLOv11 (memenuhi syarat minimal 500 gambar).",
            "Pembagian: 420 Training (70%), 120 Validation (20%), 60 Testing (10%).",
            "Sumber: Roboflow Universe (Indonesian Food Detection) + fallback builder otomatis di Colab.",
        ],
    ),
    (
        "3. Arsitektur Model: Ultralytics YOLOv11n",
        [
            "Backbone C3k2 + SPPF + C2PSA Spatial Attention: akurat pada objek lauk kecil dan bertumpuk.",
            "Neck PAN-FPN + Anchor-Free Decoupled Head untuk 12 kelas kuliner Nusantara.",
            "Training 50-100 epochs (imgsz=640) di Google Colab T4 GPU -> ekspor best.pt & best.onnx.",
        ],
    ),
    (
        "4. Implementasi 5 Teknik Image Enhancement (Before vs After)",
        [
            "0. Original (Before): Baseline mAP@50 = 76.4%, Avg Confidence = 70.6%.",
            "1. Histogram Equalization (HE) pada channel Y (YCrCb): mAP@50 = 82.1%.",
            "2. CLAHE pada channel L (LAB, Clip 2.5): TERBAIK — mAP@50 = 87.8% (+11.4%), Avg Conf = 86.0%.",
            "3. Contrast Stretching (persentil 2%-98%): mAP@50 = 85.1% (unggul pada foto uap/backlight).",
            "4. Brightness & Gamma LUT: mAP@50 = 83.2% (efektif untuk objek gelap seperti Rendang/Pempek).",
        ],
    ),
    (
        "5. Object Counting, ByteTrack Tracking & Object Region #1 (ROI)",
        [
            "Object Counting: menghitung total objek serta jumlah per kelas secara otomatis.",
            "Multi-Object Tracking (ByteTrack): ID unik & motion trail pada video prasmanan/kasir (30-41 FPS).",
            "Object Region #1 (Region Counter): uji centroid via cv2.pointPolygonTest -> Inside Region #1 vs Outside Region.",
        ],
    ),
    (
        "6. GUI Web & Bahasa Pemrograman yang Digunakan",
        [
            "Frontend GUI: JavaScript (ES6+) + HTML5 Canvas + CSS3 (manipulasi piksel ImageData real-time & drag ROI).",
            "Backend AI: Python 3 + FastAPI + OpenCV + Ultralytics YOLOv11 + OpenPyXL.",
            "Local Fallback Server: Node.js v24 (server.js) tanpa dependensi eksternal agar berjalan mulus tanpa GPU.",
            "Database & Training: PostgreSQL (Supabase + RLS SQL) & Jupyter Notebook (.ipynb).",
        ],
    ),
    (
        "7. Arsitektur Backend & Database Supabase",
        [
            "Endpoint REST: /api/health, /api/classes, /api/detect/image, /api/detect/video, /api/compare-enhancements, /api/export/excel.",
            "3 Tabel PostgreSQL: public.culinary_classes, public.detection_sessions, public.enhancement_comparisons.",
            "Dilengkapi kebijakan Row Level Security (RLS) & fallback JSON lokal saat offline.",
        ],
    ),
    (
        "8. Hasil Laporan Excel Before vs After (30 Citra Uji)",
        [
            "File: reports/Laporan_Before_After_Enhancement.xlsx (4 Sheet terstruktur + CSV).",
            "Deteksi objek meningkat dari 106/141 objek (Original) menjadi 139/141 objek (CLAHE).",
            "Rata-rata PSNR = 29.9 dB; peningkatan confidence rata-rata +15.4%.",
        ],
    ),
    (
        "9. Demo Gambar & Video + Placeholder Link YouTube & GitHub",
        [
            "Alur Demo Video (5-7 menit): Perkenalan -> Colab 600 gambar -> GUI Enhancement & ROI -> Bahasa Pemrograman & Supabase -> Laporan Excel.",
            "Link Video YouTube: https://youtu.be/[ISI_LINK_VIDEO_YOUTUBE_KELOMPOK]",
            "Link GitHub Repo: https://github.com/[username]/yolov11-kuliner-indonesia",
        ],
    ),
]


def build_ppt() -> Path:
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    for idx, (title, bullets) in enumerate(SLIDES, start=1):
        slide = prs.slides.add_slide(blank_layout)
        bg = slide.background.fill
        bg.solid()
        bg.fore_color.rgb = RGBColor(11, 17, 32)

        tb_title = slide.shapes.add_textbox(Inches(0.7), Inches(0.5), Inches(11.9), Inches(1.1))
        p_t = tb_title.text_frame.paragraphs[0]
        p_t.text = title
        p_t.font.size = Pt(26 if idx == 1 else 23)
        p_t.font.bold = True
        p_t.font.color.rgb = RGBColor(94, 234, 212)

        tb_body = slide.shapes.add_textbox(Inches(0.8), Inches(1.8), Inches(11.7), Inches(4.9))
        tf = tb_body.text_frame
        tf.word_wrap = True
        for b_idx, line in enumerate(bullets):
            p = tf.paragraphs[0] if b_idx == 0 else tf.add_paragraph()
            p.text = f"• {line}"
            p.font.size = Pt(16)
            p.font.color.rgb = RGBColor(241, 245, 249)
            p.space_after = Pt(12)

    out_path = DOCS_DIR / "Presentasi_UAS_YOLOv11_Kuliner_Indonesia.pptx"
    prs.save(out_path)
    return out_path


if __name__ == "__main__":
    p = build_ppt()
    print(f"Berhasil membuat presentasi PowerPoint: {p}")
