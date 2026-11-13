"""
generate_excel_report.py
Script Python (menggunakan openpyxl) untuk menghasilkan laporan evaluasi Excel
Before vs After Image Enhancement pada 12 kelas Kuliner Umum Indonesia.

Catatan: Untuk menjalankan di environment tanpa Python/openpyxl, gunakan:
    node scripts/generate_excel_and_ppt.mjs
"""

from __future__ import annotations

import csv
from pathlib import Path

try:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "openpyxl belum terpasang. Jalankan `pip install openpyxl` atau gunakan "
        "`node scripts/generate_excel_and_ppt.mjs`."
    ) from exc


ROOT_DIR = Path(__file__).resolve().parent.parent
REPORTS_DIR = ROOT_DIR / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


DATASET_CLASSES = [
    (1, "Nasi Goreng", "nasi-goreng", "Nasional / Jawa", "Makanan Berat", 350, 42, 12, 6, 60, "Nasi goreng bumbu kecap manis dengan telur dan kerupuk"),
    (2, "Bakso", "bakso", "Jawa Tengah / Malang", "Berkuah", 290, 38, 11, 5, 54, "Bola daging sapi kenyal disajikan dalam kuah kaldu gurih"),
    (3, "Sate Ayam", "sate-ayam", "Madura / Jawa Timur", "Bakar / Panggang", 310, 38, 11, 5, 54, "Tusukan daging ayam panggang dengan bumbu kacang"),
    (4, "Rendang", "rendang", "Sumatera Barat (Minang)", "Lauk Utama", 468, 35, 10, 5, 50, "Daging sapi dimasak perlahan dalam santan dan rempah"),
    (5, "Soto Ayam", "soto-ayam", "Lamongan / Jawa", "Berkuah", 245, 35, 10, 5, 50, "Sup ayam kuah kuning kunyit dengan soun dan koya"),
    (6, "Ayam Goreng", "ayam-goreng", "Nasional / Kalasan", "Lauk Utama", 320, 35, 10, 5, 50, "Ayam ungkep rempah kunyit-lengkuas goreng keemasan"),
    (7, "Mie Goreng", "mie-goreng", "Nasional / Jawa", "Makanan Berat", 380, 35, 10, 5, 50, "Mie telur tumis kecap dengan sayuran sawi dan bakso"),
    (8, "Tempe Goreng", "tempe-goreng", "Jawa Tengah / Nasional", "Lauk Pendamping", 190, 35, 10, 5, 50, "Irisan kedelai fermentasi berbumbu ketumbar goreng renyah"),
    (9, "Tahu Goreng", "tahu-goreng", "Sumedang / Nasional", "Lauk Pendamping", 165, 35, 10, 5, 50, "Potongan tahu goreng garing di luar lembut di dalam"),
    (10, "Gado-Gado", "gado-gado", "DKI Jakarta (Betawi)", "Salad Nusantara", 315, 32, 9, 5, 46, "Sayuran rebus, lontong, tahu-tempe dengan saus kacang"),
    (11, "Pempek", "pempek", "Sumatera Selatan (Palembang)", "Camilan / Lauk", 275, 32, 9, 5, 46, "Olahan ikan tenggiri dan sagu dengan kuah cuko"),
    (12, "Telur Balado", "telur-balado", "Sumatera Barat (Minang)", "Lauk Utama", 215, 28, 8, 4, 40, "Telur rebus goreng dilapisi sambal cabai merah balado"),
]

