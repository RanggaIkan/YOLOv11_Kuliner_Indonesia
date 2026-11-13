-- ============================================================================
-- Seed Data: NusantaraVision YOLOv11 - Deteksi Kuliner Umum Indonesia
-- 12 Indonesian Culinary Classes (total = 600 dataset images)
-- 8 Detection Sessions (image & video, counting & tracking)
-- 15 Before vs After Image Enhancement Comparisons (Original vs HE/CLAHE/CS/Brightness)
-- ============================================================================

-- 1. Seed 12 Indonesian Culinary Classes (65+55+55+50+50+55+50+45+45+45+45+40 = 600)
insert into public.culinary_classes (
    id, name, slug, region_origin, category, avg_calories, dataset_count, description
) values
    (1, 'Nasi Goreng', 'nasi-goreng', 'Jawa & Nusantara', 'Makanan Utama', 450, 65, 'Nasi tumis bumbu kecap manis, bawang merah, bawang putih, dan telur atau ayam.'),
    (2, 'Bakso', 'bakso', 'Jawa Tengah & Jawa Timur', 'Berkuah', 320, 55, 'Bola daging sapi kenyal disajikan dengan kuah kaldu gurih, mie, dan sawi.'),
    (3, 'Sate Ayam', 'sate-ayam', 'Madura, Jawa Timur', 'Bakaran', 380, 55, 'Potongan daging ayam panggang tusuk bambu dengan bumbu kacang dan kecap manis.'),
    (4, 'Rendang', 'rendang', 'Sumatera Barat', 'Lauk Utama', 470, 50, 'Daging sapi dimasak lama dalam santan dan rempah Minangkabau hingga berwarna cokelat gelap.'),
    (5, 'Soto Ayam', 'soto-ayam', 'Jawa & Lamongan', 'Berkuah', 310, 50, 'Sup ayam berkuah kuning kunyit dengan suwiran ayam, soun, telur, dan koya.'),
    (6, 'Ayam Goreng', 'ayam-goreng', 'Nusantara', 'Lauk Goreng', 360, 55, 'Ayam ungkep rempah kuning yang digoreng keemasan dengan tekstur renyah di luar.'),
    (7, 'Mie Goreng', 'mie-goreng', 'Jawa & Nusantara', 'Makanan Utama', 410, 50, 'Mie kuning goreng dengan kecap manis, sayuran sawi, kol, dan irisan bakso atau telur.'),
    (8, 'Tempe Goreng', 'tempe-goreng', 'Jawa Tengah', 'Lauk Nabati', 195, 45, 'Irisan tempe kedelai fermentasi berbumbu ketumbar bawang yang digoreng renyah.'),
    (9, 'Tahu Goreng', 'tahu-goreng', 'Jawa Barat & Jawa Tengah', 'Lauk Nabati', 175, 45, 'Potongan tahu putih atau kuning digoreng hingga berkulit keemasan.'),
    (10, 'Gado-Gado', 'gado-gado', 'Betawi, Jakarta', 'Sayuran & Bumbu Kacang', 340, 45, 'Salad sayuran rebus Nusantara dengan tahu, tempe, telur rebus, lontong, dan saus kacang.'),
    (11, 'Pempek', 'pempek', 'Palembang, Sumatera Selatan', 'Olahan Ikan', 290, 45, 'Olahan ikan tenggiri dan sagu khas Palembang dengan kuah cuko asam manis pedas.'),
    (12, 'Telur Balado', 'telur-balado', 'Minangkabau, Sumatera Barat', 'Lauk Pedas', 230, 40, 'Telur rebus goreng yang dilapisi sambal cabai merah tumis khas Padang.')
on conflict (id) do update set
    name = excluded.name,
    slug = excluded.slug,
    region_origin = excluded.region_origin,
    category = excluded.category,
    avg_calories = excluded.avg_calories,
    dataset_count = excluded.dataset_count,
    description = excluded.description;

