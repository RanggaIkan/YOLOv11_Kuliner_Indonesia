# Folder Model YOLOv11 (`models/`)

Folder ini menyimpan bobot model hasil training dari Google Colab (`notebooks/Train_YOLOv11_Kuliner_Indonesia_Colab.ipynb`).

## File yang Ditempatkan di Sini

| Nama File | Keterangan | Status |
| :--- | :--- | :--- |
| `best.pt` | Bobot terbaik PyTorch YOLOv11 hasil training 12 kelas Kuliner Indonesia | Diletakkan setelah download dari Colab |
| `best.onnx` | Model hasil ekspor ONNX (`imgsz=640`) untuk inferensi lintas platform | Opsional (dihasilkan otomatis di Colab) |

## Mekanisme Fallback Otomatis Backend

- Backend Python (`backend/detector.py`) akan mencari `models/best.pt` terlebih dahulu.
- Jika `models/best.pt` belum ada, sistem otomatis melakukan fallback ke model dasar `YOLO("yolo11n.pt")` (atau mode simulasi lokal pada `node server.js` apabila dijalankan di Windows tanpa Python/GPU) sehingga aplikasi web tetap berjalan tanpa error.

## Daftar 12 Kelas Model (`nc = 12`)

| ID | Nama Kelas | Kategori |
| :---: | :--- | :--- |
| 0 | `Nasi Goreng` | Makanan Pokok |
| 1 | `Bakso` | Berkuah |
| 2 | `Sate Ayam` | Panggang |
| 3 | `Rendang` | Lauk Utama |
| 4 | `Soto Ayam` | Berkuah |
| 5 | `Ayam Goreng` | Lauk Utama |
| 6 | `Mie Goreng` | Makanan Pokok |
| 7 | `Tempe Goreng` | Lauk Pendamping |
| 8 | `Tahu Goreng` | Lauk Pendamping |
| 9 | `Gado-Gado` | Sayuran |
| 10 | `Pempek` | Kudapan |
| 11 | `Telur Balado` | Lauk Pendamping |

## Cara Mendapatkan `best.pt`

Ikuti panduan lengkap pada [docs/PANDUAN_COLAB_TEMAN.md](../docs/PANDUAN_COLAB_TEMAN.md) untuk menjalankan notebook di Google Colab (T4 GPU) dan mengunduh `best.pt` ke folder ini.
