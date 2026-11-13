/**
 * NusantaraVision YOLOv11 - Browser & Offline Supabase Service
 *
 * Exposes `window.SupabaseCulinaryService` for the Web GUI.
 * - When Supabase URL & Publishable/Anon Key are configured (via `window.SUPABASE_CONFIG`
 *   or `localStorage`), requests go directly to the Supabase PostgREST API (`/rest/v1/...`).
 * - When unconfigured, offline, or opened via `file://`, it seamlessly falls back to
 *   `localStorage` seeded from `../reports/local_db_fallback.json` (over HTTP) or the
 *   embedded fallback dataset (offline / `file://`).
 */
(function (globalScope) {
  "use strict";

  const CONFIG_STORAGE_KEY = "nusantaravision_supabase_config_v1";
  const DATA_STORAGE_KEY = "nusantaravision_local_db_v1";
  const FALLBACK_JSON_URL =
    typeof window !== "undefined" && window.location && window.location.protocol === "file:"
      ? "../reports/local_db_fallback.json"
      : "/reports/local_db_fallback.json";
  const DEFAULT_SUPABASE_URL = "https://kwsvahzszwmsefmrlnww.supabase.co";
  const DEFAULT_SUPABASE_KEY = "sb_publishable_ustO2PCyWYu3GwwKu9KlqQ_DzKwOWMW";

  const EMBEDDED_FALLBACK_DB = {
    metadata: {
      project: "NusantaraVision YOLOv11 - Deteksi Kuliner Umum Indonesia",
      total_classes: 12,
      total_dataset_images: 600,
      split: { train: 420, valid: 120, test: 60 },
      generated_at: "2026-11-13T10:56:00Z",
    },
    culinary_classes: [
      {
        id: 1,
        name: "Nasi Goreng",
        slug: "nasi-goreng",
        region_origin: "Jawa & Nusantara",
        category: "Makanan Utama",
        avg_calories: 450,
        dataset_count: 65,
        description: "Nasi tumis bumbu kecap manis, bawang merah, bawang putih, dan telur atau ayam.",
        created_at: "2026-11-10T08:00:00Z",
      },
      {
        id: 2,
        name: "Bakso",
        slug: "bakso",
        region_origin: "Jawa Tengah & Jawa Timur",
        category: "Berkuah",
        avg_calories: 320,
        dataset_count: 55,
        description: "Bola daging sapi kenyal disajikan dengan kuah kaldu gurih, mie, dan sawi.",
        created_at: "2026-11-10T08:00:00Z",
      },
      {
        id: 3,
        name: "Sate Ayam",
        slug: "sate-ayam",
        region_origin: "Madura, Jawa Timur",
        category: "Bakaran",
        avg_calories: 380,
        dataset_count: 55,
        description: "Potongan daging ayam panggang tusuk bambu dengan bumbu kacang dan kecap manis.",
        created_at: "2026-11-10T08:00:00Z",
      },
      {
        id: 4,
        name: "Rendang",
        slug: "rendang",
        region_origin: "Sumatera Barat",
        category: "Lauk Utama",
        avg_calories: 470,
        dataset_count: 50,
        description: "Daging sapi dimasak lama dalam santan dan rempah Minangkabau hingga berwarna cokelat gelap.",
        created_at: "2026-11-10T08:00:00Z",
      },
      {
        id: 5,
        name: "Soto Ayam",
        slug: "soto-ayam",
        region_origin: "Jawa & Lamongan",
        category: "Berkuah",
        avg_calories: 310,
        dataset_count: 50,
        description: "Sup ayam berkuah kuning kunyit dengan suwiran ayam, soun, telur, dan koya.",
        created_at: "2026-11-10T08:00:00Z",
      },
      {
        id: 6,
        name: "Ayam Goreng",
        slug: "ayam-goreng",
        region_origin: "Nusantara",
        category: "Lauk Goreng",
        avg_calories: 360,
        dataset_count: 55,
        description: "Ayam ungkep rempah kuning yang digoreng keemasan dengan tekstur renyah di luar.",
        created_at: "2026-11-10T08:00:00Z",
      },
      {
        id: 7,
        name: "Mie Goreng",
        slug: "mie-goreng",
        region_origin: "Jawa & Nusantara",
        category: "Makanan Utama",
        avg_calories: 410,
        dataset_count: 50,
        description: "Mie kuning goreng dengan kecap manis, sayuran sawi, kol, dan irisan bakso atau telur.",
        created_at: "2026-11-10T08:00:00Z",
      },
      {
        id: 8,
        name: "Tempe Goreng",
        slug: "tempe-goreng",
        region_origin: "Jawa Tengah",
        category: "Lauk Nabati",
        avg_calories: 195,
        dataset_count: 45,
        description: "Irisan tempe kedelai fermentasi berbumbu ketumbar bawang yang digoreng renyah.",
        created_at: "2026-11-10T08:00:00Z",
      },
      {
        id: 9,
        name: "Tahu Goreng",
        slug: "tahu-goreng",
        region_origin: "Jawa Barat & Jawa Tengah",
        category: "Lauk Nabati",
        avg_calories: 175,
        dataset_count: 45,
        description: "Potongan tahu putih atau kuning digoreng hingga berkulit keemasan.",
        created_at: "2026-11-10T08:00:00Z",
      },
      {
        id: 10,
        name: "Gado-Gado",
        slug: "gado-gado",
        region_origin: "Betawi, Jakarta",
        category: "Sayuran & Bumbu Kacang",
        avg_calories: 340,
        dataset_count: 45,
        description: "Salad sayuran rebus Nusantara dengan tahu, tempe, telur rebus, lontong, dan saus kacang.",
        created_at: "2026-11-10T08:00:00Z",
      },
      {
        id: 11,
        name: "Pempek",
        slug: "pempek",
        region_origin: "Palembang, Sumatera Selatan",
        category: "Olahan Ikan",
        avg_calories: 290,
        dataset_count: 45,
        description: "Olahan ikan tenggiri dan sagu khas Palembang dengan kuah cuko asam manis pedas.",
        created_at: "2026-11-10T08:00:00Z",
      },
      {
        id: 12,
        name: "Telur Balado",
        slug: "telur-balado",
        region_origin: "Minangkabau, Sumatera Barat",
        category: "Lauk Pedas",
        avg_calories: 230,
        dataset_count: 40,
        description: "Telur rebus goreng yang dilapisi sambal cabai merah tumis khas Padang.",
        created_at: "2026-11-10T08:00:00Z",
      },
    ],
    detection_sessions: [
      {
        id: 1,
        media_name: "nasi_goreng_spesial.jpg",
        media_type: "image",
        model_name: "yolo11n-culinary-best.pt",
        enhancement_method: "clahe",
        mode: "counting",
        total_detected: 6,
        region_inside_count: 4,
        region_outside_count: 2,
        avg_confidence: 0.918,
        inference_ms: 24.6,
        class_breakdown: { "Nasi Goreng": 2, "Telur Balado": 2, "Ayam Goreng": 1, "Tempe Goreng": 1 },
        created_at: "2026-11-10T09:15:00Z",
      },
      {
        id: 2,
        media_name: "bakso_komplit_warung.jpg",
        media_type: "image",
        model_name: "yolo11n-culinary-best.pt",
        enhancement_method: "clahe",
        mode: "counting",
        total_detected: 5,
        region_inside_count: 4,
        region_outside_count: 1,
        avg_confidence: 0.904,
        inference_ms: 23.1,
        class_breakdown: { Bakso: 3, "Tahu Goreng": 2 },
        created_at: "2026-11-10T10:30:00Z",
      },
      {
        id: 3,
        media_name: "sate_ayam_madura_malam.jpg",
        media_type: "image",
        model_name: "yolo11n-culinary-best.pt",
        enhancement_method: "cs",
        mode: "counting",
        total_detected: 7,
        region_inside_count: 5,
        region_outside_count: 2,
        avg_confidence: 0.889,
        inference_ms: 25.4,
        class_breakdown: { "Sate Ayam": 5, "Nasi Goreng": 1, "Tahu Goreng": 1 },
        created_at: "2026-11-10T14:20:00Z",
      },
      {
        id: 4,
        media_name: "nasi_padang_rendang_redup.jpg",
        media_type: "image",
        model_name: "yolo11n-culinary-best.pt",
        enhancement_method: "clahe",
        mode: "counting",
        total_detected: 8,
        region_inside_count: 6,
        region_outside_count: 2,
        avg_confidence: 0.912,
        inference_ms: 26.8,
        class_breakdown: { Rendang: 3, "Telur Balado": 3, "Ayam Goreng": 1, "Tempe Goreng": 1 },
        created_at: "2026-11-11T08:45:00Z",
      },
      {
        id: 5,
        media_name: "prasmanan_kuliner_nusantara.mp4",
        media_type: "video",
        model_name: "yolo11n-culinary-best.pt",
        enhancement_method: "clahe",
        mode: "tracking",
        total_detected: 14,
        region_inside_count: 9,
        region_outside_count: 5,
        avg_confidence: 0.896,
        inference_ms: 31.2,
        class_breakdown: {
          "Nasi Goreng": 2,
          Rendang: 2,
          "Ayam Goreng": 3,
          "Mie Goreng": 2,
          "Tempe Goreng": 3,
          "Telur Balado": 2,
        },
        created_at: "2026-11-11T13:10:00Z",
      },
      {
        id: 6,
        media_name: "kasir_warteg_ramai.mp4",
        media_type: "video",
        model_name: "yolo11n-culinary-best.pt",
        enhancement_method: "brightness",
        mode: "tracking",
        total_detected: 12,
        region_inside_count: 8,
        region_outside_count: 4,
        avg_confidence: 0.878,
        inference_ms: 29.7,
        class_breakdown: {
          "Tempe Goreng": 3,
          "Tahu Goreng": 3,
          "Telur Balado": 2,
          "Ayam Goreng": 2,
          "Soto Ayam": 2,
        },
        created_at: "2026-11-12T11:05:00Z",
      },
      {
        id: 7,
        media_name: "gado_gado_tahu_tempe.jpg",
        media_type: "image",
        model_name: "yolo11n-culinary-best.pt",
        enhancement_method: "he",
        mode: "counting",
        total_detected: 6,
        region_inside_count: 5,
        region_outside_count: 1,
        avg_confidence: 0.884,
        inference_ms: 22.9,
        class_breakdown: { "Gado-Gado": 2, "Tempe Goreng": 2, "Tahu Goreng": 2 },
        created_at: "2026-11-12T15:40:00Z",
      },
      {
        id: 8,
        media_name: "pempek_soto_mie_goreng.jpg",
        media_type: "image",
        model_name: "yolo11n-culinary-best.pt",
        enhancement_method: "clahe",
        mode: "counting",
        total_detected: 7,
        region_inside_count: 5,
        region_outside_count: 2,
        avg_confidence: 0.909,
        inference_ms: 24.1,
        class_breakdown: { Pempek: 3, "Soto Ayam": 2, "Mie Goreng": 2 },
        created_at: "2026-11-13T08:00:00Z",
      },
    ],
    enhancement_comparisons: [
      {
        id: 1,
        session_id: 1,
        image_name: "nasi_goreng_malam_01.jpg",
        ground_truth_count: 6,
        before_count: 4,
        before_conf: 0.642,
        he_count: 5,
        he_conf: 0.785,
        clahe_count: 6,
        clahe_conf: 0.918,
        cs_count: 6,
        cs_conf: 0.864,
        brightness_count: 5,
        brightness_conf: 0.812,
        best_method: "clahe",
        conf_improvement_pct: 42.99,
        psnr_db: 29.4,
        created_at: "2026-11-10T09:16:00Z",
      },
      {
        id: 2,
        session_id: 2,
        image_name: "bakso_warung_redup_02.jpg",
        ground_truth_count: 5,
        before_count: 3,
        before_conf: 0.665,
        he_count: 4,
        he_conf: 0.798,
        clahe_count: 5,
        clahe_conf: 0.904,
        cs_count: 5,
        cs_conf: 0.859,
        brightness_count: 4,
        brightness_conf: 0.824,
        best_method: "clahe",
        conf_improvement_pct: 35.94,
        psnr_db: 30.15,
        created_at: "2026-11-10T10:31:00Z",
      },
      {
        id: 3,
        session_id: 3,
        image_name: "sate_ayam_asap_03.jpg",
        ground_truth_count: 7,
        before_count: 5,
        before_conf: 0.681,
        he_count: 6,
        he_conf: 0.814,
        clahe_count: 7,
        clahe_conf: 0.881,
        cs_count: 7,
        cs_conf: 0.889,
        brightness_count: 6,
        brightness_conf: 0.836,
        best_method: "cs",
        conf_improvement_pct: 30.54,
        psnr_db: 31.2,
        created_at: "2026-11-10T14:21:00Z",
      },
      {
        id: 4,
        session_id: 4,
        image_name: "rendang_padang_gelap_04.jpg",
        ground_truth_count: 8,
        before_count: 5,
        before_conf: 0.618,
        he_count: 7,
        he_conf: 0.791,
        clahe_count: 8,
        clahe_conf: 0.912,
        cs_count: 7,
        cs_conf: 0.848,
        brightness_count: 7,
        brightness_conf: 0.831,
        best_method: "clahe",
        conf_improvement_pct: 47.57,
        psnr_db: 28.85,
        created_at: "2026-11-11T08:46:00Z",
      },
      {
        id: 5,
        session_id: 8,
        image_name: "soto_ayam_lamongan_05.jpg",
        ground_truth_count: 5,
        before_count: 4,
        before_conf: 0.692,
        he_count: 5,
        he_conf: 0.823,
        clahe_count: 5,
        clahe_conf: 0.905,
        cs_count: 5,
        cs_conf: 0.867,
        brightness_count: 4,
        brightness_conf: 0.841,
        best_method: "clahe",
        conf_improvement_pct: 30.78,
        psnr_db: 30.6,
        created_at: "2026-11-11T09:30:00Z",
      },
      {
        id: 6,
        session_id: 5,
        image_name: "ayam_goreng_kremes_06.jpg",
        ground_truth_count: 6,
        before_count: 4,
        before_conf: 0.674,
        he_count: 5,
        he_conf: 0.809,
        clahe_count: 6,
        clahe_conf: 0.911,
        cs_count: 6,
        cs_conf: 0.875,
        brightness_count: 6,
        brightness_conf: 0.852,
        best_method: "clahe",
        conf_improvement_pct: 35.16,
        psnr_db: 29.95,
        created_at: "2026-11-11T13:12:00Z",
      },
      {
        id: 7,
        session_id: 5,
        image_name: "mie_goreng_tektek_07.jpg",
        ground_truth_count: 5,
        before_count: 3,
        before_conf: 0.651,
        he_count: 4,
        he_conf: 0.788,
        clahe_count: 5,
        clahe_conf: 0.896,
        cs_count: 5,
        cs_conf: 0.862,
        brightness_count: 4,
        brightness_conf: 0.819,
        best_method: "clahe",
        conf_improvement_pct: 37.63,
        psnr_db: 29.7,
        created_at: "2026-11-11T14:05:00Z",
      },
      {
        id: 8,
        session_id: 6,
        image_name: "tempe_goreng_warteg_08.jpg",
        ground_truth_count: 6,
        before_count: 4,
        before_conf: 0.66,
        he_count: 5,
        he_conf: 0.795,
        clahe_count: 6,
        clahe_conf: 0.879,
        cs_count: 6,
        cs_conf: 0.868,
        brightness_count: 6,
        brightness_conf: 0.884,
        best_method: "brightness",
        conf_improvement_pct: 33.94,
        psnr_db: 28.5,
        created_at: "2026-11-12T11:08:00Z",
      },
      {
        id: 9,
        session_id: 6,
        image_name: "tahu_goreng_sumedang_09.jpg",
        ground_truth_count: 6,
        before_count: 4,
        before_conf: 0.678,
        he_count: 5,
        he_conf: 0.812,
        clahe_count: 6,
        clahe_conf: 0.894,
        cs_count: 6,
        cs_conf: 0.871,
        brightness_count: 6,
        brightness_conf: 0.865,
        best_method: "clahe",
        conf_improvement_pct: 31.86,
        psnr_db: 30.4,
        created_at: "2026-11-12T11:15:00Z",
      },
      {
        id: 10,
        session_id: 7,
        image_name: "gado_gado_betawi_10.jpg",
        ground_truth_count: 6,
        before_count: 5,
        before_conf: 0.705,
        he_count: 6,
        he_conf: 0.884,
        clahe_count: 6,
        clahe_conf: 0.879,
        cs_count: 6,
        cs_conf: 0.854,
        brightness_count: 5,
        brightness_conf: 0.821,
        best_method: "he",
        conf_improvement_pct: 25.39,
        psnr_db: 27.9,
        created_at: "2026-11-12T15:42:00Z",
      },
      {
        id: 11,
        session_id: 8,
        image_name: "pempek_palembang_11.jpg",
        ground_truth_count: 5,
        before_count: 3,
        before_conf: 0.639,
        he_count: 4,
        he_conf: 0.782,
        clahe_count: 5,
        clahe_conf: 0.909,
        cs_count: 5,
        cs_conf: 0.863,
        brightness_count: 4,
        brightness_conf: 0.817,
        best_method: "clahe",
        conf_improvement_pct: 42.25,
        psnr_db: 30.05,
        created_at: "2026-11-13T08:02:00Z",
      },
      {
        id: 12,
        session_id: 4,
        image_name: "telur_balado_padang_12.jpg",
        ground_truth_count: 6,
        before_count: 4,
        before_conf: 0.648,
        he_count: 5,
        he_conf: 0.801,
        clahe_count: 6,
        clahe_conf: 0.916,
        cs_count: 6,
        cs_conf: 0.874,
        brightness_count: 5,
        brightness_conf: 0.833,
        best_method: "clahe",
        conf_improvement_pct: 41.36,
        psnr_db: 29.6,
        created_at: "2026-11-13T08:20:00Z",
      },
      {
        id: 13,
        session_id: 5,
        image_name: "prasmanan_nusantara_13.jpg",
        ground_truth_count: 14,
        before_count: 9,
        before_conf: 0.629,
        he_count: 12,
        he_conf: 0.794,
        clahe_count: 14,
        clahe_conf: 0.896,
        cs_count: 13,
        cs_conf: 0.861,
        brightness_count: 12,
        brightness_conf: 0.828,
        best_method: "clahe",
        conf_improvement_pct: 42.45,
        psnr_db: 29.1,
        created_at: "2026-11-13T08:40:00Z",
      },
      {
        id: 14,
        session_id: 6,
        image_name: "kasir_warteg_backlight_14.jpg",
        ground_truth_count: 12,
        before_count: 8,
        before_conf: 0.654,
        he_count: 10,
        he_conf: 0.802,
        clahe_count: 12,
        clahe_conf: 0.891,
        cs_count: 11,
        cs_conf: 0.858,
        brightness_count: 12,
        brightness_conf: 0.878,
        best_method: "clahe",
        conf_improvement_pct: 36.24,
        psnr_db: 28.95,
        created_at: "2026-11-13T09:00:00Z",
      },
      {
        id: 15,
        session_id: 1,
        image_name: "paket_komplit_kantin_15.jpg",
        ground_truth_count: 8,
        before_count: 6,
        before_conf: 0.688,
        he_count: 7,
        he_conf: 0.827,
        clahe_count: 8,
        clahe_conf: 0.908,
        cs_count: 8,
        cs_conf: 0.914,
        brightness_count: 7,
        brightness_conf: 0.849,
        best_method: "cs",
        conf_improvement_pct: 32.85,
        psnr_db: 31.45,
        created_at: "2026-11-13T09:15:00Z",
      },
    ],
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function hasStorage() {
    try {
      return typeof globalScope.localStorage !== "undefined" && globalScope.localStorage !== null;
    } catch (_) {
      return false;
    }
  }

  function readStorageJson(key) {
    if (!hasStorage()) return null;
    try {
      const raw = globalScope.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeStorageJson(key, value) {
    if (!hasStorage()) return false;
    try {
      globalScope.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function isValidConfig(url, key) {
    if (!url || !key) return false;
    const cleanUrl = String(url).trim().toLowerCase();
    const cleanKey = String(key).trim().toLowerCase();
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) return false;
    const placeholders = ["your-project-ref", "your_publishable_key_here", "your_legacy_anon_key_here"];
    return !placeholders.some((p) => cleanUrl.includes(p) || cleanKey.includes(p));
  }

  let _dbPromise = null;
  let _memoryDb = null;

  async function ensureLocalDb() {
    if (_memoryDb) return _memoryDb;
    if (_dbPromise) return _dbPromise;

    _dbPromise = (async () => {
      const cached = readStorageJson(DATA_STORAGE_KEY);
      if (cached && Array.isArray(cached.culinary_classes) && cached.culinary_classes.length === 12) {
        _memoryDb = cached;
        return _memoryDb;
      }

      const isHttp =
        typeof globalScope.location !== "undefined" &&
        globalScope.location &&
        (globalScope.location.protocol === "http:" || globalScope.location.protocol === "https:");

      if (isHttp && typeof globalScope.fetch === "function") {
        try {
          const resp = await globalScope.fetch(FALLBACK_JSON_URL, { cache: "no-store" });
          if (resp.ok) {
            const json = await resp.json();
            if (json && Array.isArray(json.culinary_classes)) {
              _memoryDb = json;
              writeStorageJson(DATA_STORAGE_KEY, _memoryDb);
              return _memoryDb;
            }
          }
        } catch (_) {
          // Fall back silently to embedded dataset
        }
      }

      _memoryDb = clone(EMBEDDED_FALLBACK_DB);
      writeStorageJson(DATA_STORAGE_KEY, _memoryDb);
      return _memoryDb;
    })();

    return _dbPromise;
  }

  function getConfig() {
    const windowCfg = globalScope.SUPABASE_CONFIG || {};
    const storedCfg = readStorageJson(CONFIG_STORAGE_KEY) || {};
    const url = String(storedCfg.url || windowCfg.url || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, "");
    const anonKey = String(
      storedCfg.anonKey ||
        storedCfg.publishableKey ||
        windowCfg.anonKey ||
        windowCfg.publishableKey ||
        DEFAULT_SUPABASE_KEY
    ).trim();
    return {
      url,
      anonKey,
      configured: isValidConfig(url, anonKey),
    };
  }

  function setConfig(cfg) {
    const url = String((cfg && cfg.url) || "").trim().replace(/\/+$/, "");
    const anonKey = String((cfg && (cfg.anonKey || cfg.publishableKey)) || "").trim();
    writeStorageJson(CONFIG_STORAGE_KEY, { url, anonKey });
    return getConfig();
  }

  function clearConfig() {
    if (hasStorage()) {
      try {
        globalScope.localStorage.removeItem(CONFIG_STORAGE_KEY);
      } catch (_) {
        // ignore
      }
    }
    return getConfig();
  }

  async function supabaseRequest(path, options) {
    const cfg = getConfig();
    if (!cfg.configured) {
      throw new Error("Supabase belum dikonfigurasi");
    }
    if (typeof globalScope.fetch !== "function") {
      throw new Error("Fetch API tidak tersedia");
    }
    const opts = options || {};
    const authHeaders = {
      apikey: cfg.anonKey,
      "Content-Type": "application/json",
    };
    if (cfg.anonKey.startsWith("eyJ")) {
      authHeaders.Authorization = "Bearer " + cfg.anonKey;
    }
    const headers = Object.assign(authHeaders, opts.headers || {});
    const resp = await globalScope.fetch(cfg.url + "/rest/v1/" + path, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText);
      throw new Error("Supabase HTTP " + resp.status + ": " + errText);
    }
    if (resp.status === 204) return null;
    return resp.json();
  }

  async function testConnection() {
    const cfg = getConfig();
    if (!cfg.configured) {
      return {
        connected: false,
        mode: "local",
        message: "Mode Lokal (JSON + localStorage). Konfigurasikan URL & Anon Key untuk sync Supabase.",
      };
    }
    try {
      await supabaseRequest("culinary_classes?select=id&limit=1");
      return {
        connected: true,
        mode: "supabase",
        url: cfg.url,
        message: "Terhubung ke Supabase REST API (" + cfg.url + ")",
      };
    } catch (err) {
      return {
        connected: false,
        mode: "local",
        url: cfg.url,
        message: "Gagal terhubung ke Supabase, beralih ke mode lokal: " + err.message,
      };
    }
  }

  function getStatus() {
    const cfg = getConfig();
    return {
      mode: cfg.configured ? "supabase" : "local",
      configured: cfg.configured,
      url: cfg.url || null,
      storageKey: DATA_STORAGE_KEY,
    };
  }

  async function getClasses() {
    const cfg = getConfig();
    if (cfg.configured) {
      try {
        const rows = await supabaseRequest("culinary_classes?select=*&order=id.asc");
        if (Array.isArray(rows) && rows.length > 0) {
          return rows;
        }
      } catch (_) {
        // Fallback to local DB
      }
    }
    const db = await ensureLocalDb();
    return clone(db.culinary_classes || []);
  }

  async function getSessions(limit) {
    const maxRows = Number(limit) > 0 ? Number(limit) : 50;
    const cfg = getConfig();
    if (cfg.configured) {
      try {
        const rows = await supabaseRequest(
          "detection_sessions?select=*&order=created_at.desc&limit=" + maxRows
        );
        if (Array.isArray(rows)) {
          return rows;
        }
      } catch (_) {
        // Fallback to local DB
      }
    }
    const db = await ensureLocalDb();
    const sessions = clone(db.detection_sessions || []);
    sessions.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    return sessions.slice(0, maxRows);
  }

  async function saveSession(payload) {
    const data = payload || {};
    const record = {
      media_name: String(data.media_name || "deteksi_kuliner.jpg"),
      media_type: data.media_type === "video" ? "video" : "image",
      model_name: String(data.model_name || "yolo11n-culinary-best.pt"),
      enhancement_method: String(data.enhancement_method || "clahe"),
      mode: data.mode === "tracking" ? "tracking" : "counting",
      total_detected: Math.max(0, Number(data.total_detected || 0)),
      region_inside_count: Math.max(0, Number(data.region_inside_count || 0)),
      region_outside_count: Math.max(0, Number(data.region_outside_count || 0)),
      avg_confidence: Number(Number(data.avg_confidence || 0).toFixed(4)),
      inference_ms: Number(Number(data.inference_ms || 0).toFixed(2)),
      class_breakdown: data.class_breakdown || {},
    };

    const cfg = getConfig();
    let remoteError = null;
    if (cfg.configured) {
      try {
        const inserted = await supabaseRequest("detection_sessions", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: record,
        });
        const row = Array.isArray(inserted) ? inserted[0] : inserted;
        if (row) {
          const db = await ensureLocalDb();
          db.detection_sessions = [row].concat(db.detection_sessions || []);
          writeStorageJson(DATA_STORAGE_KEY, db);
          return { data: row, source: "supabase", error: null };
        }
      } catch (err) {
        remoteError = err.message;
      }
    }

    const db = await ensureLocalDb();
    const sessions = db.detection_sessions || [];
    const nextId = sessions.reduce((m, item) => Math.max(m, Number(item.id || 0)), 0) + 1;
    const localRow = Object.assign(
      { id: nextId },
      record,
      { created_at: data.created_at || new Date().toISOString() }
    );
    db.detection_sessions = [localRow].concat(sessions);
    writeStorageJson(DATA_STORAGE_KEY, db);
    return { data: clone(localRow), source: "local", error: remoteError };
  }

  async function getComparisons(limit) {
    const maxRows = Number(limit) > 0 ? Number(limit) : 50;
    const cfg = getConfig();
    if (cfg.configured) {
      try {
        const rows = await supabaseRequest(
          "enhancement_comparisons?select=*&order=created_at.desc&limit=" + maxRows
        );
        if (Array.isArray(rows)) {
          return rows;
        }
      } catch (_) {
        // Fallback to local DB
      }
    }
    const db = await ensureLocalDb();
    const comparisons = clone(db.enhancement_comparisons || []);
    comparisons.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    return comparisons.slice(0, maxRows);
  }

  async function saveComparison(payload) {
    const data = payload || {};
    const record = {
      session_id: data.session_id != null ? Number(data.session_id) : null,
      image_name: String(data.image_name || "uji_kuliner.jpg"),
      ground_truth_count: Math.max(0, Number(data.ground_truth_count || 0)),
      before_count: Math.max(0, Number(data.before_count || 0)),
      before_conf: Number(Number(data.before_conf || 0).toFixed(4)),
      he_count: Math.max(0, Number(data.he_count || 0)),
      he_conf: Number(Number(data.he_conf || 0).toFixed(4)),
      clahe_count: Math.max(0, Number(data.clahe_count || 0)),
      clahe_conf: Number(Number(data.clahe_conf || 0).toFixed(4)),
      cs_count: Math.max(0, Number(data.cs_count || 0)),
      cs_conf: Number(Number(data.cs_conf || 0).toFixed(4)),
      brightness_count: Math.max(0, Number(data.brightness_count || 0)),
      brightness_conf: Number(Number(data.brightness_conf || 0).toFixed(4)),
      best_method: String(data.best_method || "clahe"),
      conf_improvement_pct: Number(Number(data.conf_improvement_pct || 0).toFixed(2)),
      psnr_db: Number(Number(data.psnr_db || 0).toFixed(2)),
    };

    const cfg = getConfig();
    let remoteError = null;
    if (cfg.configured) {
      try {
        const inserted = await supabaseRequest("enhancement_comparisons", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: record,
        });
        const row = Array.isArray(inserted) ? inserted[0] : inserted;
        if (row) {
          const db = await ensureLocalDb();
          db.enhancement_comparisons = [row].concat(db.enhancement_comparisons || []);
          writeStorageJson(DATA_STORAGE_KEY, db);
          return { data: row, source: "supabase", error: null };
        }
      } catch (err) {
        remoteError = err.message;
      }
    }

    const db = await ensureLocalDb();
    const list = db.enhancement_comparisons || [];
    const nextId = list.reduce((m, item) => Math.max(m, Number(item.id || 0)), 0) + 1;
    const localRow = Object.assign(
      { id: nextId },
      record,
      { created_at: data.created_at || new Date().toISOString() }
    );
    db.enhancement_comparisons = [localRow].concat(list);
    writeStorageJson(DATA_STORAGE_KEY, db);
    return { data: clone(localRow), source: "local", error: remoteError };
  }

  async function getAllData() {
    const [classes, sessions, comparisons] = await Promise.all([
      getClasses(),
      getSessions(50),
      getComparisons(50),
    ]);
    return {
      status: getStatus(),
      culinary_classes: classes,
      detection_sessions: sessions,
      enhancement_comparisons: comparisons,
    };
  }

  async function resetLocalData() {
    _memoryDb = clone(EMBEDDED_FALLBACK_DB);
    _dbPromise = Promise.resolve(_memoryDb);
    writeStorageJson(DATA_STORAGE_KEY, _memoryDb);
    return clone(_memoryDb);
  }

  const service = {
    init: ensureLocalDb,
    getConfig,
    setConfig,
    clearConfig,
    isConfigured: () => getConfig().configured,
    getStatus,
    testConnection,
    getClasses,
    getSessions,
    saveSession,
    insertSession: saveSession,
    createSession: saveSession,
    getComparisons,
    saveComparison,
    insertComparison: saveComparison,
    createComparison: saveComparison,
    getAllData,
    resetLocalData,
  };

  if (typeof globalScope !== "undefined") {
    globalScope.SupabaseCulinaryService = service;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = service;
  }
})(typeof window !== "undefined" ? window : globalThis);
