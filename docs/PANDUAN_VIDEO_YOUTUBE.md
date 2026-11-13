# Panduan Rekam & Naskah Video Demo YouTube (UAS Deep Learning)

Dokumen ini berisi panduan lengkap dan naskah (*script*) untuk merekam video presentasi & demo aplikasi **NusantaraVision YOLOv11 — Kuliner Umum Indonesia** untuk diunggah ke YouTube (durasi ideal **5–7 menit**).

---

## Persiapan Sebelum Merekam
1. Pastikan aplikasi web sudah berjalan di browser:
   - Jalankan `node server.js` di terminal, lalu buka `http://localhost:8000` (atau `uvicorn backend.main:app --port 8000` jika menggunakan Python).
2. Siapkan 4 jendela/tab yang rapi:
   - **Tab 1**: Presentasi `docs/Presentasi_UAS_YOLOv11_Kuliner_Indonesia.pptx` (Slide 1–10).
   - **Tab 2**: GUI Web **NusantaraVision YOLOv11** (`http://localhost:8000`).
   - **Tab 3**: Notebook Google Colab `notebooks/Train_YOLOv11_Kuliner_Indonesia_Colab.ipynb`.
   - **Tab 4**: Laporan Excel `reports/Laporan_Before_After_Enhancement.xlsx` (4 Sheet).
3. Gunakan OBS Studio / Zoom / Windows Game Bar (`Win + G`) dengan resolusi 1080p dan mikrofon yang jelas.

---

## Timeline & Naskah Rekaman (5–7 Menit)

### [00:00 – 00:45] Segmen 1: Pembukaan, Anggota Kelompok & Tema (Slide 1–2)
- Tampilkan **Slide 1** PowerPoint.
- **Narasi**:
  > "Selamat pagi/siang/sore Bapak/Ibu Dosen dan teman-teman. Kami dari kelompok [Nama Kelompok], Program Studi Teknik Informatika UKSW, beranggotakan [Nama 1], [Nama 2], dan [Nama 3]. Pada kesempatan UAS Deep Learning kali ini, kami mempresentasikan proyek deteksi dan klasifikasi objek bertema **Kuliner Umum Indonesia** menggunakan **YOLOv11** yang dilengkapi **Image Enhancement**, **Object Counting**, **ByteTrack Tracking**, serta **Region Counter (Object Region #1)**."
- Pindah ke **Slide 2**: jelaskan 12 kelas kuliner (*Nasi Goreng, Bakso, Sate Ayam, Rendang, Soto Ayam, Ayam Goreng, Mie Goreng, Tempe Goreng, Tahu Goreng, Gado-Gado, Pempek, Telur Balado*) serta tantangan pencahayaan redup warung malam, uap makanan panas, dan tumpukan lauk prasmanan.

### [00:45 – 02:00] Segmen 2: Dataset 600 Gambar & Training YOLOv11 di Google Colab (Slide 3–4 + Colab)
- Tampilkan **Slide 3–4**, lalu tunjukkan **Google Colab** (`Train_YOLOv11_Kuliner_Indonesia_Colab.ipynb`).
- **Narasi**:
  > "Untuk memenuhi ketentuan minimal 500 gambar, kami menyiapkan **600 gambar** beranotasi saliency format YOLOv11 (`50` citra per kelas untuk 12 kelas) yang dibagi menjadi **420 train (70% — 314 foto asli unik + 106 augmentasi tajam khusus train)**, **120 valid (20% — 100% foto asli)**, dan **60 test (10% — 100% foto asli)** dengan total **494 foto asli unik** beserta opsi unduh dari Roboflow Universe atau `Dataset_Kuliner_Indonesia_YOLOv11.zip`. Model dilatih menggunakan **YOLOv11n** selama 50–100 epoch (`imgsz=640`) di GPU T4 Google Colab, menghasilkan bobot `best.pt` dan `best.onnx`."