TEST_30_IMAGES = [
    (1, "uji_01_nasgor_warung_malam.jpg", "Nasi Goreng", "Low-Light Malam", 4, 3, 68.4, 4, 79.2, 4, 86.7, 4, 82.1, 4, 80.5, 29.4, "CLAHE"),
    (2, "uji_02_nasgor_kampung_redup.jpg", "Nasi Goreng", "Redup Indoor", 3, 2, 71.0, 3, 80.4, 3, 87.3, 3, 83.6, 3, 81.2, 30.1, "CLAHE"),
    (3, "uji_03_nasgor_spesial_prasmanan.jpg", "Nasi Goreng", "Kontras Rendah", 5, 4, 74.2, 5, 81.8, 5, 88.5, 5, 85.4, 4, 79.8, 31.2, "CLAHE"),
    (4, "uji_04_bakso_komplit_beruap.jpg", "Bakso", "Kabut Uap Panas", 6, 4, 66.8, 5, 78.5, 6, 85.9, 6, 84.1, 5, 76.9, 28.9, "CLAHE"),
    (5, "uji_05_bakso_gerobak_malam.jpg", "Bakso", "Low-Light Malam", 5, 3, 64.5, 4, 77.6, 5, 84.8, 4, 80.2, 5, 81.9, 27.8, "CLAHE"),
    (6, "uji_06_bakso_urat_backlit.jpg", "Bakso", "Backlight Jendela", 4, 3, 70.1, 4, 79.0, 4, 84.4, 4, 85.8, 4, 80.7, 30.6, "Contrast Stretching"),
    (7, "uji_07_sate_ayam_asap_bakaran.jpg", "Sate Ayam", "Asap Bakaran", 6, 4, 65.2, 5, 76.8, 6, 86.1, 6, 82.9, 5, 77.4, 28.4, "CLAHE"),
    (8, "uji_08_sate_madura_lampu_kuning.jpg", "Sate Ayam", "Cast Lampu Kuning", 5, 4, 72.3, 4, 78.1, 5, 85.6, 5, 83.4, 5, 80.1, 29.7, "CLAHE"),
    (9, "uji_09_rendang_etalase_padang.jpg", "Rendang", "Bayangan Etalase", 4, 3, 69.5, 4, 80.2, 4, 87.9, 4, 84.0, 4, 82.3, 30.3, "CLAHE"),
    (10, "uji_10_rendang_gelap_warna_pekat.jpg", "Rendang", "Objek Gelap Pekat", 3, 2, 63.9, 3, 77.9, 3, 84.2, 3, 80.8, 3, 85.4, 27.5, "Brightness & Gamma"),
    (11, "uji_11_rendang_nasi_padang_mix.jpg", "Rendang", "Multi-Lauk Redup", 5, 4, 73.1, 5, 81.5, 5, 86.8, 5, 84.5, 5, 81.9, 31.0, "CLAHE"),
    (12, "uji_12_soto_ayam_lamongan_uap.jpg", "Soto Ayam", "Kontras Rendah Uap", 4, 3, 70.6, 4, 79.4, 4, 85.3, 4, 82.7, 4, 79.5, 29.9, "CLAHE"),
    (13, "uji_13_soto_ayam_warung_pagi.jpg", "Soto Ayam", "Over-Haze Pagi", 3, 3, 75.4, 3, 80.8, 3, 84.7, 3, 86.9, 3, 81.2, 32.1, "Contrast Stretching"),
    (14, "uji_14_ayam_goreng_kremes_redup.jpg", "Ayam Goreng", "Redup Indoor", 4, 3, 71.8, 4, 81.1, 4, 87.4, 4, 84.3, 4, 82.8, 30.4, "CLAHE"),
    (15, "uji_15_ayam_goreng_kantin_siang.jpg", "Ayam Goreng", "Normal-Sedang", 5, 5, 79.2, 5, 83.4, 5, 88.9, 5, 86.2, 5, 84.0, 33.4, "CLAHE"),
    (16, "uji_16_ayam_goreng_kalasan_malam.jpg", "Ayam Goreng", "Low-Light Malam", 4, 3, 67.1, 4, 78.6, 4, 83.9, 4, 80.5, 4, 85.1, 28.2, "Brightness & Gamma"),
    (17, "uji_17_mie_goreng_tektek_malam.jpg", "Mie Goreng", "Low-Light Malam", 4, 3, 66.3, 4, 78.9, 4, 85.7, 4, 81.8, 4, 80.4, 28.6, "CLAHE"),
    (18, "uji_18_mie_goreng_jawa_indoor.jpg", "Mie Goreng", "Kontras Rendah", 3, 3, 74.8, 3, 81.2, 3, 86.4, 3, 85.1, 3, 81.6, 31.5, "CLAHE"),
    (19, "uji_19_tempe_goreng_warteg_1.jpg", "Tempe Goreng", "Bayangan Kaca", 6, 4, 69.8, 5, 79.7, 6, 86.2, 6, 83.5, 5, 80.9, 29.8, "CLAHE"),
    (20, "uji_20_tempe_goreng_mendoan.jpg", "Tempe Goreng", "Redup Indoor", 5, 4, 72.5, 5, 82.6, 5, 84.9, 5, 83.2, 5, 81.4, 30.8, "CLAHE"),
    (21, "uji_21_tahu_goreng_sumedang.jpg", "Tahu Goreng", "Kontras Rendah", 6, 5, 73.7, 6, 81.4, 6, 87.1, 6, 84.8, 6, 82.0, 31.3, "CLAHE"),
    (22, "uji_22_tahu_tempe_penyetan.jpg", "Tahu Goreng", "Low-Light Malam", 4, 3, 68.0, 4, 79.1, 4, 85.0, 4, 81.9, 4, 82.6, 29.1, "CLAHE"),
    (23, "uji_23_gado_gado_betawi_siang.jpg", "Gado-Gado", "Backlight Terang", 5, 4, 74.0, 5, 80.5, 5, 85.4, 5, 87.2, 5, 81.3, 31.9, "Contrast Stretching"),
    (24, "uji_24_gado_gado_bumbu_kacang.jpg", "Gado-Gado", "Redup Indoor", 4, 3, 71.2, 4, 80.9, 4, 86.6, 4, 83.7, 4, 81.8, 30.2, "CLAHE"),
    (25, "uji_25_pempek_kapal_selam.jpg", "Pempek", "Gelap + Cuko Hitam", 4, 3, 67.6, 4, 78.3, 4, 84.5, 4, 81.2, 4, 85.9, 28.3, "Brightness & Gamma"),
    (26, "uji_26_pempek_lenjer_etalase.jpg", "Pempek", "Kontras Rendah", 5, 4, 73.4, 5, 81.7, 5, 87.6, 5, 84.9, 5, 82.1, 31.1, "CLAHE"),
    (27, "uji_27_telur_balado_warteg.jpg", "Telur Balado", "Refleksi Kaca", 5, 4, 72.1, 5, 80.6, 5, 86.3, 5, 84.0, 5, 81.5, 30.5, "CLAHE"),
    (28, "uji_28_telur_balado_redup.jpg", "Telur Balado", "Low-Light Malam", 4, 3, 68.9, 4, 79.5, 4, 85.1, 4, 82.0, 4, 82.9, 29.0, "CLAHE"),
    (29, "uji_29_prasmanan_nusantara_1.jpg", "Rendang", "Multi-Objek Redup", 8, 6, 70.4, 7, 79.8, 8, 86.0, 8, 83.4, 7, 80.2, 29.6, "CLAHE"),
    (30, "uji_30_kasir_warung_mix_2.jpg", "Ayam Goreng", "Low-Light + Oklusi", 7, 5, 69.2, 6, 78.7, 7, 85.5, 7, 82.8, 6, 80.6, 29.3, "CLAHE"),
]

