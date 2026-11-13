# Panduan Menjalankan Training YOLOv11 Kuliner Indonesia di Google Colab / Laptop Gaming

Panduan ini disusun khusus agar teman satu tim dapat menjalankan seluruh proses **Download Dataset (600 citra, 12 kelas) -> Image Enhancement -> Training YOLOv11 -> Object Counting, ByteTrack Tracking, Region Counter -> Export `best.pt`, `best.onnx`, & `Laporan_Before_After_Enhancement.xlsx`** dengan mudah tanpa error.

---

## A. Persiapan Sebelum Menjalankan (Google Colab — Rekomendasi: GPU T4)

1. Buka [Google Colab](https://colab.research.google.com/).
2. Pilih menu **File -> Upload notebook**, lalu unggah file:
   - `notebooks/Train_YOLOv11_Kuliner_Indonesia_Colab.ipynb`
3. **Aktifkan GPU T4** (sangat penting agar training 60 epoch cepat, ~5–10 menit):
   - Klik menu **Runtime -> Change runtime type**.
   - Pada bagian **Hardware accelerator**, pilih **T4 GPU** lalu klik **Save**.
4. *(Opsional)* Mengatur **Roboflow API Key**:
   - Jika sudah memiliki akun Roboflow Universe dan API Key:
     - Klik ikon **Kunci (Secrets)** di panel kiri Google Colab.
     - Tambahkan Secret baru dengan nama `ROBOFLOW_API_KEY` dan isi dengan API Key Anda, lalu aktifkan *Notebook access*.
   - **Bagaimana jika tidak punya `ROBOFLOW_API_KEY`?**
     - Tidak masalah! Notebook sudah mendukung **`Dataset_Kuliner_Indonesia_YOLOv11.zip`** dari repositori/lokal (600 citra kurasi: **494 foto asli unik + 106 augmentasi tajam khusus train**, tepat **50 citra/kelas**, split **Train 420 / Valid 120 / Test 60**) plus **Fallback Dataset Builder Otomatis** sehingga **Run All tetap berjalan mulus tanpa crash**.

---

## B. Cara Menjalankan di Google Colab

1. Klik menu **Runtime -> Run all** (atau tekan `Ctrl + F9`).
2. Tunggu seluruh sel selesai dieksekusi secara berurutan:
   - **Sel 1–2**: Cek GPU T4 & install library (`ultralytics`, `roboflow`, `opencv-python`, `openpyxl`, `pandas`, `matplotlib`, `supabase`).
   - **Sel 3**: Menyiapkan dataset **600 citra** (`494` foto asli unik + `106` augmentasi train-only, `50` per kelas) dari `Dataset_Kuliner_Indonesia_YOLOv11.zip` / Roboflow Universe / Fallback Builder dengan split `70% train (420)`, `20% valid (120)`, `10% test (60)`.
   - **Sel 4**: Menerapkan **5 teknik Image Enhancement** (`Original`, `HE YCrCb`, `CLAHE LAB`, `Contrast Stretching 2–98%`, `Brightness & Contrast`) dan menampilkan grafik perbandingan Before vs After.
   - **Sel 5**: Melatih `YOLO("yolo11n.pt")` selama 60 epoch (`imgsz=640`) lalu menyimpan `models/best.pt` dan `models/best.onnx`.
   - **Sel 6**: Menjalankan **Object Counting**, **ByteTrack Tracking**, dan **Region Counter (`ultralytics.solutions.ObjectCounter` Polygon ROI)**.
   - **Sel 7**: Mengevaluasi gambar `test` Before vs After Enhancement dan membuat file **`Laporan_Before_After_Enhancement.xlsx`**.
   - **Sel 8**: Mengunduh otomatis file `best.pt`, `best.onnx`, dan `Laporan_Before_After_Enhancement.xlsx` ke komputer Anda.

---

## C. Cara Menjalankan di Laptop Gaming Lokal (NVIDIA RTX / Python 3.10+)

Jika dijalankan langsung di laptop lokal (misalnya dengan GPU NVIDIA RTX):

```bash
pip install ultralytics roboflow opencv-python openpyxl pandas matplotlib supabase jupyter
jupyter notebook notebooks/Train_YOLOv11_Kuliner_Indonesia_Colab.ipynb
```

Atau buka file `.ipynb` langsung di **VS Code** dengan ekstensi **Jupyter**, pilih kernel Python yang sudah terpasang CUDA/PyTorch, lalu klik **Run All**.

---

## D. Memasang `best.pt` ke Aplikasi Web Utama

Setelah proses download dari Google Colab selesai, salin file hasil training ke repositori proyek utama:

1. Pindahkan **`best.pt`** (dan opsional `best.onnx`) ke folder:
   ```text
   models/best.pt
   models/best.onnx
   ```
2. *(Opsional)* Pindahkan **`Laporan_Before_After_Enhancement.xlsx`** ke folder:
   ```text
   reports/Laporan_Before_After_Enhancement.xlsx
   ```
3. Lihat [README_MODELS.md](../models/README_MODELS.md) untuk detail verifikasi model dan daftar 12 kelas.

---

## E. Troubleshooting Singkat

| Kendala | Penyebab | Solusi |
| :--- | :--- | :--- |
| Training sangat lambat | Runtime masih memakai CPU | Ubah ke **T4 GPU** di `Runtime -> Change runtime type` |
| `OutOfMemoryError` (CUDA OOM) | Batch size terlalu besar untuk GPU | Ubah `BATCH = 8` pada Sel 5 |
| Download Roboflow gagal / 401 | API Key salah atau belum diset | Kosongkan `ROBOFLOW_API_KEY`; Fallback Dataset Builder 600 citra akan aktif otomatis |
| Download otomatis browser diblokir di Sel 8 | Pop-up blocker Chrome | Izinkan download multi-file, atau unduh manual dari panel *Files* di sebelah kiri Colab |