### [02:00 – 04:15] Segmen 3: Live Demo GUI Web — Image Enhancement, Counting, Tracking & ROI (GUI Tab 1 & 2)
- Buka **GUI Web NusantaraVision YOLOv11 (Light Editorial Workbench)** (`http://localhost:8000`).
- **Langkah Demo di GUI (Tab 1 - Deteksi Gambar & Video + ROI)**:
  1. Pilih salah satu dari **13 foto nyata kuliner** (misal **Prasmanan Kuliner**, **Rendang**, atau **Nasi Goreng Spesial**), atau unggah foto makanan sendiri.
  2. Tunjukkan kondisi **Original (Before)** terlebih dahulu — sorot confidence score dan objek yang masih terlewat.
  3. Aktifkan **Image Enhancement** satu per satu: **HE**, **CLAHE (LAB L-Channel)**, **Contrast Stretching**, dan **Brightness/Gamma**. Tunjukkan perubahan histogram luminansi secara real-time dan peningkatan confidence score.
  4. Geser / ubah ukuran kotak **Object Region #1 (ROI)** atau klik preset (*Piring Utama* / *Zona Kasir*), lalu tunjukkan angka **Total Detected**, **Inside Region #1**, dan **Outside Region** berubah dinamis.
  5. Ganti ke **Sampel Video** (`prasmanan_tracking_demo.avi` / `antrean_kantin_demo.avi` resolusi **960x540**, 16 frame photorealistic), aktifkan mode **Multi-Object Tracking (ByteTrack)** untuk memperlihatkan ID tracking (`#1`, `#2`, `#3`) dan jejak lintasan (*motion trail*) melintasi Object Region #1.
- Pindah ke **Tab 2 (Evaluasi Before vs After)** untuk menunjukkan perbandingan 5 metode berdampingan dan tombol ekspor CSV/Excel.

### [04:15 – 05:30] Segmen 4: Penjelasan Bahasa Pemrograman, Backend & Supabase (Slide 7–8 + GUI Tab 3 & 4)
- **Wajib dijawab sesuai rubrik dosen**: *"Ada GUI, dijelaskan pakai bahasa pemrograman apa?"*
- Buka **GUI Tab 3 & Tab 4** (atau **Slide 7–8**).
- **Narasi**:
  > "GUI web ini dibangun menggunakan **HTML5 Canvas, CSS3, dan JavaScript (ES6+)** untuk manipulasi piksel *ImageData* dan interaksi ROI secara real-time di browser. Pada sisi backend AI dan pemrosesan citra, kami menggunakan **Python 3** dengan framework **FastAPI**, **OpenCV** (`cv2`), **Ultralytics YOLOv11**, dan **OpenPyXL**, serta menyediakan server lokal zero-dependency berbasis **Node.js v24** (`server.js`) agar aplikasi tetap dapat berjalan di komputer tanpa GPU. Untuk penyimpanan log deteksi dan hasil komparasi, kami menggunakan database **PostgreSQL pada Supabase** dengan kebijakan Row Level Security (RLS) dan fallback JSON lokal."

### [05:30 – 06:30] Segmen 5: Laporan Excel Before vs After & Penutup (Excel + Slide 9–10)
- Buka `reports/Laporan_Before_After_Enhancement.xlsx` di Microsoft Excel / LibreOffice Calc.
- Tunjukkan keempat sheet:
  1. `Ringkasan_Eksekutif`: Lonjakan mAP@50 dari **76.4% (Original)** menjadi **87.8% (CLAHE)** (+11.4%) dan rata-rata confidence naik **+15.4%**.
  2. `Detail_Before_vs_After_30_Uji`: 30 citra uji lengkap dengan nilai PSNR (dB) dan rumus `SUM/AVERAGE`.
  3. `Evaluasi_Counting_Tracking_ROI`: Akurasi Object Region #1 mencapai **92.9%–100%** di kecepatan **>30 FPS**.
  4. `Dataset_600_Kuliner_Indonesia`: Distribusi tepat **600 gambar** across 12 kelas.
- Tampilkan **Slide 10**, sebutkan tautan GitHub repository, lalu tutup presentasi.

---

## Checklist Sebelum Upload ke YouTube
- [ ] Suara narasi jernih dan layar GUI/Excel terlihat jelas (minimal 720p/1080p).
- [ ] Semua anggota kelompok (maks. 3 orang) disebutkan di awal video.
- [ ] Bahasa pemrograman GUI & backend dijelaskan secara eksplisit.
- [ ] Demo **Before vs After Image Enhancement**, **Object Counting**, **Tracking**, dan **Object Region #1 (ROI)** tampil lengkap.
- [ ] Salin link YouTube hasil upload ke **Slide 10** PowerPoint dan bagian paling bawah `README.md`.