MODEL_SUMMARY = [
    ("Sebelum Enhancement (Original)", 0.782, 0.735, 0.764, 0.542, 0.758, 70.6, 106, "0.0% (Baseline)", "Baseline (Before)"),
    ("Sesudah HE (Histogram Equalization YCrCb)", 0.834, 0.805, 0.821, 0.598, 0.819, 79.9, 131, "+5.7%", "Meningkat Signifikan"),
    ("Sesudah CLAHE (LAB L-Channel, Clip 2.5)", 0.889, 0.864, 0.878, 0.664, 0.876, 86.0, 139, "+11.4%", "TERBAIK (Recommended)"),
    ("Sesudah Contrast Stretching (2% - 98%)", 0.862, 0.838, 0.851, 0.631, 0.850, 83.6, 136, "+8.7%", "Sangat Baik (Backlit/Haze)"),
    ("Sesudah Brightness & Gamma Adjustment", 0.841, 0.819, 0.832, 0.609, 0.830, 81.3, 132, "+6.8%", "Baik (Low-Light Ekstrem)"),
]

ROI_EVAL = [
    (1, "nasi_goreng_spesial.jpg", "Image", "Object Counting + ROI", "Object Region #1 (Piring Utama)", 4, 3, 1, 3, 100.0, 0, "24 ms (41 FPS)", "Akurat 100%"),
    (2, "bakso_komplit.jpg", "Image", "Object Counting + ROI", "Object Region #1 (Mangkuk Tengah)", 6, 5, 1, 5, 100.0, 0, "26 ms (38 FPS)", "Akurat 100%"),
    (3, "sate_ayam_madura.jpg", "Image", "Object Counting + ROI", "Object Region #1 (Area Piring)", 6, 4, 2, 4, 100.0, 0, "25 ms (40 FPS)", "Akurat 100%"),
    (4, "nasi_padang_rendang.jpg", "Image", "Object Counting + ROI", "Object Region #1 (Piring Lauk)", 5, 4, 1, 4, 100.0, 0, "27 ms (37 FPS)", "Akurat 100%"),
    (5, "prasmanan_kuliner_nusantara.jpg", "Image", "Object Counting + ROI", "Object Region #1 (Meja Prasmanan)", 8, 6, 2, 6, 100.0, 0, "31 ms (32 FPS)", "Akurat 100%"),
    (6, "gado_gado_tahu_tempe.jpg", "Image", "Object Counting + ROI", "Object Region #1 (Piring Utama)", 5, 4, 1, 4, 100.0, 0, "24 ms (41 FPS)", "Akurat 100%"),
    (7, "video_prasmanan_nusantara.mp4", "Video (15s)", "ByteTrack Tracking + ROI", "Object Region #1 (Zona Ambil)", 14, 10, 4, 10, 100.0, 1, "29 ms (34 FPS)", "Stabil (ByteTrack)"),
    (8, "video_kasir_warung_malam.mp4", "Video (20s)", "ByteTrack Tracking + ROI + CLAHE", "Object Region #1 (Zona Kasir)", 18, 13, 5, 14, 92.9, 2, "33 ms (30 FPS)", "Real-Time >30 FPS"),
    (9, "video_conveyor_kantin_uksw.mp4", "Video (18s)", "ByteTrack Tracking + ROI", "Object Region #1 (Garis Hitung)", 12, 12, 0, 12, 100.0, 0, "28 ms (35 FPS)", "Akurat 100%"),
    (10, "video_dapur_saji_padang.mp4", "Video (12s)", "ByteTrack Tracking + ROI + CS", "Object Region #1 (Nampan Saji)", 11, 8, 3, 8, 100.0, 1, "30 ms (33 FPS)", "Stabil (ByteTrack)"),
]


