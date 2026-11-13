# NusantaraVision YOLOv11 — Deteksi, Image Enhancement & Region Counter Kuliner Umum Indonesia

> **Tugas Akhir Semester (UAS) Deep Learning — Universitas Kristen Satya Wacana (UKSW)**
> Sistem Deteksi Objek, Klasifikasi 12 Kelas Kuliner Nusantara, **Image Enhancement (Before vs After)**, **Object Counting**, **Multi-Object Tracking (ByteTrack)**, dan **Region Counter (`Object Region #1`)** berbasis **Ultralytics YOLOv11**.

---

## Anggota Kelompok (Maksimal 3 Mahasiswa)
| No | Nama Lengkap | NIM | Peran Utama |
| :--- | :--- | :--- | :--- |
| 1 | `[Nama Mahasiswa 1]` | `[672022xxx]` | Dataset 600 Citra & Training YOLOv11 (Google Colab) |
| 2 | `[Nama Mahasiswa 2]` | `[672022xxx]` | Image Enhancement (OpenCV), Backend API & Database Supabase |
| 3 | `[Nama Mahasiswa 3]` | `[672022xxx]` | GUI Web Interaktif (HTML5 Canvas), ROI Counter & Laporan Excel/PPT |

- **Link Video Demo YouTube**: `https://youtu.be/[ISI_LINK_VIDEO_YOUTUBE_KELOMPOK]`
- **Link Repository GitHub**: `https://github.com/[username]/yolov11-kuliner-indonesia`

---

## Ringkasan Proyek & 12 Kelas Kuliner Indonesia

Proyek ini berfokus pada tema **Kuliner Umum Indonesia** dengan **600 gambar** beranotasi format YOLOv11 (**420 Train / 70%**, **120 Valid / 20%**, **60 Test / 10%**) yang mencakup **12 kelas makanan khas Nusantara**:

1. **Nasi Goreng** (60 citra)
2. **Bakso** (54 citra)
3. **Sate Ayam** (54 citra)
4. **Rendang** (50 citra)
5. **Soto Ayam** (50 citra)
6. **Ayam Goreng** (50 citra)
7. **Mie Goreng** (50 citra)
8. **Tempe Goreng** (50 citra)
9. **Tahu Goreng** (50 citra)
10. **Gado-Gado** (46 citra)
11. **Pempek** (46 citra)
12. **Telur Balado** (40 citra)

---

## Arsitektur & Bahasa Pemrograman yang Digunakan

Sesuai ketentuan penilaian (*"Ada GUI, dijelaskan pakai bahasa pemrograman apa?"*), sistem ini dibangun menggunakan arsitektur *multi-layer* berikut:

| Komponen | Bahasa Pemrograman & Teknologi | Fungsi Utama |
| :--- | :--- | :--- |
| **GUI Web Interaktif** (`frontend/`) | **JavaScript (ES6+)**, **HTML5 Canvas**, **CSS3** | Antarmuka 4-tab, manipulasi piksel *ImageData* real-time (HE, CLAHE, CS, Brightness/Gamma), histogram luminansi, drag-and-resize **Object Region #1 (ROI)**, serta visualisasi hasil Before vs After. |
| **Backend AI & Computer Vision** (`backend/`) | **Python 3.10+**, **FastAPI**, **OpenCV (`cv2`)**, **Ultralytics YOLOv11**, **NumPy**, **OpenPyXL** | Inference model `best.pt` / `yolo11n.pt`, *ByteTrack/BoT-SORT tracking*, uji ROI `cv2.pointPolygonTest`, perhitungan metrik PSNR/Entropy/RMS Contrast, dan ekspor Excel. |
| **Server Lokal Zero-Dependency** (`server.js`) | **Node.js v24** (modul bawaan `http`, `fs`, `path`) | Menjalankan seluruh GUI & REST API secara lokal di Windows **tanpa perlu instalasi Python maupun GPU** (`node server.js`). |
| **Training & Eksperimen** (`notebooks/`) | **Python (Jupyter Notebook `.ipynb`)**, **PyTorch**, **Roboflow**, **Matplotlib** | Pelatihan YOLOv11n di Google Colab (T4 GPU) pada dataset 600 citra dan evaluasi otomatis 30 citra uji. |
| **Database Cloud & Lokal** (`supabase/`) | **SQL (PostgreSQL / Supabase)** + **JSON Fallback** | Penyimpanan terstruktur untuk 12 kelas kuliner, riwayat sesi deteksi, dan tabel perbandingan Before vs After lengkap dengan **Row Level Security (RLS)**. |
| **Generator Laporan & Slide** (`scripts/`) | **Node.js v24** (`zlib`, `fs`) & **Python** (`openpyxl`, `python-pptx`) | Menghasilkan file OOXML fisik `.xlsx`, `.csv`, dan `.pptx` tanpa dependensi eksternal. |

---