-- 2. Seed 8 Detection Sessions
insert into public.detection_sessions (
    id, media_name, media_type, model_name, enhancement_method, mode,
    total_detected, region_inside_count, region_outside_count,
    avg_confidence, inference_ms, class_breakdown, created_at
) values
    (1, 'nasi_goreng_spesial.jpg', 'image', 'yolo11n-culinary-best.pt', 'clahe', 'counting',
     6, 4, 2, 0.9180, 24.60,
     '{"Nasi Goreng": 2, "Telur Balado": 2, "Ayam Goreng": 1, "Tempe Goreng": 1}'::jsonb,
     '2026-11-10T09:15:00Z'),
    (2, 'bakso_komplit_warung.jpg', 'image', 'yolo11n-culinary-best.pt', 'clahe', 'counting',
     5, 4, 1, 0.9040, 23.10,
     '{"Bakso": 3, "Tahu Goreng": 2}'::jsonb,
     '2026-11-10T10:30:00Z'),
    (3, 'sate_ayam_madura_malam.jpg', 'image', 'yolo11n-culinary-best.pt', 'cs', 'counting',
     7, 5, 2, 0.8890, 25.40,
     '{"Sate Ayam": 5, "Nasi Goreng": 1, "Tahu Goreng": 1}'::jsonb,
     '2026-11-10T14:20:00Z'),
    (4, 'nasi_padang_rendang_redup.jpg', 'image', 'yolo11n-culinary-best.pt', 'clahe', 'counting',
     8, 6, 2, 0.9120, 26.80,
     '{"Rendang": 3, "Telur Balado": 3, "Ayam Goreng": 1, "Tempe Goreng": 1}'::jsonb,
     '2026-11-11T08:45:00Z'),
    (5, 'prasmanan_kuliner_nusantara.mp4', 'video', 'yolo11n-culinary-best.pt', 'clahe', 'tracking',
     14, 9, 5, 0.8960, 31.20,
     '{"Nasi Goreng": 2, "Rendang": 2, "Ayam Goreng": 3, "Mie Goreng": 2, "Tempe Goreng": 3, "Telur Balado": 2}'::jsonb,
     '2026-11-11T13:10:00Z'),
    (6, 'kasir_warteg_ramai.mp4', 'video', 'yolo11n-culinary-best.pt', 'brightness', 'tracking',
     12, 8, 4, 0.8780, 29.70,
     '{"Tempe Goreng": 3, "Tahu Goreng": 3, "Telur Balado": 2, "Ayam Goreng": 2, "Soto Ayam": 2}'::jsonb,
     '2026-11-12T11:05:00Z'),
    (7, 'gado_gado_tahu_tempe.jpg', 'image', 'yolo11n-culinary-best.pt', 'he', 'counting',
     6, 5, 1, 0.8840, 22.90,
     '{"Gado-Gado": 2, "Tempe Goreng": 2, "Tahu Goreng": 2}'::jsonb,
     '2026-11-12T15:40:00Z'),
    (8, 'pempek_soto_mie_goreng.jpg', 'image', 'yolo11n-culinary-best.pt', 'clahe', 'counting',
     7, 5, 2, 0.9090, 24.10,
     '{"Pempek": 3, "Soto Ayam": 2, "Mie Goreng": 2}'::jsonb,
     '2026-11-13T08:00:00Z')
on conflict (id) do nothing;