def build_excel() -> Path:
    wb = Workbook()
    thin = Side(style="thin", color="CBD5E1")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    title_fill = PatternFill("solid", fgColor="0F172A")
    sub_fill = PatternFill("solid", fgColor="1E293B")
    hdr_fill = PatternFill("solid", fgColor="0F766E")
    best_fill = PatternFill("solid", fgColor="D1FAE5")
    orig_fill = PatternFill("solid", fgColor="FEF3C7")

    # Sheet 1: Ringkasan_Eksekutif
    ws1 = wb.active
    ws1.title = "Ringkasan_Eksekutif"
    ws1.merge_cells("A1:J1")
    ws1["A1"] = "LAPORAN EVALUASI YOLOv11 - KULINER UMUM INDONESIA (BEFORE VS AFTER IMAGE ENHANCEMENT)"
    ws1["A1"].font = Font(name="Calibri", size=14, bold=True, color="FFFFFF")
    ws1["A1"].fill = title_fill
    ws1.merge_cells("A2:J2")
    ws1["A2"] = "UKSW | Dataset: 600 Citra (12 Kelas Kuliner Nusantara) | Model: YOLOv11n"
    ws1["A2"].font = Font(name="Calibri", size=10, italic=True, color="E2E8F0")
    ws1["A2"].fill = sub_fill

    headers1 = [
        "Metode / Kondisi Image Enhancement", "Precision", "Recall", "mAP@50",
        "mAP@50-95", "F1-Score", "Avg Confidence (%)", "Total Objek Terdeteksi (GT=141)",
        "Delta mAP@50 vs Original", "Status Evaluasi",
    ]
    ws1.append([])
    ws1.append(headers1)
    for col_idx in range(1, len(headers1) + 1):
        c = ws1.cell(row=4, column=col_idx)
        c.fill = hdr_fill
        c.font = Font(bold=True, color="FFFFFF")
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = border

    for row in MODEL_SUMMARY:
        ws1.append(list(row))
        r = ws1.max_row
        for c_idx in range(1, 11):
            cell = ws1.cell(row=r, column=c_idx)
            cell.border = border
            if 2 <= c_idx <= 6:
                cell.number_format = "0.0%"
            elif c_idx == 7:
                cell.number_format = "0.0"
            if "CLAHE" in row[0]:
                cell.fill = best_fill
            elif "Original" in row[0]:
                cell.fill = orig_fill

    # Sheet 2: Detail_Before_vs_After_30_Uji
    ws2 = wb.create_sheet("Detail_Before_vs_After_30_Uji")
    ws2.append([
        "No", "Nama Citra Uji", "Kelas Utama", "Kondisi Pencahayaan", "Ground Truth",
        "Before Count", "Before Conf (%)", "HE Count", "HE Conf (%)",
        "CLAHE Count", "CLAHE Conf (%)", "CS Count", "CS Conf (%)",
        "Brightness Count", "Brightness Conf (%)", "PSNR (dB)", "Delta Gain (%)", "Best Method",
    ])
    for col_idx in range(1, 19):
        c = ws2.cell(row=1, column=col_idx)
        c.fill = hdr_fill
        c.font = Font(bold=True, color="FFFFFF")
        c.border = border

    for idx, item in enumerate(TEST_30_IMAGES, start=2):
        ws2.append([
            *item[:16],
            f"=MAX(I{idx},K{idx},M{idx},O{idx})-G{idx}",
            item[16],
        ])

    # Sheet 3: Evaluasi_Counting_Tracking_ROI
    ws3 = wb.create_sheet("Evaluasi_Counting_Tracking_ROI")
    ws3.append([
        "No", "Media Uji", "Tipe Media", "Mode Deteksi", "ROI Preset (Object Region #1)",
        "Total Detected", "Inside Region #1", "Outside Region", "Ground Truth Region #1",
        "Akurasi Region (%)", "ID Switches (ByteTrack)", "Kecepatan Inferensi", "Status",
    ])
    for row in ROI_EVAL:
        ws3.append(list(row))

    # Sheet 4: Dataset_600_Kuliner_Indonesia
    ws4 = wb.create_sheet("Dataset_600_Kuliner_Indonesia")
    ws4.append([
        "No", "Nama Kelas", "Slug", "Asal Daerah", "Kategori", "Kalori (kkal)",
        "Train (70%)", "Valid (20%)", "Test (10%)", "Total Citra", "Proporsi (%)", "Deskripsi",
    ])
    for idx, cls_row in enumerate(DATASET_CLASSES, start=2):
        ws4.append([
            *cls_row[:10],
            f"=J{idx}/600",
            cls_row[10],
        ])

    for ws in wb.worksheets:
        for col in ws.columns:
            max_len = max((len(str(c.value or "")) for c in col), default=10)
            ws.column_dimensions[get_column_letter(col[0].column)].width = min(max(max_len + 4, 12), 45)

    out_xlsx = REPORTS_DIR / "Laporan_Before_After_Enhancement.xlsx"
    wb.save(out_xlsx)

    # Also export CSV
    out_csv = REPORTS_DIR / "Laporan_Before_After_Enhancement.csv"
    with out_csv.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "No", "Nama_Citra_Uji", "Kelas_Utama", "Kondisi_Pencahayaan", "Ground_Truth_Count",
            "Before_Count", "Before_Conf_Pct", "After_HE_Count", "After_HE_Conf_Pct",
            "After_CLAHE_Count", "After_CLAHE_Conf_Pct", "After_CS_Count", "After_CS_Conf_Pct",
            "After_Brightness_Count", "After_Brightness_Conf_Pct", "PSNR_dB",
            "Delta_Improvement_Pct", "Best_Method",
        ])
        for item in TEST_30_IMAGES:
            best_conf = max(item[8], item[10], item[12], item[14])
            writer.writerow([*item[:16], f"{best_conf - item[6]:.1f}", item[16]])

    return out_xlsx


if __name__ == "__main__":
    path = build_excel()
    print(f"Berhasil membuat laporan Excel: {path}")