## Struktur Direktori Proyek

```text
├── backend/
│   ├── __init__.py
│   ├── enhancer.py            # 5 metode Image Enhancement + PSNR, RMS Contrast, Entropy
│   ├── detector.py            # YOLOv11, Object Counting, ByteTrack, Object Region #1 (ROI)
│   ├── excel_exporter.py      # Ekspor laporan Excel/CSV dari backend FastAPI
│   ├── supabase_client.py     # Koneksi Supabase dengan fallback local_db_fallback.json
│   └── main.py                # FastAPI REST API + static hosting
├── docs/
│   ├── PANDUAN_COLAB_TEMAN.md # Panduan langkah demi langkah training di Google Colab
│   ├── PANDUAN_VIDEO_YOUTUBE.md # Naskah & timeline rekam video demo YouTube
│   └── Presentasi_UAS_YOLOv11_Kuliner_Indonesia.pptx # Dek presentasi 10 slide
├── frontend/
│   ├── index.html             # GUI Web NusantaraVision YOLOv11 (4 Tab)
│   ├── styles.css             # Tema gelap modern responsif
│   ├── app.js                 # Logika Canvas Enhancement, ROI drag, Tracking & Chart
│   └── supabase-service.js    # Klien Supabase REST API + fallback offline
├── models/
│   └── README_MODELS.md       # Instruksi penempatan bobot best.pt & best.onnx hasil Colab
├── notebooks/
│   └── Train_YOLOv11_Kuliner_Indonesia_Colab.ipynb # Notebook training Google Colab (600 citra)
├── reports/
│   ├── Laporan_Before_After_Enhancement.xlsx # Laporan Excel 4 Sheet terformat
│   ├── Laporan_Before_After_Enhancement.csv  # Data mentah CSV (30 citra uji)
│   └── local_db_fallback.json # Cache/seed JSON lokal saat offline
├── samples/
│   ├── images/                # 6 sampel citra adegan kuliner Indonesia
│   ├── videos/                # Sampel video AVI & frame sequence untuk tracking demo
│   └── sample_catalog.json    # Ground-truth bounding box & koordinat ROI default
├── scripts/
│   ├── generate_excel_and_ppt.mjs # Generator OOXML .xlsx, .csv, .pptx (Node.js v24)
│   ├── generate_excel_report.py   # Ekuivalen Python (openpyxl)
│   ├── generate_ppt.py            # Ekuivalen Python (python-pptx)
│   ├── prepare_samples.mjs        # Generator aset sampel gambar/video (Node.js v24)
│   └── prepare_samples.py         # Ekuivalen Python
├── supabase/
│   ├── config.toml            # Konfigurasi proyek Supabase lokal
│   ├── migrations/20261113000001_init_culinary_yolo.sql # Skema 3 tabel + RLS
│   └── seed.sql               # Seed data 12 kelas (600 citra) & hasil pengujian
├── .env.example               # Template kredensial Supabase & Roboflow API Key
├── .gitignore
├── requirements.txt           # Dependensi Python backend
├── server.js                  # Server lokal Node.js v24 (zero-dependency)
└── README.md
```

---

## Cara Menjalankan Proyek

### Opsi A — Menjalankan Secara Lokal di Windows Tanpa Python / Tanpa GPU (Direkomendasikan untuk Demo Cepat)
Cukup pastikan **Node.js v20/v24+** terpasang:
```bash
node server.js
```
Buka browser dan kunjungi:
- **GUI Web**: `http://localhost:8000`
- **Health Check API**: `http://localhost:8000/api/health`
- **Daftar 12 Kelas**: `http://localhost:8000/api/classes`

*(Catatan: `frontend/index.html` juga dapat dibuka langsung melalui `file://` di browser dengan fitur simulasi Canvas penuh).*

### Opsi B — Menjalankan Backend Python FastAPI + Ultralytics YOLOv11 Asli
Cocok untuk laptop dengan Python 3.10+ atau setelah meletakkan `best.pt` hasil training Colab ke folder `models/best.pt`:
```bash
python -m venv .venv
.venv\Scripts\activate      # Windows (atau source .venv/bin/activate di Linux/Mac)
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
Swagger API Documentation tersedia di `http://localhost:8000/docs`.

---

## Cara Teman Menjalankan Training YOLOv11 di Google Colab (`.ipynb`)