-- 3. Seed 15 Before vs After Enhancement Comparison Rows
insert into public.enhancement_comparisons (
    id, session_id, image_name, ground_truth_count,
    before_count, before_conf,
    he_count, he_conf,
    clahe_count, clahe_conf,
    cs_count, cs_conf,
    brightness_count, brightness_conf,
    best_method, conf_improvement_pct, psnr_db, created_at
) values
    (1, 1, 'nasi_goreng_malam_01.jpg', 6, 4, 0.6420, 5, 0.7850, 6, 0.9180, 6, 0.8640, 5, 0.8120, 'clahe', 42.99, 29.40, '2026-11-10T09:16:00Z'),
    (2, 2, 'bakso_warung_redup_02.jpg', 5, 3, 0.6650, 4, 0.7980, 5, 0.9040, 5, 0.8590, 4, 0.8240, 'clahe', 35.94, 30.15, '2026-11-10T10:31:00Z'),
    (3, 3, 'sate_ayam_asap_03.jpg', 7, 5, 0.6810, 6, 0.8140, 7, 0.8810, 7, 0.8890, 6, 0.8360, 'cs', 30.54, 31.20, '2026-11-10T14:21:00Z'),
    (4, 4, 'rendang_padang_gelap_04.jpg', 8, 5, 0.6180, 7, 0.7910, 8, 0.9120, 7, 0.8480, 7, 0.8310, 'clahe', 47.57, 28.85, '2026-11-11T08:46:00Z'),
    (5, 8, 'soto_ayam_lamongan_05.jpg', 5, 4, 0.6920, 5, 0.8230, 5, 0.9050, 5, 0.8670, 4, 0.8410, 'clahe', 30.78, 30.60, '2026-11-11T09:30:00Z'),
    (6, 5, 'ayam_goreng_kremes_06.jpg', 6, 4, 0.6740, 5, 0.8090, 6, 0.9110, 6, 0.8750, 6, 0.8520, 'clahe', 35.16, 29.95, '2026-11-11T13:12:00Z'),
    (7, 5, 'mie_goreng_tektek_07.jpg', 5, 3, 0.6510, 4, 0.7880, 5, 0.8960, 5, 0.8620, 4, 0.8190, 'clahe', 37.63, 29.70, '2026-11-11T14:05:00Z'),
    (8, 6, 'tempe_goreng_warteg_08.jpg', 6, 4, 0.6600, 5, 0.7950, 6, 0.8790, 6, 0.8680, 6, 0.8840, 'brightness', 33.94, 28.50, '2026-11-12T11:08:00Z'),
    (9, 6, 'tahu_goreng_sumedang_09.jpg', 6, 4, 0.6780, 5, 0.8120, 6, 0.8940, 6, 0.8710, 6, 0.8650, 'clahe', 31.86, 30.40, '2026-11-12T11:15:00Z'),
    (10, 7, 'gado_gado_betawi_10.jpg', 6, 5, 0.7050, 6, 0.8840, 6, 0.8790, 6, 0.8540, 5, 0.8210, 'he', 25.39, 27.90, '2026-11-12T15:42:00Z'),
    (11, 8, 'pempek_palembang_11.jpg', 5, 3, 0.6390, 4, 0.7820, 5, 0.9090, 5, 0.8630, 4, 0.8170, 'clahe', 42.25, 30.05, '2026-11-13T08:02:00Z'),
    (12, 4, 'telur_balado_padang_12.jpg', 6, 4, 0.6480, 5, 0.8010, 6, 0.9160, 6, 0.8740, 5, 0.8330, 'clahe', 41.36, 29.60, '2026-11-13T08:20:00Z'),
    (13, 5, 'prasmanan_nusantara_13.jpg', 14, 9, 0.6290, 12, 0.7940, 14, 0.8960, 13, 0.8610, 12, 0.8280, 'clahe', 42.45, 29.10, '2026-11-13T08:40:00Z'),
    (14, 6, 'kasir_warteg_backlight_14.jpg', 12, 8, 0.6540, 10, 0.8020, 12, 0.8910, 11, 0.8580, 12, 0.8780, 'clahe', 36.24, 28.95, '2026-11-13T09:00:00Z'),
    (15, 1, 'paket_komplit_kantin_15.jpg', 8, 6, 0.6880, 7, 0.8270, 8, 0.9080, 8, 0.9140, 7, 0.8490, 'cs', 32.85, 31.45, '2026-11-13T09:15:00Z')
on conflict (id) do nothing;

-- Sync identity sequences after explicit ID inserts
select setval(pg_get_serial_sequence('public.culinary_classes', 'id'), coalesce((select max(id) from public.culinary_classes), 1));
select setval(pg_get_serial_sequence('public.detection_sessions', 'id'), coalesce((select max(id) from public.detection_sessions), 1));
select setval(pg_get_serial_sequence('public.enhancement_comparisons', 'id'), coalesce((select max(id) from public.enhancement_comparisons), 1));