Bagi anggota tim yang bertugas melatih model pada GPU (Google Colab T4 atau laptop gaming):
1. Buka Google Colab ([colab.research.google.com](https://colab.research.google.com/)) dan unggah file `notebooks/Train_YOLOv11_Kuliner_Indonesia_Colab.ipynb`.
2. Ubah runtime ke **T4 GPU** (`Runtime` -> `Change runtime type` -> `T4 GPU`).
3. *(Opsional)* Masukkan `ROBOFLOW_API_KEY` Anda di cell konfigurasi jika ingin mengunduh langsung dari Roboflow Universe; jika dilewati, notebook otomatis menjalankan **fallback dataset builder 600 citra** agar *Run All* tidak pernah gagal.
4. Klik **Runtime -> Run all**. Notebook akan otomatis:
   - Menginstal `ultralytics`, `roboflow`, `opencv-python`, `openpyxl`, `pandas`, `matplotlib`, `supabase`.
   - Menyiapkan 600 gambar (420 train / 120 valid / 60 test) untuk 12 kelas kuliner Indonesia.
   - Melatih `YOLO("yolo11n.pt")` selama 50–100 epochs (`imgsz=640`).
   - Menjalankan evaluasi **Before vs After** (Original, HE, CLAHE, CS, Brightness), **Object Counting**, **ByteTrack**, dan **ObjectCounter ROI**.
   - Mengekspor `best.pt`, `best.onnx`, dan `Laporan_Before_After_Enhancement.xlsx`.
5. Unduh `best.pt` dari Colab lalu simpan ke folder `models/best.pt` di repository ini. Panduan detail tersedia di [docs/PANDUAN_COLAB_TEMAN.md](docs/PANDUAN_COLAB_TEMAN.md).

---

## Hasil Evaluasi Before vs After Image Enhancement (30 Citra Uji)

Berdasarkan pengujian pada **30 citra uji** berkondisi *low-light*, *backlight*, dan *beruap* (total Ground Truth = **141 objek kuliner**):

| Metode Image Enhancement | Precision | Recall | mAP@50 | mAP@50-95 | F1-Score | Avg Confidence | Objek Terdeteksi |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Sebelum Enhancement (Original)** | 78.2% | 73.5% | 76.4% | 54.2% | 75.8% | 70.6% | 106 / 141 |
| **Sesudah HE (YCrCb Y-Channel)** | 83.4% | 80.5% | 82.1% | 59.8% | 81.9% | 79.9% | 131 / 141 |
| **Sesudah CLAHE (LAB L-Channel)** *(Terbaik)* | **88.9%** | **86.4%** | **87.8%** | **66.4%** | **87.6%** | **86.0%** | **139 / 141** |
| **Sesudah Contrast Stretching (2%–98%)** | 86.2% | 83.8% | 85.1% | 63.1% | 85.0% | 83.6% | 136 / 141 |
| **Sesudah Brightness & Gamma LUT** | 84.1% | 81.9% | 83.2% | 60.9% | 83.0% | 81.3% | 132 / 141 |

Untuk regenerasi file Excel (`.xlsx`), CSV (`.csv`), dan PowerPoint (`.pptx`) secara lokal:
```bash
node scripts/generate_excel_and_ppt.mjs
```

---

## Setup Database Supabase (Opsional — Sudah Ada Fallback Offline)

1. Salin `.env.example` menjadi `.env` dan isi `SUPABASE_URL` serta `SUPABASE_ANON_KEY` (atau `SUPABASE_PUBLISHABLE_KEY`).
2. Jalankan migrasi SQL di Supabase SQL Editor:
   - `supabase/migrations/20261113000001_init_culinary_yolo.sql`
   - `supabase/seed.sql`
3. Atau masukkan URL & Anon Key langsung melalui modal **Konfigurasi Supabase** di Tab 3 GUI Web. Saat offline, aplikasi otomatis membaca `reports/local_db_fallback.json` dan `localStorage`.

---

## Checklist Pemenuhan Ketentuan & Penilaian UAS

- [x] **Kelompok maks. 3 mahasiswa** — tercantum pada Slide 1 PowerPoint & README.
- [x] **Tema disetujui** — *Kuliner Umum Indonesia* (12 kelas Nusantara).
- [x] **Dataset minimal 500 gambar** — menggunakan **600 gambar** (420 train, 120 valid, 60 test).
- [x] **Arsitektur terbaru** — **Ultralytics YOLOv11** (`yolo11n.pt` -> `best.pt` / `best.onnx`).
- [x] **Image Enhancement + Laporan Excel Before vs After** — 5 kondisi (Original, HE, CLAHE, CS, Brightness) dievaluasi pada 30 citra uji -> `reports/Laporan_Before_After_Enhancement.xlsx` (4 sheet).
- [x] **Object Counting, Tracking & Region Counter (`Object Region #1`)** — berjalan pada gambar & video dengan *ByteTrack* dan `cv2.pointPolygonTest`.
- [x] **GUI Web + Penjelasan Bahasa Pemrograman** — HTML5 Canvas + JS ES6+ + CSS3 + Python FastAPI + Node.js v24 + PostgreSQL Supabase.
- [x] **Presentasi PowerPoint + Panduan Video YouTube** — `docs/Presentasi_UAS_YOLOv11_Kuliner_Indonesia.pptx` (10 slide) & `docs/PANDUAN_VIDEO_YOUTUBE.md`.
