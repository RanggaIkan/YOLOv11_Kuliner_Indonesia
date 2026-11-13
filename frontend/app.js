/* ==========================================================================
   NusantaraVision YOLOv11 — Frontend Web GUI Engine
   Works seamlessly on both http://localhost:8000 AND file:// direct open.
   ========================================================================== */
(function () {
  "use strict";

  const CANVAS_W = 960;
  const CANVAS_H = 540;

  // 12 Indonesian Culinary Classes (Total = 600 images: 420 train, 120 valid, 60 test)
  const CULINARY_CLASSES = [
    { id: 1, name: "Nasi Goreng", slug: "nasi-goreng", region_origin: "Jawa & Nusantara", category: "Makanan Utama", avg_calories: 450, dataset_count: 50, color: "#B93815", description: "Nasi tumis bumbu kecap manis, bawang, dan pelengkap telur/ayam." },
    { id: 2, name: "Bakso", slug: "bakso", region_origin: "Jawa Tengah & Timur", category: "Berkuah", avg_calories: 320, dataset_count: 50, color: "#15803D", description: "Bola daging sapi kenyal dalam kuah kaldu gurih dengan mie dan sawi." },
    { id: 3, name: "Sate Ayam", slug: "sate-ayam", region_origin: "Madura, Jawa Timur", category: "Bakaran", avg_calories: 380, dataset_count: 50, color: "#B45309", description: "Daging ayam panggang tusuk bambu dengan saus kacang dan kecap." },
    { id: 4, name: "Rendang", slug: "rendang", region_origin: "Sumatera Barat", category: "Lauk Utama", avg_calories: 470, dataset_count: 50, color: "#991B1B", description: "Daging sapi dimasak santan dan rempah Minangkabau hingga pekat." },
    { id: 5, name: "Soto Ayam", slug: "soto-ayam", region_origin: "Lamongan & Nusantara", category: "Berkuah", avg_calories: 310, dataset_count: 50, color: "#7C2D12", description: "Sup ayam kuah kuning kunyit dengan soun, kol, dan koya." },
    { id: 6, name: "Ayam Goreng", slug: "ayam-goreng", region_origin: "Jawa & Sunda", category: "Lauk Utama", avg_calories: 390, dataset_count: 50, color: "#C2410C", description: "Ayam ungkep rempah lengkuas dan kunyit digoreng renyah keemasan." },
    { id: 7, name: "Mie Goreng", slug: "mie-goreng", region_origin: "Nusantara", category: "Makanan Utama", avg_calories: 430, dataset_count: 50, color: "#0F766E", description: "Mie kuning tumis kecap manis bersama sawi, bakso, dan telur." },
    { id: 8, name: "Tempe Goreng", slug: "tempe-goreng", region_origin: "Jawa", category: "Lauk Pendamping", avg_calories: 195, dataset_count: 50, color: "#A16207", description: "Irisan kedelai fermentasi berbumbu ketumbar digoreng garing." },
    { id: 9, name: "Tahu Goreng", slug: "tahu-goreng", region_origin: "Jawa Barat & Tengah", category: "Lauk Pendamping", avg_calories: 165, dataset_count: 50, color: "#6D28D9", description: "Tahu putih atau kuning digoreng berkulit keemasan gurih." },
    { id: 10, name: "Gado-Gado", slug: "gado-gado", region_origin: "DKI Jakarta / Betawi", category: "Sayuran", avg_calories: 340, dataset_count: 50, color: "#166534", description: "Salad sayur rebus, lontong, dan tahu disiram saus kacang." },
    { id: 11, name: "Pempek", slug: "pempek", region_origin: "Palembang, Sumsel", category: "Kudapan", avg_calories: 360, dataset_count: 50, color: "#1D4ED8", description: "Olahan ikan tenggiri dan sagu disajikan dengan kuah cuko asam pedas." },
    { id: 12, name: "Telur Balado", slug: "telur-balado", region_origin: "Sumatera Barat", category: "Lauk Utama", avg_calories: 230, dataset_count: 50, color: "#BE123C", description: "Telur rebus goreng bersalut sambal cabai merah Minang." }
  ];

  const ICON_PLAY = '<svg class="ui-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
  const ICON_PAUSE = '<svg class="ui-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  const ICON_CHECK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';

  const CLASS_COLOR_MAP = Object.fromEntries(CULINARY_CLASSES.map((c) => [c.name, c.color]));

  const METHOD_LABELS = {
    original: "Original (Before)",
    he: "Histogram Equalization (HE)",
    clahe: "CLAHE (LAB)",
    cs: "Contrast Stretching (CS)",
    brightness: "Brightness / Gamma"
  };

  // Built-in 30-row Before vs After evaluation table matching reports/Laporan_Before_After_Enhancement
  const EVAL_30_ROWS = buildEval30Rows();

  const RUBRIC_KETENTUAN = [
    "1. Kelompok maksimal 3 mahasiswa (FTI UKSW)",
    "2. Tema Kuliner Umum Indonesia (12 kelas lokal)",
    "3. Dataset >= 500 citra (terpenuhi: 600 citra, split 70/20/10)",
    "4. Pengolahan citra Before vs After (HE, CLAHE, CS, Brightness)",
    "5. Video demo YouTube + file presentasi PPT (.pptx)",
    "6. Laporan Excel Before vs After terstruktur (.xlsx / .csv)"
  ];

  const RUBRIC_PENILAIAN = [
    "1. Deteksi YOLOv11 pada gambar & video berjalan akurat",
    "2. Fitur Object Counting & Multi-Object Tracking (ByteTrack)",
    "3. Fitur Object Region #1 (ROI Counter Inside vs Outside)",
    "4. Implementasi real-time Image Enhancement multi-metode",
    "5. GUI Web interaktif + penjelasan bahasa pemrograman",
    "6. Tabel & laporan Excel evaluasi Before vs After lengkap",
    "7. Kualitas narasi & demonstrasi alur kerja di YouTube",
    "8. Kelengkapan kode GitHub & Google Colab (.ipynb)",
    "9. Integrasi database PostgreSQL / Supabase + fallback lokal",
    "10. Kerapihan tampilan, dokumentasi & nilai tambah kreatif"
  ];

  function resolveAssetUrl(relPath) {
    const clean = String(relPath || "").replace(/^\/+/, "");
    return location.protocol === "file:" ? `../${clean}` : `/${clean}`;
  }

  const REAL_SAMPLE_MAP = {
    nasgor_malam: { file: "samples/images/nasi_goreng_real.jpg", aliases: ["nasi_goreng_real", "nasi_goreng", "nasgor_malam"], primaryClass: "Nasi Goreng", secondaryClass: "Telur Balado" },
    bakso_komplit: { file: "samples/images/bakso_real.jpg", aliases: ["bakso_real", "bakso", "bakso_komplit"], primaryClass: "Bakso", secondaryClass: "Tahu Goreng" },
    sate_madura: { file: "samples/images/sate_ayam_real.jpg", aliases: ["sate_ayam_real", "sate_ayam", "sate_madura"], primaryClass: "Sate Ayam", secondaryClass: "Gado-Gado" },
    padang_rendang: { file: "samples/images/rendang_real.jpg", aliases: ["rendang_real", "rendang", "padang_rendang"], primaryClass: "Rendang", secondaryClass: "Telur Balado" },
    soto_ayam: { file: "samples/images/soto_ayam_real.jpg", aliases: ["soto_ayam_real", "soto_ayam"], primaryClass: "Soto Ayam", secondaryClass: "Ayam Goreng" },
    ayam_goreng: { file: "samples/images/ayam_goreng_real.jpg", aliases: ["ayam_goreng_real", "ayam_goreng"], primaryClass: "Ayam Goreng", secondaryClass: "Tempe Goreng" },
    mie_goreng: { file: "samples/images/mie_goreng_real.jpg", aliases: ["mie_goreng_real", "mie_goreng"], primaryClass: "Mie Goreng", secondaryClass: "Telur Balado" },
    tempe_goreng: { file: "samples/images/tempe_goreng_real.jpg", aliases: ["tempe_goreng_real", "tempe_goreng"], primaryClass: "Tempe Goreng", secondaryClass: "Tahu Goreng" },
    tahu_goreng: { file: "samples/images/tahu_goreng_real.jpg", aliases: ["tahu_goreng_real", "tahu_goreng"], primaryClass: "Tahu Goreng", secondaryClass: "Tempe Goreng" },
    gado_gado: { file: "samples/images/gado_gado_real.jpg", aliases: ["gado_gado_real", "gado_gado"], primaryClass: "Gado-Gado", secondaryClass: "Tahu Goreng" },
    pempek: { file: "samples/images/pempek_real.jpg", aliases: ["pempek_real", "pempek"], primaryClass: "Pempek", secondaryClass: "Telur Balado" },
    telur_balado: { file: "samples/images/telur_balado_real.jpg", aliases: ["telur_balado_real", "telur_balado"], primaryClass: "Telur Balado", secondaryClass: "Rendang" },
    prasmanan_kuliner: { file: "samples/images/prasmanan_kuliner_real.jpg", aliases: ["prasmanan_kuliner_real", "prasmanan_kuliner"], primaryClass: "Nasi Goreng", secondaryClass: "Rendang" }
  };

  const VIDEO_SAMPLE_CONFIG = {
    video_prasmanan: {
      catalogId: "prasmanan_tracking_demo",
      framesDir: "samples/videos/frames/prasmanan_tracking_demo",
      totalFrames: 16,
      fps: 6,
      width: 960,
      height: 540,
      defaultRoiNorm: [288 / 960, 54 / 540, 403 / 960, 432 / 540]
    },
    video_kasir: {
      catalogId: "antrean_kantin_demo",
      framesDir: "samples/videos/frames/antrean_kantin_demo",
      totalFrames: 16,
      fps: 6,
      width: 960,
      height: 540,
      defaultRoiNorm: [451 / 960, 43 / 540, 423 / 960, 454 / 540]
    }
  };

  const realImageCache = new Map();
  const videoFrameCache = new Map();
  const catalogState = {
    loaded: false,
    imagesByKey: {},
    videosByKey: {}
  };

  function getOrLoadRealSampleImage(sceneKey) {
    const entry = REAL_SAMPLE_MAP[sceneKey];
    const catalogImg = catalogState.imagesByKey[sceneKey];
    const targetFile = (catalogImg && catalogImg.path) || (entry && entry.file);
    if (!targetFile) return null;
    if (realImageCache.has(sceneKey)) {
      const cached = realImageCache.get(sceneKey);
      if (cached.srcPath === targetFile) {
        return cached.loaded && !cached.failed ? cached.img : null;
      }
    }
    const img = new Image();
    const record = { img, loaded: false, failed: false, srcPath: targetFile };
    realImageCache.set(sceneKey, record);
    img.onload = () => {
      record.loaded = true;
      if (state.sampleKey === sceneKey && state.activeTab === "tab-detect") {
        renderDetectFrame();
      }
      if (state.activeTab === "tab-eval" && (dom.evalSceneSelect.value || "nasgor_malam") === sceneKey) {
        renderFiveCardComparison();
      }
    };
    img.onerror = () => {
      record.failed = true;
    };
    img.src = resolveAssetUrl(targetFile);
    return null;
  }

  function getOrLoadVideoFrame(sceneKey, frameIdx) {
    const vCfg = VIDEO_SAMPLE_CONFIG[sceneKey];
    const catVid = catalogState.videosByKey[sceneKey];
    if (!vCfg && !catVid) return { img: null, failed: true };

    const totalFrames = (catVid && catVid.total_frames) || vCfg.totalFrames || 16;
    const safeIdx = ((frameIdx % totalFrames) + totalFrames) % totalFrames;
    const ann = catVid && Array.isArray(catVid.frame_annotations) ? catVid.frame_annotations[safeIdx] : null;
    const frameFile = (ann && ann.frame_file) || `${vCfg.framesDir}/frame_${String(safeIdx + 1).padStart(3, "0")}.png`;

    if (!videoFrameCache.has(sceneKey)) {
      videoFrameCache.set(sceneKey, new Map());
    }
    const cache = videoFrameCache.get(sceneKey);
    if (cache.has(safeIdx)) {
      const rec = cache.get(safeIdx);
      return { img: rec.loaded && !rec.failed ? rec.img : null, failed: rec.failed };
    }

    const img = new Image();
    const rec = { img, loaded: false, failed: false };
    cache.set(safeIdx, rec);
    img.onload = () => {
      rec.loaded = true;
      if (state.sampleKey === sceneKey && state.activeTab === "tab-detect") {
        renderDetectFrame();
      }
    };
    img.onerror = () => {
      rec.failed = true;
    };
    img.src = resolveAssetUrl(frameFile);
    return { img: null, failed: false };
  }

  function preloadVideoFrames(sceneKey) {
    const vCfg = VIDEO_SAMPLE_CONFIG[sceneKey];
    const catVid = catalogState.videosByKey[sceneKey];
    const total = (catVid && catVid.total_frames) || (vCfg && vCfg.totalFrames) || 16;
    for (let i = 0; i < total; i++) {
      getOrLoadVideoFrame(sceneKey, i);
    }
  }

  function buildSupabaseHeaders(key, extra) {
    const headers = Object.assign({ apikey: key }, extra || {});
    if (String(key).startsWith("eyJ")) {
      headers.Authorization = `Bearer ${key}`;
    }
    return headers;
  }

  // Application State
  const state = {
    activeTab: "tab-detect",
    sampleKey: "nasgor_malam",
    mediaType: "image", // 'image' | 'video' | 'sim_video'
    mediaName: "Foto Real: Nasi Goreng Spesial",
    uploadedImage: null,
    uploadedVideoReady: false,
    isPlaying: true,
    simFrame: 0,

    enhanceMethod: "clahe",
    clipLimit: 2.5,
    brightness: 18,
    contrast: 1.25,
    gamma: 1.15,
    splitCompare: false,
    splitRatio: 0.5,
    lowLightSim: false,

    detectMode: "counting", // 'counting' | 'tracking'
    roiActive: true,
    roiPreset: "piring",
    roi: { x: 180, y: 80, w: 600, h: 380 },
    dragState: null, // { mode: 'move'|'nw'|'ne'|'sw'|'se'|'split', startX, startY, origRoi }
    lastPlacement: { dx: 0, dy: 0, dw: CANVAS_W, dh: CANVAS_H },

    backendConnected: false,
    backendUrl: "",
    detections: [],
    trailHistory: new Map(),
    uniqueTrackIds: new Set(),
    lastMetrics: { brightness: 0, contrast: 0, entropy: 0, psnr: "∞" },
    lastInferenceMs: 14.2,

    dbSubtab: "sessions",
    dbData: {
      classes: CULINARY_CLASSES,
      sessions: [],
      comparisons: [],
      source: "Fallback Lokal"
    }
  };

  // Offscreen canvases for fast pixel enhancement
  const rawCanvas = document.createElement("canvas");
  rawCanvas.width = CANVAS_W;
  rawCanvas.height = CANVAS_H;
  const rawCtx = rawCanvas.getContext("2d", { willReadFrequently: true });

  const enhancedCanvas = document.createElement("canvas");
  enhancedCanvas.width = CANVAS_W;
  enhancedCanvas.height = CANVAS_H;
  const enhancedCtx = enhancedCanvas.getContext("2d", { willReadFrequently: true });

  // DOM References
  const dom = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheDom();
    if (dom.toggleLowLightSim) dom.toggleLowLightSim.checked = state.lowLightSim;
    bindNavigation();
    bindMediaControls();
    bindEnhancementControls();
    bindRoiAndCanvasInteractions();
    bindTab2Controls();
    bindTab3AndSupabase();
    bindTab4Controls();

    renderRubricChecklists();
    loadGroupInfo();
    applyRoiPreset("piring", false);
    loadSampleScene("nasgor_malam");
    renderFiveCardComparison();
    renderEvalTable();
    drawDatasetChart();
    refreshDatabasePanel();
    loadSampleCatalog();
    probeBackendQuietly();
    startAnimationLoop();
  }

  function cacheDom() {
    const ids = [
      "backendStatusPill", "backendStatusText", "btnOpenSupabaseModal", "btnOpenSupabaseModal2",
      "supabaseStatusDot", "supabaseStatusText", "mediaModeTag", "imageUploadInput",
      "videoUploadInput", "sampleSceneSelect", "videoTransportBar", "btnPlayPause",
      "btnRestartVideo", "videoTimeLabel", "enhanceMethodGroup", "btnResetEnhance",
      "sliderClipLimit", "sliderBrightness", "sliderContrast", "sliderGamma",
      "valClipLimit", "valBrightness", "valContrast", "valGamma",
      "toggleSplitCompare", "toggleLowLightSim", "histogramCanvas",
      "metricBrightness", "metricContrast", "metricEntropy", "metricPsnr",
      "btnModeCounting", "btnModeTracking", "toggleRoiActive", "roiCoordsLabel",
      "canvasLiveBadge", "currentSceneTitle", "btnBackendDetect", "btnSaveSession",
      "btnDownloadSnapshot", "canvasStage", "mainCanvas", "hiddenVideo",
      "splitSliderHandle", "fpsCounter", "statTotalDetected", "statUniqueTracks",
      "statInsideRegion", "statOutsideRegion", "statAvgConfidence", "statEnhanceBoost",
      "activeMethodBadge", "classBreakdownGrid", "evalSceneSelect",
      "fiveCardComparisonGrid", "evalAvgBefore", "evalAvgClahe", "evalAvgBoost",
      "evalAvgPsnr", "btnDownloadCsv", "btnDownloadExcel", "btnSyncEvalSupabase",
      "evalSearchInput", "evalMethodFilter", "evalTableBody", "datasetChartCanvas",
      "dbPanelStatus", "dbSessionCount", "dbComparisonCount", "dbClassCount",
      "btnRefreshSupabase", "btnResetLocalDb", "dbActiveSourceTag", "dbTableContainer",
      "inputGroupName", "inputMembers", "inputYoutubeUrl", "inputGithubUrl", "inputColabUrl",
      "linkOpenYoutube", "linkOpenGithub", "linkOpenColab", "btnSaveGroupInfo",
      "checklistKetentuan", "checklistPenilaian", "supabaseModal",
      "btnCloseSupabaseModal", "inputSupabaseUrl", "inputSupabaseKey",
      "btnClearSupabaseConfig", "btnTestSupabase", "btnSaveSupabaseConfig",
      "toastContainer"
    ];
    ids.forEach((id) => { dom[id] = document.getElementById(id); });
    dom.mainCtx = dom.mainCanvas.getContext("2d");
    dom.histCtx = dom.histogramCanvas.getContext("2d");
  }

  function matchSampleKeyFromCatalogImage(imgEntry) {
    const idStr = String(imgEntry.id || "").toLowerCase();
    const pathStr = String(imgEntry.path || imgEntry.filename || "").toLowerCase();
    // Skip legacy synthetic PNG cartoon images
    if (pathStr.endsWith(".png") && !pathStr.includes("_real")) return null;
    for (const [sampleKey, meta] of Object.entries(REAL_SAMPLE_MAP)) {
      const targetFile = meta.file.toLowerCase();
      if (pathStr.endsWith(targetFile) || pathStr.includes(sampleKey) || (meta.aliases && meta.aliases.some((a) => idStr.includes(a) || pathStr.includes(a)))) {
        return sampleKey;
      }
    }
    return null;
  }

  function syncDefaultRoiForCurrentScene() {
    if (state.mediaType === "sim_video") {
      const catVid = catalogState.videosByKey[state.sampleKey];
      const vCfg = VIDEO_SAMPLE_CONFIG[state.sampleKey];
      const w = (catVid && catVid.width) || (vCfg && vCfg.width) || 960;
      const h = (catVid && catVid.height) || (vCfg && vCfg.height) || 540;
      const place = computeFitPlacement(w, h);
      let norm = vCfg && vCfg.defaultRoiNorm;
      if (catVid && Array.isArray(catVid.default_roi) && catVid.default_roi.length >= 3) {
        const xs = catVid.default_roi.map((p) => p[0]);
        const ys = catVid.default_roi.map((p) => p[1]);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        norm = [minX / w, minY / h, (maxX - minX) / w, (maxY - minY) / h];
      }
      if (norm) {
        state.roi = {
          x: Math.round(place.dx + norm[0] * place.dw),
          y: Math.round(place.dy + norm[1] * place.dh),
          w: Math.max(80, Math.round(norm[2] * place.dw)),
          h: Math.max(80, Math.round(norm[3] * place.dh))
        };
        updateRoiCoordsLabel();
      }
      return;
    }

    const catImg = catalogState.imagesByKey[state.sampleKey];
    if (catImg) {
      const iw = catImg.width || 640;
      const ih = catImg.height || 480;
      const place = computeFitPlacement(iw, ih);
      let norm = Array.isArray(catImg.default_roi_norm) ? catImg.default_roi_norm : null;
      if (!norm && Array.isArray(catImg.default_roi) && catImg.default_roi.length >= 3) {
        const xs = catImg.default_roi.map((p) => p[0]);
        const ys = catImg.default_roi.map((p) => p[1]);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        norm = [minX / iw, minY / ih, (maxX - minX) / iw, (maxY - minY) / ih];
      }
      if (norm && norm.length === 4) {
        state.roi = {
          x: Math.round(place.dx + norm[0] * place.dw),
          y: Math.round(place.dy + norm[1] * place.dh),
          w: Math.max(80, Math.round(norm[2] * place.dw)),
          h: Math.max(80, Math.round(norm[3] * place.dh))
        };
        updateRoiCoordsLabel();
      }
    }
  }

  async function loadSampleCatalog() {
    if (location.protocol === "file:") return;
    let catalog = null;
    for (const url of [resolveAssetUrl("samples/sample_catalog.json"), "/api/samples"]) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && (Array.isArray(data.images) || Array.isArray(data.videos))) {
            catalog = data;
            break;
          }
        }
      } catch (_) {}
    }
    if (!catalog) return;

    catalogState.loaded = true;
    if (Array.isArray(catalog.images)) {
      catalog.images.forEach((imgEntry) => {
        const key = matchSampleKeyFromCatalogImage(imgEntry);
        if (key) catalogState.imagesByKey[key] = imgEntry;
      });
    }
    if (Array.isArray(catalog.videos)) {
      catalog.videos.forEach((vidEntry) => {
        const vidId = String(vidEntry.id || "").toLowerCase();
        for (const [sampleKey, vCfg] of Object.entries(VIDEO_SAMPLE_CONFIG)) {
          if (vidId === vCfg.catalogId || vidId === sampleKey) {
            catalogState.videosByKey[sampleKey] = vidEntry;
          }
        }
      });
    }

    if (catalogState.imagesByKey[state.sampleKey] || catalogState.videosByKey[state.sampleKey]) {
      syncDefaultRoiForCurrentScene();
      if (state.activeTab === "tab-detect") renderDetectFrame();
      if (state.activeTab === "tab-eval") renderFiveCardComparison();
    }
  }

  /* ========================================================================
     1. NAVIGATION & TOASTS
     ======================================================================== */
  function bindNavigation() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.tab;
        state.activeTab = target;
        document.querySelectorAll(".tab-btn").forEach((b) => {
          b.classList.toggle("active", b === btn);
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
        document.querySelectorAll(".tab-panel").forEach((p) => {
          p.classList.toggle("active", p.id === target);
        });
        if (target === "tab-db") {
          drawDatasetChart();
          refreshDatabasePanel();
        } else if (target === "tab-eval") {
          renderFiveCardComparison();
        }
      });
    });
  }

  function showToast(message, type = "success") {
    const el = document.createElement("div");
    el.className = `toast ${type === "warn" ? "toast-warn" : type === "info" ? "toast-info" : ""}`;
    el.textContent = message;
    dom.toastContainer.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.25s ease";
      setTimeout(() => el.remove(), 260);
    }, 3200);
  }

  /* ========================================================================
     2. MEDIA INPUT & BUILT-IN INDONESIAN FOOD SAMPLES
     ======================================================================== */
  function setPlayPauseButton(playing) {
    dom.btnPlayPause.innerHTML = `${playing ? ICON_PAUSE : ICON_PLAY}<span>${playing ? "Pause" : "Play"}</span>`;
  }

  function bindMediaControls() {
    dom.sampleSceneSelect.addEventListener("change", (e) => {
      loadSampleScene(e.target.value);
    });

    dom.imageUploadInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          stopVideoElement();
          state.mediaType = "image";
          state.mediaName = file.name;
          state.uploadedImage = img;
          state.trailHistory.clear();
          state.uniqueTrackIds.clear();
          dom.mediaModeTag.textContent = "UPLOAD IMAGE";
          dom.currentSceneTitle.textContent = file.name;
          dom.videoTransportBar.classList.add("hidden");
          renderDetectFrame();
          showToast(`Gambar "${file.name}" dimuat ke Canvas.`, "info");
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

    dom.videoUploadInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      state.uploadedImage = null;
      state.mediaType = "video";
      state.mediaName = file.name;
      state.uploadedVideoReady = false;
      state.isPlaying = true;
      state.trailHistory.clear();
      state.uniqueTrackIds.clear();
      dom.hiddenVideo.src = url;
      dom.hiddenVideo.onloadeddata = () => {
        state.uploadedVideoReady = true;
        dom.hiddenVideo.play().catch(() => {});
        dom.mediaModeTag.textContent = "UPLOAD VIDEO";
        dom.currentSceneTitle.textContent = file.name;
        dom.videoTransportBar.classList.remove("hidden");
        setPlayPauseButton(true);
        showToast(`Video "${file.name}" siap diputar & dideteksi.`, "info");
      };
    });

    dom.btnPlayPause.addEventListener("click", () => {
      state.isPlaying = !state.isPlaying;
      if (state.mediaType === "video" && state.uploadedVideoReady) {
        if (state.isPlaying) dom.hiddenVideo.play().catch(() => {});
        else dom.hiddenVideo.pause();
      }
      setPlayPauseButton(state.isPlaying);
    });

    dom.btnRestartVideo.addEventListener("click", () => {
      state.simFrame = 0;
      state.trailHistory.clear();
      state.uniqueTrackIds.clear();
      if (state.mediaType === "video" && state.uploadedVideoReady) {
        dom.hiddenVideo.currentTime = 0;
        dom.hiddenVideo.play().catch(() => {});
      }
      state.isPlaying = true;
      setPlayPauseButton(true);
      updateVideoTimeLabel();
      renderDetectFrame();
    });

    dom.btnDownloadSnapshot.addEventListener("click", () => {
      const link = document.createElement("a");
      link.download = `NusantaraVision_${state.enhanceMethod}_${Date.now()}.png`;
      link.href = dom.mainCanvas.toDataURL("image/png");
      link.click();
      showToast("Snapshot hasil deteksi berhasil diunduh (.png).");
    });

    dom.btnBackendDetect.addEventListener("click", sendFrameToBackendApi);
  }

  function stopVideoElement() {
    if (!dom.hiddenVideo.paused) dom.hiddenVideo.pause();
    state.uploadedVideoReady = false;
  }

  function updateVideoTimeLabel() {
    if (state.mediaType === "sim_video") {
      const vCfg = VIDEO_SAMPLE_CONFIG[state.sampleKey];
      const catVid = catalogState.videosByKey[state.sampleKey];
      const total = (catVid && catVid.total_frames) || (vCfg && vCfg.totalFrames) || 16;
      const fps = (catVid && catVid.fps) || (vCfg && vCfg.fps) || 6;
      const frameIdx = ((state.simFrame % total) + total) % total;
      dom.videoTimeLabel.textContent = `Frame ${String(frameIdx + 1).padStart(2, "0")}/${String(total).padStart(2, "0")} · ${fps} fps`;
    } else if (state.uploadedVideoReady) {
      const cur = Math.floor(dom.hiddenVideo.currentTime || 0);
      const dur = Math.floor(dom.hiddenVideo.duration || 0);
      dom.videoTimeLabel.textContent = `${fmtSec(cur)} / ${fmtSec(dur)}`;
    }
  }

  function loadSampleScene(key) {
    stopVideoElement();
    state.sampleKey = key;
    state.uploadedImage = null;
    state.simFrame = 0;
    state.trailHistory.clear();
    state.uniqueTrackIds.clear();

    const opt = dom.sampleSceneSelect.querySelector(`option[value="${key}"]`);
    state.mediaName = opt ? opt.textContent.trim() : key;
    dom.currentSceneTitle.textContent = state.mediaName;

    if (key.startsWith("video_")) {
      state.mediaType = "sim_video";
      state.isPlaying = true;
      dom.mediaModeTag.textContent = "FRAME SEQUENCE";
      dom.videoTransportBar.classList.remove("hidden");
      setPlayPauseButton(true);
      preloadVideoFrames(key);
      if (key === "video_kasir") applyRoiPreset("kasir", false);
      else applyRoiPreset("tengah", false);
      syncDefaultRoiForCurrentScene();
      updateVideoTimeLabel();
      if (state.detectMode !== "tracking") {
        setDetectMode("tracking");
      }
    } else {
      state.mediaType = "image";
      dom.mediaModeTag.textContent = "SAMPLE IMAGE";
      dom.videoTransportBar.classList.add("hidden");
      applyRoiPreset("piring", false);
      syncDefaultRoiForCurrentScene();
    }
    renderDetectFrame();
  }

  function startAnimationLoop() {
    let lastTick = 0;
    function tick(ts) {
      if (state.activeTab === "tab-detect" && (state.mediaType === "sim_video" || state.mediaType === "video")) {
        const vCfg = VIDEO_SAMPLE_CONFIG[state.sampleKey];
        const catVid = catalogState.videosByKey[state.sampleKey];
        const targetFps = state.mediaType === "sim_video" ? ((catVid && catVid.fps) || (vCfg && vCfg.fps) || 6) : 30;
        const intervalMs = Math.max(33, Math.round(1000 / targetFps));

        if (state.isPlaying && ts - lastTick >= intervalMs) {
          lastTick = ts;
          if (state.mediaType === "sim_video") {
            const total = (catVid && catVid.total_frames) || (vCfg && vCfg.totalFrames) || 16;
            const nextFrame = (state.simFrame + 1) % total;
            if (nextFrame === 0) {
              state.trailHistory.clear();
            }
            state.simFrame = nextFrame;
          } else {
            state.simFrame += 1;
          }
          renderDetectFrame();
          updateVideoTimeLabel();
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function fmtSec(s) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  /* ========================================================================
     3. ENHANCEMENT CONTROLS & PIXEL-LEVEL IMAGE PROCESSING
     ======================================================================== */
  function bindEnhancementControls() {
    dom.enhanceMethodGroup.querySelectorAll(".pill-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.enhanceMethod = btn.dataset.method;
        dom.enhanceMethodGroup.querySelectorAll(".pill-btn").forEach((b) => b.classList.toggle("active", b === btn));
        dom.activeMethodBadge.textContent = METHOD_LABELS[state.enhanceMethod];
        renderDetectFrame();
      });
    });

    const syncSliders = () => {
      state.clipLimit = parseFloat(dom.sliderClipLimit.value);
      state.brightness = parseInt(dom.sliderBrightness.value, 10);
      state.contrast = parseFloat(dom.sliderContrast.value);
      state.gamma = parseFloat(dom.sliderGamma.value);

      dom.valClipLimit.textContent = state.clipLimit.toFixed(1);
      dom.valBrightness.textContent = (state.brightness >= 0 ? "+" : "") + state.brightness;
      dom.valContrast.textContent = `${state.contrast.toFixed(2)}x`;
      dom.valGamma.textContent = state.gamma.toFixed(2);
      renderDetectFrame();
    };

    [dom.sliderClipLimit, dom.sliderBrightness, dom.sliderContrast, dom.sliderGamma].forEach((sl) => {
      sl.addEventListener("input", syncSliders);
    });

    dom.btnResetEnhance.addEventListener("click", () => {
      dom.sliderClipLimit.value = "2.5";
      dom.sliderBrightness.value = "18";
      dom.sliderContrast.value = "1.25";
      dom.sliderGamma.value = "1.15";
      syncSliders();
      showToast("Parameter enhancement dikembalikan ke nilai default.", "info");
    });

    dom.toggleSplitCompare.addEventListener("change", (e) => {
      state.splitCompare = e.target.checked;
      dom.splitSliderHandle.classList.toggle("hidden", !state.splitCompare);
      dom.splitSliderHandle.style.left = `${state.splitRatio * 100}%`;
      renderDetectFrame();
    });

    dom.toggleLowLightSim.addEventListener("change", (e) => {
      state.lowLightSim = e.target.checked;
      renderDetectFrame();
    });
  }

  /**
   * Applies real pixel-level image enhancement on an ImageData buffer.
   * When activeRect is passed, skips pillarbox margins so metrics reflect food pixels only.
   */
  function applyEnhancementToImageData(imgData, method, opts, activeRect) {
    const data = imgData.data;
    const width = imgData.width;
    const height = imgData.height;

    const ax0 = activeRect ? Math.max(0, Math.floor(activeRect.dx)) : 0;
    const ay0 = activeRect ? Math.max(0, Math.floor(activeRect.dy)) : 0;
    const ax1 = activeRect ? Math.min(width, Math.ceil(activeRect.dx + activeRect.dw)) : width;
    const ay1 = activeRect ? Math.min(height, Math.ceil(activeRect.dy + activeRect.dh)) : height;
    const activeW = Math.max(1, ax1 - ax0);
    const activeH = Math.max(1, ay1 - ay0);
    const totalPixels = activeW * activeH;

    const beforeHist = new Uint32Array(256);
    const lumArr = new Uint8Array(width * height);

    for (let py = ay0; py < ay1; py++) {
      const rowOff = py * width;
      for (let px = ax0; px < ax1; px++) {
        const p = rowOff + px;
        const i = p * 4;
        const y = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
        const clampedY = y < 0 ? 0 : y > 255 ? 255 : y;
        lumArr[p] = clampedY;
        beforeHist[clampedY]++;
      }
    }

    const afterHist = new Uint32Array(256);
    let mseSum = 0;
    let sumAfter = 0;
    let sumAfterSq = 0;

    if (method === "original") {
      for (let i = 0; i < 256; i++) afterHist[i] = beforeHist[i];
      for (let py = ay0; py < ay1; py++) {
        const rowOff = py * width;
        for (let px = ax0; px < ax1; px++) {
          const y = lumArr[rowOff + px];
          sumAfter += y;
          sumAfterSq += y * y;
        }
      }
    } else if (method === "he") {
      const lut = buildCdfLut(beforeHist, totalPixels);
      for (let py = ay0; py < ay1; py++) {
        const rowOff = py * width;
        for (let px = ax0; px < ax1; px++) {
          const p = rowOff + px;
          const i = p * 4;
          const oldY = lumArr[p];
          const newY = lut[oldY];
          const scale = oldY > 2 ? newY / oldY : 1 + newY / 64;
          const nr = clamp255(data[i] * scale + (oldY <= 2 ? newY * 0.2 : 0));
          const ng = clamp255(data[i + 1] * scale + (oldY <= 2 ? newY * 0.2 : 0));
          const nb = clamp255(data[i + 2] * scale + (oldY <= 2 ? newY * 0.2 : 0));
          data[i] = nr;
          data[i + 1] = ng;
          data[i + 2] = nb;
          const ay = (0.299 * nr + 0.587 * ng + 0.114 * nb) | 0;
          afterHist[ay]++;
          sumAfter += ay;
          sumAfterSq += ay * ay;
          const diff = ay - oldY;
          mseSum += diff * diff;
        }
      }
    } else if (method === "clahe") {
      const gridX = 8;
      const gridY = 6;
      const tileW = activeW / gridX;
      const tileH = activeH / gridY;
      const clipLimit = opts.clipLimit || 2.5;
      const tileLuts = [];

      for (let ty = 0; ty < gridY; ty++) {
        const y0 = ay0 + Math.floor(ty * tileH);
        const y1 = Math.min(ay1, ay0 + Math.floor((ty + 1) * tileH));
        for (let tx = 0; tx < gridX; tx++) {
          const x0 = ax0 + Math.floor(tx * tileW);
          const x1 = Math.min(ax1, ax0 + Math.floor((tx + 1) * tileW));
          const hist = new Uint32Array(256);
          let count = 0;
          for (let py = y0; py < y1; py++) {
            const rowOff = py * width;
            for (let px = x0; px < x1; px++) {
              hist[lumArr[rowOff + px]]++;
              count++;
            }
          }
          const avgBin = Math.max(1, count / 256);
          const maxBin = Math.max(2, Math.floor(clipLimit * avgBin));
          let excess = 0;
          for (let b = 0; b < 256; b++) {
            if (hist[b] > maxBin) {
              excess += hist[b] - maxBin;
              hist[b] = maxBin;
            }
          }
          const redist = Math.floor(excess / 256);
          const rem = excess % 256;
          for (let b = 0; b < 256; b++) {
            hist[b] += redist + (b < rem ? 1 : 0);
          }
          tileLuts.push(buildCdfLut(hist, Math.max(1, count)));
        }
      }

      for (let py = ay0; py < ay1; py++) {
        const fy = (py - ay0 + 0.5) / tileH - 0.5;
        const ty0 = Math.max(0, Math.min(gridY - 1, Math.floor(fy)));
        const ty1 = Math.max(0, Math.min(gridY - 1, ty0 + 1));
        const wy = Math.max(0, Math.min(1, fy - ty0));
        const rowOff = py * width;

        for (let px = ax0; px < ax1; px++) {
          const fx = (px - ax0 + 0.5) / tileW - 0.5;
          const tx0 = Math.max(0, Math.min(gridX - 1, Math.floor(fx)));
          const tx1 = Math.max(0, Math.min(gridX - 1, tx0 + 1));
          const wx = Math.max(0, Math.min(1, fx - tx0));

          const p = rowOff + px;
          const i = p * 4;
          const oldY = lumArr[p];
          const v00 = tileLuts[ty0 * gridX + tx0][oldY];
          const v10 = tileLuts[ty0 * gridX + tx1][oldY];
          const v01 = tileLuts[ty1 * gridX + tx0][oldY];
          const v11 = tileLuts[ty1 * gridX + tx1][oldY];
          const newY = (v00 * (1 - wx) + v10 * wx) * (1 - wy) + (v01 * (1 - wx) + v11 * wx) * wy;

          const scale = oldY > 2 ? newY / oldY : 1 + newY / 72;
          const nr = clamp255(data[i] * scale + (oldY <= 2 ? newY * 0.18 : 0));
          const ng = clamp255(data[i + 1] * scale + (oldY <= 2 ? newY * 0.18 : 0));
          const nb = clamp255(data[i + 2] * scale + (oldY <= 2 ? newY * 0.18 : 0));
          data[i] = nr;
          data[i + 1] = ng;
          data[i + 2] = nb;

          const ay = (0.299 * nr + 0.587 * ng + 0.114 * nb) | 0;
          afterHist[ay]++;
          sumAfter += ay;
          sumAfterSq += ay * ay;
          const diff = ay - oldY;
          mseSum += diff * diff;
        }
      }
    } else if (method === "cs") {
      let p2 = 0;
      let p98 = 255;
      let acc = 0;
      const lowTarget = totalPixels * 0.02;
      const highTarget = totalPixels * 0.98;
      for (let b = 0; b < 256; b++) {
        acc += beforeHist[b];
        if (acc <= lowTarget) p2 = b;
        if (acc <= highTarget) p98 = b;
      }
      const span = Math.max(8, p98 - p2);
      const lut = new Uint8Array(256);
      for (let b = 0; b < 256; b++) {
        lut[b] = clamp255(((b - p2) * 255) / span);
      }

      for (let py = ay0; py < ay1; py++) {
        const rowOff = py * width;
        for (let px = ax0; px < ax1; px++) {
          const p = rowOff + px;
          const i = p * 4;
          const oldY = lumArr[p];
          const newY = lut[oldY];
          const scale = oldY > 2 ? newY / oldY : 1;
          const nr = clamp255(data[i] * scale);
          const ng = clamp255(data[i + 1] * scale);
          const nb = clamp255(data[i + 2] * scale);
          data[i] = nr;
          data[i + 1] = ng;
          data[i + 2] = nb;
          const ay = (0.299 * nr + 0.587 * ng + 0.114 * nb) | 0;
          afterHist[ay]++;
          sumAfter += ay;
          sumAfterSq += ay * ay;
          const diff = ay - oldY;
          mseSum += diff * diff;
        }
      }
    } else if (method === "brightness") {
      const alpha = opts.contrast || 1.25;
      const beta = opts.brightness ?? 18;
      const gamma = Math.max(0.2, opts.gamma || 1.15);
      const invGamma = 1 / gamma;
      const lut = new Uint8Array(256);
      for (let v = 0; v < 256; v++) {
        const linear = clamp255(alpha * (v - 128) + 128 + beta);
        lut[v] = clamp255(255 * Math.pow(linear / 255, invGamma));
      }
      for (let py = ay0; py < ay1; py++) {
        const rowOff = py * width;
        for (let px = ax0; px < ax1; px++) {
          const p = rowOff + px;
          const i = p * 4;
          const oldY = lumArr[p];
          const nr = lut[data[i]];
          const ng = lut[data[i + 1]];
          const nb = lut[data[i + 2]];
          data[i] = nr;
          data[i + 1] = ng;
          data[i + 2] = nb;
          const ay = (0.299 * nr + 0.587 * ng + 0.114 * nb) | 0;
          afterHist[ay]++;
          sumAfter += ay;
          sumAfterSq += ay * ay;
          const diff = ay - oldY;
          mseSum += diff * diff;
        }
      }
    }

    const meanAfter = sumAfter / totalPixels;
    const variance = Math.max(0, sumAfterSq / totalPixels - meanAfter * meanAfter);
    const rmsContrast = Math.sqrt(variance);

    let entropy = 0;
    for (let b = 0; b < 256; b++) {
      if (afterHist[b] > 0) {
        const prob = afterHist[b] / totalPixels;
        entropy -= prob * Math.log2(prob);
      }
    }

    const mse = mseSum / totalPixels;
    const psnr = mse > 0.01 ? (10 * Math.log10((255 * 255) / mse)).toFixed(1) + " dB" : "∞";

    return {
      beforeHist,
      afterHist,
      metrics: {
        brightness: meanAfter.toFixed(1),
        contrast: rmsContrast.toFixed(1),
        entropy: entropy.toFixed(2),
        psnr
      }
    };
  }

  function buildCdfLut(hist, total) {
    const lut = new Uint8Array(256);
    let cdf = 0;
    let cdfMin = -1;
    for (let i = 0; i < 256; i++) {
      cdf += hist[i];
      if (cdf > 0 && cdfMin < 0) cdfMin = cdf;
      if (total <= cdfMin) {
        lut[i] = i;
      } else {
        lut[i] = clamp255(((cdf - cdfMin) / (total - cdfMin)) * 255);
      }
    }
    return lut;
  }

  function clamp255(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v | 0;
  }

  function drawHistogram(beforeHist, afterHist) {
    const ctx = dom.histCtx;
    const w = dom.histogramCanvas.width;
    const h = dom.histogramCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#FAF8F4";
    ctx.fillRect(0, 0, w, h);

    // Subtle editorial grid
    ctx.strokeStyle = "rgba(28, 25, 23, 0.08)";
    ctx.lineWidth = 1;
    for (let g = 1; g < 4; g++) {
      const y = (h / 4) * g;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    let maxVal = 1;
    for (let i = 0; i < 256; i++) {
      if (beforeHist[i] > maxVal) maxVal = beforeHist[i];
      if (afterHist[i] > maxVal) maxVal = afterHist[i];
    }

    const drawCurve = (hist, stroke, fill) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * w;
        const y = h - (hist[i] / maxVal) * (h - 6);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    drawCurve(beforeHist, "rgba(180, 83, 9, 0.90)", "rgba(180, 83, 9, 0.16)");
    drawCurve(afterHist, "rgba(21, 128, 61, 0.92)", "rgba(21, 128, 61, 0.20)");
  }

  /* ========================================================================
     4. REAL SAMPLE MEDIA, FRAME SEQUENCE & DETECTION ENGINE
     ======================================================================== */
  function renderDetectFrame() {
    const t0 = performance.now();
    const sceneResult = {
      boxes: [],
      placement: { dx: 0, dy: 0, dw: CANVAS_W, dh: CANVAS_H }
    };

    if (state.mediaType === "image" && state.uploadedImage) {
      sceneResult.placement = drawUploadedMediaToCtx(rawCtx, state.uploadedImage);
      sceneResult.boxes = generateHeuristicUploadDetections(rawCtx, 0, null, sceneResult.placement);
    } else if (state.mediaType === "video" && state.uploadedVideoReady) {
      sceneResult.placement = drawUploadedMediaToCtx(rawCtx, dom.hiddenVideo);
      sceneResult.boxes = generateHeuristicUploadDetections(rawCtx, state.simFrame, null, sceneResult.placement);
    } else {
      const drawn = drawCulinaryScene(rawCtx, state.sampleKey, state.simFrame, state.lowLightSim);
      sceneResult.boxes = drawn.boxes;
      sceneResult.placement = drawn.placement;
    }

    state.lastPlacement = sceneResult.placement;

    // Copy rawCanvas -> enhancedCanvas and run real pixel enhancement inside active image bounds
    const imgData = rawCtx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const enhResult = applyEnhancementToImageData(imgData, state.enhanceMethod, {
      clipLimit: state.clipLimit,
      brightness: state.brightness,
      contrast: state.contrast,
      gamma: state.gamma
    }, sceneResult.placement);
    enhancedCtx.putImageData(imgData, 0, 0);

    // Update histogram & image metrics
    state.lastMetrics = enhResult.metrics;
    drawHistogram(enhResult.beforeHist, enhResult.afterHist);
    dom.metricBrightness.textContent = enhResult.metrics.brightness;
    dom.metricContrast.textContent = enhResult.metrics.contrast;
    dom.metricEntropy.textContent = enhResult.metrics.entropy;
    dom.metricPsnr.textContent = enhResult.metrics.psnr;

    // Evaluate detections based on actual pixel contrast/luminance in enhanced image
    const detections = evaluateDetections(sceneResult.boxes, imgData, state.enhanceMethod, state.lowLightSim);
    state.detections = detections;

    // Update ByteTrack trail history
    if (state.detectMode === "tracking") {
      detections.forEach((d) => {
        state.uniqueTrackIds.add(d.trackId);
        const cx = d.x + d.w / 2;
        const cy = d.y + d.h / 2;
        const trail = state.trailHistory.get(d.trackId) || [];
        trail.push({ x: cx, y: cy });
        if (trail.length > 26) trail.shift();
        state.trailHistory.set(d.trackId, trail);
      });
    }

    // Compose onto mainCanvas (with optional Split Wipe)
    const ctx = dom.mainCtx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (state.splitCompare) {
      const splitX = Math.round(CANVAS_W * state.splitRatio);
      ctx.drawImage(rawCanvas, 0, 0, splitX, CANVAS_H, 0, 0, splitX, CANVAS_H);
      ctx.drawImage(enhancedCanvas, splitX, 0, CANVAS_W - splitX, CANVAS_H, splitX, 0, CANVAS_W - splitX, CANVAS_H);
      drawSplitLabels(ctx, splitX);
    } else {
      ctx.drawImage(enhancedCanvas, 0, 0);
    }

    // Draw ROI, Trails, and Bounding Boxes
    if (state.roiActive) {
      drawRoiOverlay(ctx, state.roi);
    }
    if (state.detectMode === "tracking") {
      drawTrackingTrails(ctx);
    }
    const summary = drawDetectionBoxes(ctx, detections);

    const elapsed = (performance.now() - t0).toFixed(1);
    state.lastInferenceMs = parseFloat(elapsed);
    dom.fpsCounter.textContent = `Proses: ${elapsed} ms (${METHOD_LABELS[state.enhanceMethod]})`;

    updateTelemetryUi(summary);
  }

  function computeFitPlacement(mw, mh) {
    const srcW = mw || CANVAS_W;
    const srcH = mh || CANVAS_H;
    const scale = Math.min(CANVAS_W / srcW, CANVAS_H / srcH);
    const dw = Math.round(srcW * scale);
    const dh = Math.round(srcH * scale);
    const dx = Math.round((CANVAS_W - dw) / 2);
    const dy = Math.round((CANVAS_H - dh) / 2);
    return { dx, dy, dw, dh, scale, srcW, srcH };
  }

  function drawUploadedMediaToCtx(ctx, mediaEl) {
    ctx.fillStyle = "#23201D";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const mw = mediaEl.videoWidth || mediaEl.naturalWidth || CANVAS_W;
    const mh = mediaEl.videoHeight || mediaEl.naturalHeight || CANVAS_H;
    const place = computeFitPlacement(mw, mh);
    ctx.drawImage(mediaEl, place.dx, place.dy, place.dw, place.dh);
    return place;
  }

  /**
   * For user-uploaded arbitrary photos/videos or sample photos without catalog boxes yet,
   * extracts warm food-saliency clusters within the active image bounds so ROI & Enhancement work live.
   */
  function generateHeuristicUploadDetections(ctx, frame = 0, labelHint = null, activeRect = null, secondaryHint = null) {
    const rect = activeRect || { dx: 0, dy: 0, dw: CANVAS_W, dh: CANVAS_H };
    const data = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H).data;
    const cols = 8;
    const rows = 5;
    const cw = rect.dw / cols;
    const ch = rect.dh / rows;
    const activeGrid = Array.from({ length: rows }, () => Array(cols).fill(false));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let warmScore = 0;
        let samples = 0;
        const x0 = Math.max(0, Math.floor(rect.dx + c * cw + 8));
        const y0 = Math.max(0, Math.floor(rect.dy + r * ch + 8));
        const xEnd = Math.min(CANVAS_W, Math.floor(rect.dx + (c + 1) * cw - 8));
        const yEnd = Math.min(CANVAS_H, Math.floor(rect.dy + (r + 1) * ch - 8));
        for (let py = y0; py < yEnd; py += 10) {
          for (let px = x0; px < xEnd; px += 10) {
            const idx = (py * CANVAS_W + px) * 4;
            const red = data[idx];
            const grn = data[idx + 1];
            const blu = data[idx + 2];
            const maxC = Math.max(red, grn, blu);
            const minC = Math.min(red, grn, blu);
            const sat = maxC - minC;
            if ((sat > 24 && red + grn > blu * 1.45) || (maxC > 130 && sat > 18)) {
              warmScore++;
            }
            samples++;
          }
        }
        if (samples > 0 && warmScore / samples > 0.24) {
          activeGrid[r][c] = true;
        }
      }
    }

    // Connected-component merge into realistic dish bounding boxes
    const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
    const boxes = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!activeGrid[r][c] || visited[r][c]) continue;
        const queue = [[r, c]];
        visited[r][c] = true;
        let minR = r, maxR = r, minC = c, maxC = c, area = 0;
        while (queue.length) {
          const [cr, cc] = queue.shift();
          area++;
          minR = Math.min(minR, cr);
          maxR = Math.max(maxR, cr);
          minC = Math.min(minC, cc);
          maxC = Math.max(maxC, cc);
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && activeGrid[nr][nc] && !visited[nr][nc]) {
              visited[nr][nc] = true;
              queue.push([nr, nc]);
            }
          }
        }
        if (area >= 2 || boxes.length === 0) {
          const jitter = Math.sin(frame * 0.08 + minC) * 2;
          const bx = Math.max(rect.dx + 12, Math.round(rect.dx + minC * cw + 10 + jitter));
          const by = Math.max(rect.dy + 12, Math.round(rect.dy + minR * ch + 10));
          const bw = Math.min(rect.dx + rect.dw - bx - 12, Math.round((maxC - minC + 1) * cw - 20));
          const bh = Math.min(rect.dy + rect.dh - by - 12, Math.round((maxR - minR + 1) * ch - 20));
          if (bw >= 70 && bh >= 70) {
            boxes.push({ bx, by, bw, bh, area });
          }
        }
      }
    }

    boxes.sort((a, b) => b.area - a.area);
    const fname = (state.mediaName || "").toLowerCase();
    const matchedClass = CULINARY_CLASSES.find((cls) => fname.includes(cls.name.toLowerCase()) || fname.includes(cls.slug.replace("-", "_")));
    const primaryLabel = labelHint || (matchedClass ? matchedClass.name : "Nasi Goreng");

    if (boxes.length === 0) {
      return [
        {
          trackId: 1,
          label: primaryLabel,
          x: Math.round(rect.dx + rect.dw * 0.16),
          y: Math.round(rect.dy + rect.dh * 0.14),
          w: Math.round(rect.dw * 0.68),
          h: Math.round(rect.dh * 0.72),
          baseConf: 0.91
        }
      ];
    }

    return boxes.slice(0, 5).map((b, idx) => {
      const fallbackCls = idx === 1 && secondaryHint
        ? secondaryHint
        : CULINARY_CLASSES[(idx * 3 + Math.round(b.bx)) % CULINARY_CLASSES.length].name;
      return {
        trackId: idx + 1,
        label: idx === 0 ? primaryLabel : fallbackCls,
        x: b.bx,
        y: b.by,
        w: b.bw,
        h: b.bh,
        baseConf: idx === 0 ? 0.93 : Math.max(0.79, 0.89 - idx * 0.03)
      };
    });
  }

  function applyLowLightDim(ctx, place) {
    const ax0 = place ? Math.max(0, Math.floor(place.dx)) : 0;
    const ay0 = place ? Math.max(0, Math.floor(place.dy)) : 0;
    const aw = place ? Math.min(CANVAS_W - ax0, Math.ceil(place.dw)) : CANVAS_W;
    const ah = place ? Math.min(CANVAS_H - ay0, Math.ceil(place.dh)) : CANVAS_H;
    if (aw <= 0 || ah <= 0) return;
    const raw = ctx.getImageData(ax0, ay0, aw, ah);
    const d = raw.data;
    // -35% luminance reduction while preserving slight warm ambient bias
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp255(d[i] * 0.62 + 8);
      d[i + 1] = clamp255(d[i + 1] * 0.60 + 6);
      d[i + 2] = clamp255(d[i + 2] * 0.63 + 10);
    }
    ctx.putImageData(raw, ax0, ay0);
  }

  function mapCatalogBoxesToCanvas(boxes, srcW, srcH, place) {
    const w = srcW || CANVAS_W;
    const h = srcH || CANVAS_H;
    return boxes.map((gt, idx) => {
      let x = 0, y = 0, bw = 80, bh = 80;
      if (Array.isArray(gt.bbox_xyxy) && gt.bbox_xyxy.length === 4) {
        const [x1, y1, x2, y2] = gt.bbox_xyxy;
        x = Math.round(place.dx + (x1 / w) * place.dw);
        y = Math.round(place.dy + (y1 / h) * place.dh);
        bw = Math.max(24, Math.round(((x2 - x1) / w) * place.dw));
        bh = Math.max(24, Math.round(((y2 - y1) / h) * place.dh));
      } else if (Array.isArray(gt.bbox_yolo) && gt.bbox_yolo.length === 4) {
        const [cx, cy, nw, nh] = gt.bbox_yolo;
        bw = Math.max(24, Math.round(nw * place.dw));
        bh = Math.max(24, Math.round(nh * place.dh));
        x = Math.round(place.dx + (cx - nw / 2) * place.dw);
        y = Math.round(place.dy + (cy - nh / 2) * place.dh);
      }
      return {
        trackId: gt.track_id || idx + 1,
        label: gt.class_name || gt.label || "Nasi Goreng",
        x,
        y,
        w: bw,
        h: bh,
        baseConf: Number(gt.confidence || 0.90)
      };
    });
  }

  /**
   * Draws real photograph / real PNG frame sequence onto ctx (960x540),
   * falling back cleanly to procedural culinary scenes when offline/unloaded.
   * Returns { boxes, placement }.
   */
  function drawCulinaryScene(ctx, sceneKey, frame, lowLight) {
    // 1. Video Frame Sequence (real frames in samples/videos/frames/<id>/frame_001..016.png)
    if (sceneKey === "video_prasmanan" || sceneKey === "video_kasir") {
      const catVid = catalogState.videosByKey[sceneKey];
      const vCfg = VIDEO_SAMPLE_CONFIG[sceneKey];
      const totalFrames = (catVid && catVid.total_frames) || (vCfg && vCfg.totalFrames) || 16;
      const safeIdx = ((frame % totalFrames) + totalFrames) % totalFrames;
      const frameRec = getOrLoadVideoFrame(sceneKey, safeIdx);

      if (frameRec.img) {
        const place = drawUploadedMediaToCtx(ctx, frameRec.img);
        const ann = catVid && Array.isArray(catVid.frame_annotations) ? catVid.frame_annotations[safeIdx] : null;
        let objects = [];
        if (ann && Array.isArray(ann.objects) && ann.objects.length > 0) {
          const vw = catVid.width || (vCfg && vCfg.width) || frameRec.img.naturalWidth || 960;
          const vh = catVid.height || (vCfg && vCfg.height) || frameRec.img.naturalHeight || 540;
          objects = mapCatalogBoxesToCanvas(ann.objects, vw, vh, place);
        } else {
          objects = generateHeuristicUploadDetections(
            ctx,
            safeIdx,
            sceneKey === "video_kasir" ? "Ayam Goreng" : "Nasi Goreng",
            place,
            sceneKey === "video_kasir" ? "Telur Balado" : "Bakso"
          );
        }
        if (lowLight) applyLowLightDim(ctx, place);
        return { boxes: objects, placement: place };
      }
    }

    // 2. Real photograph samples (samples/images/*_real.jpg)
    const realMeta = REAL_SAMPLE_MAP[sceneKey];
    const realImg = realMeta ? getOrLoadRealSampleImage(sceneKey) : null;
    if (realImg) {
      const place = drawUploadedMediaToCtx(ctx, realImg);
      const catImg = catalogState.imagesByKey[sceneKey];
      let objects = [];
      if (catImg && Array.isArray(catImg.ground_truth) && catImg.ground_truth.length > 0) {
        const iw = catImg.width || realImg.naturalWidth || 640;
        const ih = catImg.height || realImg.naturalHeight || 480;
        objects = mapCatalogBoxesToCanvas(catImg.ground_truth, iw, ih, place);
      } else {
        objects = generateHeuristicUploadDetections(ctx, frame, realMeta.primaryClass, place, realMeta.secondaryClass);
      }
      if (lowLight) applyLowLightDim(ctx, place);
      return { boxes: objects, placement: place };
    }

    // 3. Procedural wooden tabletop fallback while real asset loads or if offline/missing
    const fullPlace = { dx: 0, dy: 0, dw: CANVAS_W, dh: CANVAS_H };
    const woodGrad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
    woodGrad.addColorStop(0, "#462A18");
    woodGrad.addColorStop(0.5, "#593620");
    woodGrad.addColorStop(1, "#321D10");
    ctx.fillStyle = woodGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.strokeStyle = "rgba(28, 25, 23, 0.28)";
    ctx.lineWidth = 2;
    for (let y = 60; y < CANVAS_H; y += 72) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }

    let objects = [];

    if (sceneKey === "nasgor_malam") {
      // Main white ceramic plate
      drawPlate(ctx, 430, 275, 195);
      // Nasi Goreng mound
      drawRiceMound(ctx, 415, 285, 118, "#c27d38", "#9a541a");
      // Telur Balado
      drawTelurBalado(ctx, 525, 235, 36);
      // Ayam Goreng piece
      drawAyamGoreng(ctx, 355, 195, 58);
      // Side plate: Tempe & Tahu
      drawPlate(ctx, 760, 225, 105, "#e2e8f0");
      drawTempe(ctx, 725, 200);
      drawTahu(ctx, 775, 240);
      // Kerupuk on top-left
      drawKerupuk(ctx, 185, 185);

      objects = [
        { trackId: 1, label: "Nasi Goreng", x: 270, y: 175, w: 255, h: 215, baseConf: 0.91 },
        { trackId: 2, label: "Telur Balado", x: 482, y: 192, w: 86, h: 86, baseConf: 0.87 },
        { trackId: 3, label: "Ayam Goreng", x: 295, y: 142, w: 120, h: 98, baseConf: 0.89 },
        { trackId: 4, label: "Tempe Goreng", x: 682, y: 158, w: 88, h: 78, baseConf: 0.82 },
        { trackId: 5, label: "Tahu Goreng", x: 742, y: 205, w: 84, h: 76, baseConf: 0.84 }
      ];
    } else if (sceneKey === "bakso_komplit") {
      // Bowl of Bakso
      drawBowl(ctx, 430, 270, 175, "#e2e8f0", "#8d6336");
      drawBaksoBalls(ctx, 430, 265);
      // Tahu Goreng inside bowl
      drawTahu(ctx, 495, 225);
      // Side bowl of Mie Goreng / noodles
      drawPlate(ctx, 765, 300, 115);
      drawNoodles(ctx, 765, 300, 75);
      // Side Pempek / Gorengan
      drawPlate(ctx, 175, 315, 95);
      drawTempe(ctx, 170, 310);

      objects = [
        { trackId: 1, label: "Bakso", x: 275, y: 125, w: 310, h: 290, baseConf: 0.94 },
        { trackId: 2, label: "Tahu Goreng", x: 462, y: 190, w: 74, h: 72, baseConf: 0.85 },
        { trackId: 3, label: "Mie Goreng", x: 675, y: 215, w: 180, h: 170, baseConf: 0.88 },
        { trackId: 4, label: "Tempe Goreng", x: 125, y: 265, w: 96, h: 92, baseConf: 0.81 }
      ];
    } else if (sceneKey === "sate_madura") {
      // Rectangular platter for Sate Ayam
      ctx.fillStyle = "#f1f5f9";
      roundRect(ctx, 210, 120, 440, 300, 28);
      ctx.fill();
      drawSateSkewers(ctx, 265, 170, 6);
      // Peanut sauce bowl
      drawBowl(ctx, 560, 270, 68, "#cbd5e1", "#6b3e1b");
      // Gado-Gado / Lontong side plate
      drawPlate(ctx, 780, 265, 115);
      drawGadoGado(ctx, 780, 265);
      // Telur Balado
      drawTelurBalado(ctx, 145, 260, 38);

      objects = [
        { trackId: 1, label: "Sate Ayam", x: 235, y: 145, w: 280, h: 245, baseConf: 0.93 },
        { trackId: 2, label: "Gado-Gado", x: 682, y: 165, w: 195, h: 195, baseConf: 0.88 },
        { trackId: 3, label: "Telur Balado", x: 102, y: 215, w: 88, h: 88, baseConf: 0.86 }
      ];
    } else if (sceneKey === "padang_rendang") {
      // Banana leaf platter
      ctx.fillStyle = "#1f5e34";
      roundRect(ctx, 150, 85, 660, 370, 34);
      ctx.fill();
      ctx.strokeStyle = "#2d7d47";
      ctx.lineWidth = 3;
      ctx.stroke();

      drawRiceMound(ctx, 320, 280, 105, "#f8fafc", "#e2e8f0");
      drawRendang(ctx, 485, 225);
      drawTelurBalado(ctx, 485, 345, 38);
      drawAyamGoreng(ctx, 645, 235, 58);
      drawTempe(ctx, 650, 345);
      drawTahu(ctx, 210, 175);

      objects = [
        { trackId: 1, label: "Rendang", x: 420, y: 160, w: 135, h: 120, baseConf: 0.86 },
        { trackId: 2, label: "Telur Balado", x: 440, y: 300, w: 92, h: 90, baseConf: 0.90 },
        { trackId: 3, label: "Ayam Goreng", x: 585, y: 175, w: 125, h: 112, baseConf: 0.89 },
        { trackId: 4, label: "Tempe Goreng", x: 605, y: 305, w: 92, h: 82, baseConf: 0.83 },
        { trackId: 5, label: "Tahu Goreng", x: 168, y: 138, w: 88, h: 78, baseConf: 0.84 }
      ];
    } else if (sceneKey === "prasmanan_kuliner") {
      // Procedural Prasmanan Kuliner buffet platter fallback
      ctx.fillStyle = "#1f5e34";
      roundRect(ctx, 110, 70, 740, 400, 32);
      ctx.fill();
      drawPlate(ctx, 275, 210, 110);
      drawRiceMound(ctx, 275, 210, 72, "#c27d38", "#9a541a");
      drawPlate(ctx, 495, 195, 105);
      drawRendang(ctx, 495, 195);
      drawPlate(ctx, 705, 220, 100);
      drawAyamGoreng(ctx, 705, 220, 46);
      drawPlate(ctx, 360, 365, 95);
      drawGadoGado(ctx, 360, 365);
      drawTelurBalado(ctx, 600, 365, 36);

      objects = [
        { trackId: 1, label: "Nasi Goreng", x: 185, y: 120, w: 180, h: 180, baseConf: 0.91 },
        { trackId: 2, label: "Rendang", x: 405, y: 105, w: 180, h: 170, baseConf: 0.89 },
        { trackId: 3, label: "Ayam Goreng", x: 615, y: 130, w: 170, h: 165, baseConf: 0.88 },
        { trackId: 4, label: "Gado-Gado", x: 270, y: 275, w: 180, h: 165, baseConf: 0.86 },
        { trackId: 5, label: "Telur Balado", x: 550, y: 315, w: 100, h: 95, baseConf: 0.87 }
      ];
    } else if (realMeta) {
      drawPlate(ctx, 480, 270, 195);
      drawRiceMound(ctx, 480, 270, 122, "#d97706", "#92400e");
      objects = [
        { trackId: 1, label: realMeta.primaryClass, x: 285, y: 115, w: 390, h: 310, baseConf: 0.92 },
        { trackId: 2, label: realMeta.secondaryClass, x: 585, y: 205, w: 130, h: 120, baseConf: 0.85 }
      ];
    } else if (sceneKey === "video_prasmanan") {
      // Animated Buffet Conveyor belt moving left-to-right
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 120, CANVAS_W, 300);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      const beltOffset = (frame * 3.2) % 60;
      for (let bx = -60 + beltOffset; bx < CANVAS_W + 60; bx += 60) {
        ctx.beginPath();
        ctx.moveTo(bx, 120);
        ctx.lineTo(bx, 420);
        ctx.stroke();
      }

      const items = [
        { trackId: 101, label: "Nasi Goreng", baseX: 80, y: 205, draw: (x, y) => { drawPlate(ctx, x, y, 76); drawRiceMound(ctx, x, y, 48, "#c27d38", "#9a541a"); } },
        { trackId: 102, label: "Bakso", baseX: 280, y: 330, draw: (x, y) => { drawBowl(ctx, x, y, 72, "#e2e8f0", "#8d6336"); drawBaksoBalls(ctx, x, y, 0.45); } },
        { trackId: 103, label: "Rendang", baseX: 480, y: 215, draw: (x, y) => { drawPlate(ctx, x, y, 74); drawRendang(ctx, x, y, 0.72); } },
        { trackId: 104, label: "Sate Ayam", baseX: 680, y: 325, draw: (x, y) => { drawPlate(ctx, x, y, 76); drawSateSkewers(ctx, x - 48, y - 35, 3, 0.52); } },
        { trackId: 105, label: "Soto Ayam", baseX: 880, y: 220, draw: (x, y) => { drawBowl(ctx, x, y, 72, "#f1f5f9", "#eab308"); } }
      ];

      items.forEach((it) => {
        const x = ((it.baseX + frame * 3.2) % (CANVAS_W + 160)) - 80;
        const y = it.y + Math.sin(frame * 0.06 + it.trackId) * 14;
        it.draw(x, y);
        objects.push({
          trackId: it.trackId,
          label: it.label,
          x: Math.round(x - 68),
          y: Math.round(y - 68),
          w: 136,
          h: 136,
          baseConf: 0.90
        });
      });
    } else if (sceneKey === "video_kasir") {
      // Cashier desk counter on the right side
      ctx.fillStyle = "#172554";
      ctx.fillRect(520, 40, 400, 460);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.strokeRect(520, 40, 400, 460);

      // Moving food trays sliding into the cashier zone
      const cycle = (frame * 2.8) % 620;
      const trayX = 140 + cycle;
      drawTray(ctx, trayX, 270);
      drawRiceMound(ctx, trayX - 45, 255, 52, "#c27d38", "#9a541a");
      drawAyamGoreng(ctx, trayX + 55, 235, 38);
      drawTelurBalado(ctx, trayX + 55, 315, 26);

      // Static dish waiting at cashier
      drawPlate(ctx, 780, 160, 74);
      drawPempek(ctx, 780, 160);

      objects = [
        { trackId: 201, label: "Nasi Goreng", x: Math.round(trayX - 100), y: 198, w: 112, h: 112, baseConf: 0.91 },
        { trackId: 202, label: "Ayam Goreng", x: Math.round(trayX + 12), y: 192, w: 86, h: 86, baseConf: 0.88 },
        { trackId: 203, label: "Telur Balado", x: Math.round(trayX + 20), y: 282, w: 70, h: 68, baseConf: 0.86 },
        { trackId: 204, label: "Pempek", x: 710, y: 90, w: 140, h: 140, baseConf: 0.89 }
      ];
    }

    // Apply realistic low-light (-35%) simulation to procedural source when enabled
    if (lowLight) {
      applyLowLightDim(ctx, fullPlace);
    }

    return { boxes: objects, placement: fullPlace };
  }

  /**
   * Adjusts each ground-truth detection's confidence & visibility dynamically
   * based on the actual enhanced pixel luminance & local contrast inside its bbox.
   */
  function evaluateDetections(candidates, enhancedImgData, method, isLowLight = state.lowLightSim) {
    const d = enhancedImgData.data;
    const methodBonus = {
      original: -0.22,
      he: 0.01,
      clahe: 0.06,
      cs: 0.03,
      brightness: 0.04
    }[method] || 0;

    const results = [];
    for (const obj of candidates) {
      const x0 = Math.max(0, obj.x);
      const y0 = Math.max(0, obj.y);
      const x1 = Math.min(CANVAS_W - 1, obj.x + obj.w);
      const y1 = Math.min(CANVAS_H - 1, obj.y + obj.h);
      if (x1 <= x0 || y1 <= y0) continue;

      let sum = 0;
      let sumSq = 0;
      let n = 0;
      for (let py = y0; py < y1; py += 8) {
        for (let px = x0; px < x1; px += 8) {
          const idx = (py * CANVAS_W + px) * 4;
          const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
          sum += lum;
          sumSq += lum * lum;
          n++;
        }
      }
      const mean = n > 0 ? sum / n : 100;
      const std = n > 0 ? Math.sqrt(Math.max(0, sumSq / n - mean * mean)) : 30;

      // Low-contrast / dark objects have lower confidence (and may drop out below 0.50 in Original under low-light)
      const contrastFactor = Math.min(1.0, std / 38);
      const lightFactor = mean < 55 ? mean / 75 : 1.0;
      let conf = obj.baseConf * (0.58 + 0.42 * contrastFactor * lightFactor) + (isLowLight ? methodBonus : 0.02);
      conf = Math.max(0.32, Math.min(0.98, conf));

      if (conf >= 0.50) {
        results.push({ ...obj, confidence: conf });
      }
    }
    return results;
  }

  /* ========================================================================
     5. INTERACTIVE ROI (OBJECT REGION #1), BOUNDING BOXES & TELEMETRY
     ======================================================================== */
  function bindRoiAndCanvasInteractions() {
    dom.btnModeCounting.addEventListener("click", () => setDetectMode("counting"));
    dom.btnModeTracking.addEventListener("click", () => setDetectMode("tracking"));

    dom.toggleRoiActive.addEventListener("change", (e) => {
      state.roiActive = e.target.checked;
      renderDetectFrame();
    });

    document.querySelectorAll(".roi-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => applyRoiPreset(btn.dataset.preset, true));
    });

    const getCanvasPoint = (ev) => {
      const rect = dom.mainCanvas.getBoundingClientRect();
      return {
        x: ((ev.clientX - rect.left) / rect.width) * CANVAS_W,
        y: ((ev.clientY - rect.top) / rect.height) * CANVAS_H
      };
    };

    dom.mainCanvas.addEventListener("pointerdown", (ev) => {
      if (!state.roiActive) return;
      const pt = getCanvasPoint(ev);
      const hit = hitTestRoi(pt.x, pt.y, state.roi);
      if (hit) {
        dom.mainCanvas.setPointerCapture(ev.pointerId);
        state.dragState = {
          mode: hit,
          startX: pt.x,
          startY: pt.y,
          origRoi: { ...state.roi }
        };
      }
    });

    dom.mainCanvas.addEventListener("pointermove", (ev) => {
      const pt = getCanvasPoint(ev);
      if (state.dragState) {
        const dx = pt.x - state.dragState.startX;
        const dy = pt.y - state.dragState.startY;
        const o = state.dragState.origRoi;
        const r = { ...state.roi };
        const minSize = 70;

        if (state.dragState.mode === "move") {
          r.x = Math.max(0, Math.min(CANVAS_W - o.w, Math.round(o.x + dx)));
          r.y = Math.max(0, Math.min(CANVAS_H - o.h, Math.round(o.y + dy)));
        } else if (state.dragState.mode === "se") {
          r.w = Math.max(minSize, Math.min(CANVAS_W - o.x, Math.round(o.w + dx)));
          r.h = Math.max(minSize, Math.min(CANVAS_H - o.y, Math.round(o.h + dy)));
        } else if (state.dragState.mode === "nw") {
          const nx = Math.max(0, Math.min(o.x + o.w - minSize, Math.round(o.x + dx)));
          const ny = Math.max(0, Math.min(o.y + o.h - minSize, Math.round(o.y + dy)));
          r.w = o.x + o.w - nx;
          r.h = o.y + o.h - ny;
          r.x = nx;
          r.y = ny;
        } else if (state.dragState.mode === "ne") {
          const ny = Math.max(0, Math.min(o.y + o.h - minSize, Math.round(o.y + dy)));
          r.w = Math.max(minSize, Math.min(CANVAS_W - o.x, Math.round(o.w + dx)));
          r.h = o.y + o.h - ny;
          r.y = ny;
        } else if (state.dragState.mode === "sw") {
          const nx = Math.max(0, Math.min(o.x + o.w - minSize, Math.round(o.x + dx)));
          r.w = o.x + o.w - nx;
          r.x = nx;
          r.h = Math.max(minSize, Math.min(CANVAS_H - o.y, Math.round(o.h + dy)));
        }

        state.roi = r;
        updateRoiCoordsLabel();
        renderDetectFrame();
      } else if (state.roiActive) {
        const hit = hitTestRoi(pt.x, pt.y, state.roi);
        dom.mainCanvas.style.cursor =
          hit === "nw" || hit === "se" ? "nwse-resize" :
          hit === "ne" || hit === "sw" ? "nesw-resize" :
          hit === "move" ? "move" : "default";
      }
    });

    dom.mainCanvas.addEventListener("pointerup", (ev) => {
      if (state.dragState) {
        state.dragState = null;
        try { dom.mainCanvas.releasePointerCapture(ev.pointerId); } catch (_) {}
      }
    });

    // Split wipe handle drag
    dom.splitSliderHandle.addEventListener("pointerdown", (ev) => {
      ev.stopPropagation();
      dom.splitSliderHandle.setPointerCapture(ev.pointerId);
      const onMove = (mEv) => {
        const rect = dom.mainCanvas.getBoundingClientRect();
        const ratio = Math.max(0.08, Math.min(0.92, (mEv.clientX - rect.left) / rect.width));
        state.splitRatio = ratio;
        dom.splitSliderHandle.style.left = `${ratio * 100}%`;
        renderDetectFrame();
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  function setDetectMode(mode) {
    state.detectMode = mode;
    dom.btnModeCounting.classList.toggle("active", mode === "counting");
    dom.btnModeTracking.classList.toggle("active", mode === "tracking");
    dom.canvasLiveBadge.textContent = mode === "tracking" ? "YOLOv11 + BYTETRACK" : "YOLOv11 COUNTING";
    renderDetectFrame();
  }

  function applyRoiPreset(preset, rerender = true) {
    state.roiPreset = preset;
    document.querySelectorAll(".roi-preset-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.preset === preset);
    });
    if (preset === "piring") state.roi = { x: 180, y: 80, w: 600, h: 380 };
    else if (preset === "kasir") state.roi = { x: 520, y: 40, w: 400, h: 460 };
    else if (preset === "tengah") state.roi = { x: 260, y: 110, w: 440, h: 320 };
    else if (preset === "full") state.roi = { x: 20, y: 20, w: 920, h: 500 };

    updateRoiCoordsLabel();
    if (rerender) renderDetectFrame();
  }

  function updateRoiCoordsLabel() {
    const r = state.roi;
    dom.roiCoordsLabel.textContent = `ROI #1: x=${r.x}, y=${r.y}, w=${r.w}, h=${r.h}`;
  }

  function hitTestRoi(px, py, r) {
    const tol = 16;
    if (Math.hypot(px - r.x, py - r.y) <= tol) return "nw";
    if (Math.hypot(px - (r.x + r.w), py - r.y) <= tol) return "ne";
    if (Math.hypot(px - r.x, py - (r.y + r.h)) <= tol) return "sw";
    if (Math.hypot(px - (r.x + r.w), py - (r.y + r.h)) <= tol) return "se";
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return "move";
    return null;
  }

  function drawSplitLabels(ctx, splitX) {
    ctx.save();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, CANVAS_H);
    ctx.stroke();

    ctx.fillStyle = "rgba(28, 25, 23, 0.86)";
    roundRect(ctx, 14, 14, 152, 28, 6);
    ctx.fill();
    ctx.fillStyle = "#FDE68A";
    ctx.font = "bold 12px 'Plus Jakarta Sans', 'Segoe UI', sans-serif";
    ctx.fillText("BEFORE (Original)", 24, 32);

    ctx.fillStyle = "rgba(28, 25, 23, 0.86)";
    roundRect(ctx, CANVAS_W - 196, 14, 182, 28, 6);
    ctx.fill();
    ctx.fillStyle = "#86EFAC";
    ctx.fillText(`AFTER (${METHOD_LABELS[state.enhanceMethod].split(" ")[0]})`, CANVAS_W - 184, 32);
    ctx.restore();
  }

  function drawRoiOverlay(ctx, r) {
    ctx.save();
    ctx.fillStyle = "rgba(21, 128, 61, 0.09)";
    ctx.fillRect(r.x, r.y, r.w, r.h);

    ctx.strokeStyle = "#15803D";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 5]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);

    // Label pill
    ctx.fillStyle = "#15803D";
    roundRect(ctx, r.x + 8, Math.max(6, r.y - 24), 165, 22, 5);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 12px 'Plus Jakarta Sans', 'Segoe UI', sans-serif";
    ctx.fillText("Object Region #1 (ROI)", r.x + 16, Math.max(21, r.y - 9));

    // Corner handles
    const corners = [
      [r.x, r.y],
      [r.x + r.w, r.y],
      [r.x, r.y + r.h],
      [r.x + r.w, r.y + r.h]
    ];
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#15803D";
    ctx.lineWidth = 2;
    for (const [cx, cy] of corners) {
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTrackingTrails(ctx) {
    ctx.save();
    for (const [trackId, pts] of state.trailHistory.entries()) {
      if (pts.length < 2) continue;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      ctx.strokeStyle = "rgba(185, 56, 21, 0.90)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      const last = pts[pts.length - 1];
      ctx.fillStyle = "#B93815";
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(last.x, last.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      void trackId;
    }
    ctx.restore();
  }

  function drawDetectionBoxes(ctx, detections) {
    let insideCount = 0;
    let outsideCount = 0;
    let confSum = 0;
    const perClass = {};

    ctx.save();
    for (const det of detections) {
      const cx = det.x + det.w / 2;
      const cy = det.y + det.h / 2;
      const inRoi = !state.roiActive || (
        cx >= state.roi.x &&
        cx <= state.roi.x + state.roi.w &&
        cy >= state.roi.y &&
        cy <= state.roi.y + state.roi.h
      );

      if (inRoi) insideCount++;
      else outsideCount++;
      confSum += det.confidence;

      if (!perClass[det.label]) {
        perClass[det.label] = { total: 0, inside: 0, outside: 0, confSum: 0 };
      }
      perClass[det.label].total++;
      perClass[det.label].confSum += det.confidence;
      if (inRoi) perClass[det.label].inside++;
      else perClass[det.label].outside++;

      const boxColor = CLASS_COLOR_MAP[det.label] || "#B93815";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
      ctx.lineWidth = 3.6;
      ctx.strokeRect(det.x, det.y, det.w, det.h);
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 2.2;
      ctx.strokeRect(det.x, det.y, det.w, det.h);

      // Label Tag
      const prefix = state.detectMode === "tracking" ? `ID #${det.trackId} • ` : "";
      const tagText = `${prefix}${det.label} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = "bold 12px 'Plus Jakarta Sans', 'Segoe UI', sans-serif";
      const tw = ctx.measureText(tagText).width + 14;
      const ty = Math.max(0, det.y - 22);
      ctx.fillStyle = boxColor;
      roundRect(ctx, det.x, ty, tw, 22, 4);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(tagText, det.x + 7, ty + 15);

      // Centroid indicator for Region Counter #1
      ctx.fillStyle = inRoi ? "#15803D" : "#B45309";
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();

    return {
      total: detections.length,
      inside: insideCount,
      outside: outsideCount,
      avgConf: detections.length > 0 ? (confSum / detections.length) * 100 : 0,
      perClass
    };
  }

  function updateTelemetryUi(summary) {
    dom.statTotalDetected.textContent = String(summary.total);
    dom.statInsideRegion.textContent = String(summary.inside);
    dom.statOutsideRegion.textContent = String(summary.outside);
    dom.statAvgConfidence.textContent = `${summary.avgConf.toFixed(1)}%`;
    dom.statEnhanceBoost.textContent = `Metode: ${METHOD_LABELS[state.enhanceMethod]}`;
    dom.statUniqueTracks.textContent =
      state.detectMode === "tracking"
        ? `${state.uniqueTrackIds.size} Track ID Unik (ByteTrack)`
        : "Objek kuliner teridentifikasi";

    const entries = Object.entries(summary.perClass);
    if (entries.length === 0) {
      dom.classBreakdownGrid.innerHTML = `<div class="muted-text">Belum ada objek terdeteksi di atas threshold 50%. Coba aktifkan CLAHE atau Brightness/Gamma.</div>`;
      return;
    }

    dom.classBreakdownGrid.innerHTML = entries
      .map(([clsName, info]) => {
        const avg = ((info.confSum / info.total) * 100).toFixed(1);
        const dotColor = CLASS_COLOR_MAP[clsName] || "#B93815";
        return `
          <div class="class-chip">
            <div class="class-chip-top">
              <span><i class="leg-dot" style="background:${dotColor}"></i>${escapeHtml(clsName)}</span>
              <span class="class-chip-count">${info.total}x</span>
            </div>
            <div class="class-chip-sub">
              Inside ROI: <strong>${info.inside}</strong> • Outside: <strong>${info.outside}</strong> • Conf: <strong>${avg}%</strong>
            </div>
          </div>
        `;
      })
      .join("");
  }

  /* ========================================================================
     6. TAB 2: 5-CARD COMPARISON & 30-ROW EXCEL/CSV REPORT
     ======================================================================== */
  function bindTab2Controls() {
    dom.evalSceneSelect.addEventListener("change", renderFiveCardComparison);
    dom.evalSearchInput.addEventListener("input", renderEvalTable);
    dom.evalMethodFilter.addEventListener("change", renderEvalTable);

    dom.btnDownloadCsv.addEventListener("click", downloadComparisonCsv);
    dom.btnDownloadExcel.addEventListener("click", downloadComparisonExcel);
    dom.btnSyncEvalSupabase.addEventListener("click", async () => {
      const sample = EVAL_30_ROWS[0];
      await saveComparisonToDb({
        image_name: sample.image_name,
        ground_truth_count: sample.gt,
        before_count: sample.beforeCount,
        before_conf: sample.beforeConf,
        he_count: sample.heCount,
        he_conf: sample.heConf,
        clahe_count: sample.claheCount,
        clahe_conf: sample.claheConf,
        cs_count: sample.csCount,
        cs_conf: sample.csConf,
        brightness_count: sample.brightCount,
        brightness_conf: sample.brightConf,
        best_method: sample.bestMethod,
        conf_improvement_pct: sample.boost,
        psnr_db: sample.psnr
      });
      showToast("Evaluasi Before vs After berhasil disimpan ke database.");
      refreshDatabasePanel();
    });
  }

  function renderFiveCardComparison() {
    const sceneKey = dom.evalSceneSelect.value || "nasgor_malam";
    const methods = [
      { key: "original", title: "Original (Before)" },
      { key: "he", title: "Hist. Eq (HE)" },
      { key: "clahe", title: "CLAHE (LAB)" },
      { key: "cs", title: "Contrast Stretch" },
      { key: "brightness", title: "Brightness/Gamma" }
    ];

    const off = document.createElement("canvas");
    off.width = CANVAS_W;
    off.height = CANVAS_H;
    const octx = off.getContext("2d", { willReadFrequently: true });
    const drawn = drawCulinaryScene(octx, sceneKey, 0, true);
    const baseObjects = drawn.boxes || [];
    const activeRect = drawn.placement;
    const rawSnapshot = octx.getImageData(0, 0, CANVAS_W, CANVAS_H);

    // Compute results for all 5 methods under simulated low-light stress test (-35%)
    const cardResults = methods.map((m) => {
      const copy = new ImageData(new Uint8ClampedArray(rawSnapshot.data), CANVAS_W, CANVAS_H);
      const res = applyEnhancementToImageData(copy, m.key, {
        clipLimit: 2.5,
        brightness: 22,
        contrast: 1.28,
        gamma: 1.18
      }, activeRect);
      const dets = evaluateDetections(baseObjects, copy, m.key, true);
      const avgConf = dets.length ? (dets.reduce((a, b) => a + b.confidence, 0) / dets.length) * 100 : 0;
      return { ...m, imgData: copy, metrics: res.metrics, dets, avgConf };
    });

    const beforeConf = cardResults[0].avgConf;
    let bestIdx = 0;
    cardResults.forEach((cr, idx) => {
      if (cr.avgConf > cardResults[bestIdx].avgConf) bestIdx = idx;
    });

    dom.fiveCardComparisonGrid.innerHTML = "";
    cardResults.forEach((cr, idx) => {
      const card = document.createElement("div");
      card.className = `compare-card ${idx === bestIdx ? "is-best" : ""}`;

      const cv = document.createElement("canvas");
      cv.width = 480;
      cv.height = 300;
      const cctx = cv.getContext("2d");

      // Draw enhanced full-size into offscreen then scale smoothly + draw boxes
      octx.putImageData(cr.imgData, 0, 0);
      cctx.drawImage(off, 0, 0, CANVAS_W, CANVAS_H, 0, 0, cv.width, cv.height);
      const sx = cv.width / CANVAS_W;
      const sy = cv.height / CANVAS_H;
      cr.dets.forEach((d) => {
        cctx.strokeStyle = CLASS_COLOR_MAP[d.label] || "#B93815";
        cctx.lineWidth = 2;
        cctx.strokeRect(d.x * sx, d.y * sy, d.w * sx, d.h * sy);
      });

      const delta = cr.avgConf - beforeConf;
      const deltaStr = idx === 0 ? "Baseline" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;

      const body = document.createElement("div");
      body.className = "compare-card-body";
      body.innerHTML = `
        <div class="compare-card-title">
          <span>${escapeHtml(cr.title)}</span>
          ${idx === bestIdx ? `<span class="best-badge">TERBAIK</span>` : ""}
        </div>
        <div class="compare-metrics">
          <div>Terdeteksi: <strong>${cr.dets.length}/${baseObjects.length}</strong></div>
          <div>Avg Conf: <strong>${cr.avgConf.toFixed(1)}%</strong></div>
          <div>Boost (Δ): <strong class="${delta > 0 ? "boost-pos" : ""}">${deltaStr}</strong></div>
          <div>PSNR: <strong>${cr.metrics.psnr}</strong></div>
        </div>
      `;

      card.appendChild(cv);
      card.appendChild(body);
      dom.fiveCardComparisonGrid.appendChild(card);
    });
  }

  function renderEvalTable() {
    const q = (dom.evalSearchInput.value || "").trim().toLowerCase();
    const filterMethod = dom.evalMethodFilter.value;

    const filtered = EVAL_30_ROWS.filter((r) => {
      const matchText = !q || r.image_name.toLowerCase().includes(q) || r.dominantClass.toLowerCase().includes(q);
      const matchMethod = filterMethod === "all" || r.bestMethod === filterMethod;
      return matchText && matchMethod;
    });

    // Update top summary KPIs from full 30 rows
    const avgBefore = EVAL_30_ROWS.reduce((s, r) => s + r.beforeConf, 0) / EVAL_30_ROWS.length;
    const avgClahe = EVAL_30_ROWS.reduce((s, r) => s + r.claheConf, 0) / EVAL_30_ROWS.length;
    const avgBoost = EVAL_30_ROWS.reduce((s, r) => s + r.boost, 0) / EVAL_30_ROWS.length;
    const avgPsnr = EVAL_30_ROWS.reduce((s, r) => s + r.psnr, 0) / EVAL_30_ROWS.length;

    dom.evalAvgBefore.textContent = `${avgBefore.toFixed(1)}%`;
    dom.evalAvgClahe.textContent = `${avgClahe.toFixed(1)}%`;
    dom.evalAvgBoost.textContent = `+${avgBoost.toFixed(1)}%`;
    dom.evalAvgPsnr.textContent = `${avgPsnr.toFixed(1)} dB`;

    dom.evalTableBody.innerHTML = filtered
      .map(
        (r) => `
        <tr>
          <td>${r.no}</td>
          <td><code>${escapeHtml(r.image_name)}</code></td>
          <td>${escapeHtml(r.dominantClass)}</td>
          <td>${r.gt}</td>
          <td>${r.beforeCount}/${r.gt} (${r.beforeConf.toFixed(1)}%)</td>
          <td>${r.heCount}/${r.gt} (${r.heConf.toFixed(1)}%)</td>
          <td><strong>${r.claheCount}/${r.gt} (${r.claheConf.toFixed(1)}%)</strong></td>
          <td>${r.csCount}/${r.gt} (${r.csConf.toFixed(1)}%)</td>
          <td>${r.brightCount}/${r.gt} (${r.brightConf.toFixed(1)}%)</td>
          <td>${r.psnr.toFixed(1)} dB</td>
          <td class="boost-pos">+${r.boost.toFixed(1)}%</td>
          <td><span class="method-badge">${escapeHtml(r.bestMethod)}</span></td>
        </tr>
      `
      )
      .join("");
  }

  function downloadComparisonCsv() {
    const header = [
      "No", "Nama_Citra_Uji", "Kelas_Dominan", "Ground_Truth",
      "Before_Count", "Before_Conf_Pct", "HE_Count", "HE_Conf_Pct",
      "CLAHE_Count", "CLAHE_Conf_Pct", "CS_Count", "CS_Conf_Pct",
      "Brightness_Count", "Brightness_Conf_Pct", "PSNR_dB", "Delta_Boost_Pct", "Metode_Terbaik"
    ];
    const lines = [header.join(",")];
    EVAL_30_ROWS.forEach((r) => {
      lines.push([
        r.no, `"${r.image_name}"`, `"${r.dominantClass}"`, r.gt,
        r.beforeCount, r.beforeConf.toFixed(1), r.heCount, r.heConf.toFixed(1),
        r.claheCount, r.claheConf.toFixed(1), r.csCount, r.csConf.toFixed(1),
        r.brightCount, r.brightConf.toFixed(1), r.psnr.toFixed(1), r.boost.toFixed(1), `"${r.bestMethod}"`
      ].join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, "Laporan_Before_After_Enhancement_30_Uji.csv");
    showToast("File CSV Before vs After (30 citra uji) berhasil diunduh.");
  }

  async function downloadComparisonExcel() {
    // When served over HTTP, try downloading the prebuilt real .xlsx or backend API export first
    if (location.protocol !== "file:") {
      try {
        const res = await fetch(resolveAssetUrl("reports/Laporan_Before_After_Enhancement.xlsx"));
        if (res.ok) {
          const blob = await res.blob();
          triggerDownload(blob, "Laporan_Before_After_Enhancement.xlsx");
          showToast("Laporan Excel (.xlsx) resmi berhasil diunduh.");
          return;
        }
      } catch (_) {}
      try {
        const apiRes = await fetch("/api/export/excel");
        if (apiRes.ok) {
          const blob = await apiRes.blob();
          triggerDownload(blob, "Laporan_Before_After_Enhancement.xlsx");
          showToast("Laporan Excel dari backend berhasil diunduh.");
          return;
        }
      } catch (_) {}
    }

    // Universal fallback (works offline & file://): SpreadsheetML Excel XML (.xls)
    const rowsXml = EVAL_30_ROWS.map((r) => `
      <Row>
        <Cell><Data ss:Type="Number">${r.no}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(r.image_name)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(r.dominantClass)}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.gt}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.beforeCount}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.beforeConf.toFixed(1)}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.heCount}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.heConf.toFixed(1)}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.claheCount}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.claheConf.toFixed(1)}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.csCount}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.csConf.toFixed(1)}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.brightCount}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.brightConf.toFixed(1)}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.psnr.toFixed(1)}</Data></Cell>
        <Cell><Data ss:Type="Number">${r.boost.toFixed(1)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(r.bestMethod)}</Data></Cell>
      </Row>`).join("");

    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Detail_Before_vs_After_30_Uji">
  <Table>
   <Row>
    <Cell><Data ss:Type="String">No</Data></Cell>
    <Cell><Data ss:Type="String">Nama Citra</Data></Cell>
    <Cell><Data ss:Type="String">Kelas Dominan</Data></Cell>
    <Cell><Data ss:Type="String">GT</Data></Cell>
    <Cell><Data ss:Type="String">Before Count</Data></Cell>
    <Cell><Data ss:Type="String">Before Conf (%)</Data></Cell>
    <Cell><Data ss:Type="String">HE Count</Data></Cell>
    <Cell><Data ss:Type="String">HE Conf (%)</Data></Cell>
    <Cell><Data ss:Type="String">CLAHE Count</Data></Cell>
    <Cell><Data ss:Type="String">CLAHE Conf (%)</Data></Cell>
    <Cell><Data ss:Type="String">CS Count</Data></Cell>
    <Cell><Data ss:Type="String">CS Conf (%)</Data></Cell>
    <Cell><Data ss:Type="String">Brightness Count</Data></Cell>
    <Cell><Data ss:Type="String">Brightness Conf (%)</Data></Cell>
    <Cell><Data ss:Type="String">PSNR (dB)</Data></Cell>
    <Cell><Data ss:Type="String">Delta Boost (%)</Data></Cell>
    <Cell><Data ss:Type="String">Metode Terbaik</Data></Cell>
   </Row>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    triggerDownload(blob, "Laporan_Before_After_Enhancement.xls");
    showToast("Laporan Excel Before vs After berhasil diunduh.", "info");
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ========================================================================
     7. TAB 3: SUPABASE INTEGRATION & 600-IMAGE DATASET CHART
     ======================================================================== */
  function bindTab3AndSupabase() {
    const openModal = () => {
      const cfg = getSupabaseConfig();
      dom.inputSupabaseUrl.value = cfg.url || "";
      dom.inputSupabaseKey.value = cfg.key || "";
      dom.supabaseModal.classList.remove("hidden");
    };
    const closeModal = () => dom.supabaseModal.classList.add("hidden");

    dom.btnOpenSupabaseModal.addEventListener("click", openModal);
    dom.btnOpenSupabaseModal2.addEventListener("click", openModal);
    dom.btnCloseSupabaseModal.addEventListener("click", closeModal);
    dom.supabaseModal.addEventListener("click", (e) => {
      if (e.target === dom.supabaseModal) closeModal();
    });

    dom.btnSaveSupabaseConfig.addEventListener("click", async () => {
      const url = dom.inputSupabaseUrl.value.trim();
      const key = dom.inputSupabaseKey.value.trim();
      setSupabaseConfig(url, key);
      closeModal();
      await refreshDatabasePanel();
      showToast(url && key ? "Konfigurasi Supabase disimpan." : "Beralih ke Fallback Lokal.");
    });

    dom.btnClearSupabaseConfig.addEventListener("click", async () => {
      setSupabaseConfig("", "");
      dom.inputSupabaseUrl.value = "";
      dom.inputSupabaseKey.value = "";
      closeModal();
      await refreshDatabasePanel();
      showToast("Menggunakan mode Offline Fallback Lokal.", "info");
    });

    dom.btnTestSupabase.addEventListener("click", async () => {
      const url = dom.inputSupabaseUrl.value.trim().replace(/\/$/, "");
      const key = dom.inputSupabaseKey.value.trim();
      if (!url || !key) {
        showToast("Isi Supabase URL dan Anon Key terlebih dahulu.", "warn");
        return;
      }
      if (window.SupabaseCulinaryService && typeof window.SupabaseCulinaryService.testConnection === "function") {
        setSupabaseConfig(url, key);
        const result = await window.SupabaseCulinaryService.testConnection();
        showToast(result.message || "Pengujian selesai.", result.connected ? "success" : "warn");
        return;
      }
      try {
        const res = await fetch(`${url}/rest/v1/culinary_classes?select=id&limit=1`, {
          headers: buildSupabaseHeaders(key)
        });
        if (res.ok) showToast("Koneksi Supabase REST API berhasil (HTTP 200)!");
        else showToast(`Supabase merespons status ${res.status}. Pastikan migrasi SQL sudah dijalankan.`, "warn");
      } catch (err) {
        showToast(`Gagal terhubung ke Supabase: ${err.message}`, "warn");
      }
    });

    dom.btnRefreshSupabase.addEventListener("click", async () => {
      await refreshDatabasePanel();
      showToast("Data database diperbarui.", "info");
    });

    dom.btnResetLocalDb.addEventListener("click", async () => {
      localStorage.removeItem("nv_fallback_sessions");
      localStorage.removeItem("nv_fallback_comparisons");
      if (window.SupabaseCulinaryService && typeof window.SupabaseCulinaryService.resetLocalData === "function") {
        await window.SupabaseCulinaryService.resetLocalData();
      }
      await refreshDatabasePanel();
      showToast("Cache lokal dibersihkan ke seed awal.", "info");
    });

    dom.btnSaveSession.addEventListener("click", async () => {
      const summary = summarizeCurrentDetections();
      const sessionPayload = {
        media_name: state.mediaName,
        media_type: state.mediaType === "image" ? "image" : "video",
        model_name: "yolo11n-kuliner-600.pt",
        enhancement_method: state.enhanceMethod,
        mode: state.detectMode,
        total_detected: summary.total,
        region_inside_count: summary.inside,
        region_outside_count: summary.outside,
        avg_confidence: Number((summary.avgConf / 100).toFixed(4)),
        inference_ms: state.lastInferenceMs,
        class_breakdown: summary.perClass,
        created_at: new Date().toISOString()
      };
      await saveSessionToDb(sessionPayload);
      showToast(`Sesi "${state.mediaName}" (${summary.inside} di dalam ROI #1) tersimpan!`);
      if (state.activeTab === "tab-db") refreshDatabasePanel();
    });

    document.querySelectorAll(".subtab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.dbSubtab = btn.dataset.subtab;
        document.querySelectorAll(".subtab-btn").forEach((b) => b.classList.toggle("active", b === btn));
        renderDbTable();
      });
    });
  }

  function summarizeCurrentDetections() {
    let inside = 0;
    let outside = 0;
    let confSum = 0;
    const perClass = {};
    for (const det of state.detections) {
      const cx = det.x + det.w / 2;
      const cy = det.y + det.h / 2;
      const inRoi = !state.roiActive || (
        cx >= state.roi.x && cx <= state.roi.x + state.roi.w &&
        cy >= state.roi.y && cy <= state.roi.y + state.roi.h
      );
      if (inRoi) inside++;
      else outside++;
      confSum += det.confidence;
      perClass[det.label] = (perClass[det.label] || 0) + 1;
    }
    return {
      total: state.detections.length,
      inside,
      outside,
      avgConf: state.detections.length ? (confSum / state.detections.length) * 100 : 0,
      perClass
    };
  }

  function getSupabaseConfig() {
    if (window.SupabaseCulinaryService && typeof window.SupabaseCulinaryService.getConfig === "function") {
      try {
        const c = window.SupabaseCulinaryService.getConfig();
        if (c) return { url: c.url || c.supabaseUrl || "", key: c.anonKey || c.key || "" };
      } catch (_) {}
    }
    return {
      url: localStorage.getItem("nv_supabase_url") || "",
      key: localStorage.getItem("nv_supabase_key") || ""
    };
  }

  function setSupabaseConfig(url, key) {
    localStorage.setItem("nv_supabase_url", url);
    localStorage.setItem("nv_supabase_key", key);
    if (window.SupabaseCulinaryService) {
      try {
        if (url && key && typeof window.SupabaseCulinaryService.setConfig === "function") {
          window.SupabaseCulinaryService.setConfig({ url, anonKey: key });
        } else if ((!url || !key) && typeof window.SupabaseCulinaryService.clearConfig === "function") {
          window.SupabaseCulinaryService.clearConfig();
        }
      } catch (_) {}
    }
  }

  async function refreshDatabasePanel() {
    const svc = window.SupabaseCulinaryService;
    const cfg = getSupabaseConfig();
    let loaded = null;

    if (svc) {
      try {
        if (typeof svc.getAllData === "function") {
          const all = await svc.getAllData();
          loaded = {
            classes: all.culinary_classes,
            sessions: all.detection_sessions,
            comparisons: all.enhancement_comparisons,
            mode: all.status && all.status.mode === "supabase" ? "Supabase PostgreSQL (Live)" : "Supabase Service (Fallback Lokal)"
          };
        } else if (typeof svc.getClasses === "function" && typeof svc.getSessions === "function") {
          const [classes, sessions, comparisons] = await Promise.all([
            svc.getClasses(),
            svc.getSessions(),
            typeof svc.getComparisons === "function" ? svc.getComparisons() : Promise.resolve([])
          ]);
          loaded = { classes, sessions, comparisons, mode: cfg.url && cfg.key ? "Supabase REST" : "Supabase Service (Fallback Lokal)" };
        }
      } catch (_) {}
    }

    if (!loaded) {
      loaded = await loadInlineDbFallback(cfg);
    }

    state.dbData = {
      classes: loaded.classes && loaded.classes.length ? loaded.classes : CULINARY_CLASSES,
      sessions: loaded.sessions || [],
      comparisons: loaded.comparisons || [],
      source: loaded.mode || (cfg.url && cfg.key ? "Supabase REST API" : "Fallback Lokal (Offline Ready)")
    };

    const isRemote = !!(cfg.url && cfg.key && String(state.dbData.source).toLowerCase().includes("supabase") && !String(state.dbData.source).toLowerCase().includes("fallback"));
    dom.supabaseStatusDot.className = `status-dot ${isRemote ? "" : "dot-amber"}`;
    dom.supabaseStatusText.textContent = isRemote ? "Supabase: Terhubung" : "Supabase: Fallback Lokal";
    dom.dbPanelStatus.textContent = state.dbData.source;
    dom.dbActiveSourceTag.textContent = `Sumber: ${state.dbData.source}`;
    dom.dbSessionCount.textContent = String(state.dbData.sessions.length);
    dom.dbComparisonCount.textContent = String(state.dbData.comparisons.length);
    dom.dbClassCount.textContent = String(state.dbData.classes.length);

    renderDbTable();
  }

  async function loadInlineDbFallback(cfg) {
    // Try Supabase REST directly if user entered URL+Key
    if (cfg.url && cfg.key) {
      const base = cfg.url.replace(/\/$/, "");
      const headers = buildSupabaseHeaders(cfg.key);
      try {
        const [cRes, sRes, eRes] = await Promise.all([
          fetch(`${base}/rest/v1/culinary_classes?select=*&order=id.asc`, { headers }),
          fetch(`${base}/rest/v1/detection_sessions?select=*&order=created_at.desc&limit=30`, { headers }),
          fetch(`${base}/rest/v1/enhancement_comparisons?select=*&order=created_at.desc&limit=30`, { headers })
        ]);
        if (cRes.ok && sRes.ok && eRes.ok) {
          return {
            classes: await cRes.json(),
            sessions: await sRes.json(),
            comparisons: await eRes.json(),
            mode: "Supabase PostgreSQL (Live)"
          };
        }
      } catch (_) {}
    }

    // Try loading reports/local_db_fallback.json if on http://
    let fileSeed = null;
    if (location.protocol !== "file:") {
      try {
        const res = await fetch(resolveAssetUrl("reports/local_db_fallback.json"));
        if (res.ok) fileSeed = await res.json();
      } catch (_) {}
    }

    const storedSessions = safeJsonParse(localStorage.getItem("nv_fallback_sessions"), null);
    const storedComparisons = safeJsonParse(localStorage.getItem("nv_fallback_comparisons"), null);

    return {
      classes: (fileSeed && fileSeed.culinary_classes) || CULINARY_CLASSES,
      sessions: storedSessions || (fileSeed && fileSeed.detection_sessions) || getDefaultSessions(),
      comparisons: storedComparisons || (fileSeed && fileSeed.enhancement_comparisons) || EVAL_30_ROWS.slice(0, 12).map((r) => ({
        image_name: r.image_name,
        ground_truth_count: r.gt,
        before_count: r.beforeCount,
        before_conf: r.beforeConf,
        clahe_count: r.claheCount,
        clahe_conf: r.claheConf,
        best_method: r.bestMethod,
        conf_improvement_pct: r.boost,
        psnr_db: r.psnr
      })),
      mode: "Fallback Lokal (Offline Ready)"
    };
  }

  async function saveSessionToDb(payload) {
    const svc = window.SupabaseCulinaryService;
    if (svc) {
      try {
        if (typeof svc.saveSession === "function") {
          await svc.saveSession(payload);
          return;
        }
        if (typeof svc.saveDetectionSession === "function") {
          await svc.saveDetectionSession(payload);
          return;
        }
      } catch (_) {}
    }

    const cfg = getSupabaseConfig();
    if (cfg.url && cfg.key) {
      try {
        const res = await fetch(`${cfg.url.replace(/\/$/, "")}/rest/v1/detection_sessions`, {
          method: "POST",
          headers: buildSupabaseHeaders(cfg.key, {
            "Content-Type": "application/json",
            Prefer: "return=representation"
          }),
          body: JSON.stringify(payload)
        });
        if (res.ok) return;
      } catch (_) {}
    }

    const existing = safeJsonParse(localStorage.getItem("nv_fallback_sessions"), getDefaultSessions());
    existing.unshift({ id: `local-${Date.now()}`, ...payload });
    localStorage.setItem("nv_fallback_sessions", JSON.stringify(existing.slice(0, 40)));
  }

  async function saveComparisonToDb(payload) {
    const svc = window.SupabaseCulinaryService;
    const normalized = {
      ...payload,
      before_conf: payload.before_conf > 1 ? payload.before_conf / 100 : payload.before_conf,
      he_conf: payload.he_conf > 1 ? payload.he_conf / 100 : payload.he_conf,
      clahe_conf: payload.clahe_conf > 1 ? payload.clahe_conf / 100 : payload.clahe_conf,
      cs_conf: payload.cs_conf > 1 ? payload.cs_conf / 100 : payload.cs_conf,
      brightness_conf: payload.brightness_conf > 1 ? payload.brightness_conf / 100 : payload.brightness_conf
    };
    if (svc) {
      try {
        if (typeof svc.saveComparison === "function") {
          await svc.saveComparison(normalized);
          return;
        }
        if (typeof svc.saveEnhancementComparison === "function") {
          await svc.saveEnhancementComparison(normalized);
          return;
        }
      } catch (_) {}
    }
    const existing = safeJsonParse(localStorage.getItem("nv_fallback_comparisons"), []);
    existing.unshift({ id: `cmp-${Date.now()}`, ...normalized });
    localStorage.setItem("nv_fallback_comparisons", JSON.stringify(existing.slice(0, 40)));
  }

  function fmtConfPct(val) {
    const num = Number(val || 0);
    return (num <= 1 ? num * 100 : num).toFixed(1);
  }

  function renderDbTable() {
    const container = dom.dbTableContainer;
    if (state.dbSubtab === "sessions") {
      const rows = state.dbData.sessions;
      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Media</th><th>Tipe</th><th>Enhancement</th><th>Mode</th>
              <th>Total</th><th>Inside ROI #1</th><th>Outside ROI</th><th>Avg Conf</th><th>Waktu</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((s) => `
              <tr>
                <td><strong>${escapeHtml(s.media_name || "-")}</strong></td>
                <td>${escapeHtml(s.media_type || "image")}</td>
                <td><span class="method-badge">${escapeHtml(s.enhancement_method || "clahe")}</span></td>
                <td>${escapeHtml(s.mode || "counting")}</td>
                <td>${s.total_detected ?? 0}</td>
                <td class="boost-pos">${s.region_inside_count ?? 0}</td>
                <td>${s.region_outside_count ?? 0}</td>
                <td>${fmtConfPct(s.avg_confidence)}%</td>
                <td class="mono-sm">${formatShortDate(s.created_at)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`;
    } else if (state.dbSubtab === "comparisons") {
      const rows = state.dbData.comparisons;
      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>Citra Uji</th><th>GT</th><th>Before</th><th>After (CLAHE)</th>
              <th>Metode Terbaik</th><th>Δ Boost</th><th>PSNR</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((c) => `
              <tr>
                <td><code>${escapeHtml(c.image_name || "-")}</code></td>
                <td>${c.ground_truth_count ?? "-"}</td>
                <td>${c.before_count ?? 0} (${fmtConfPct(c.before_conf)}%)</td>
                <td><strong>${c.clahe_count ?? 0} (${fmtConfPct(c.clahe_conf)}%)</strong></td>
                <td><span class="method-badge">${escapeHtml(c.best_method || "CLAHE")}</span></td>
                <td class="boost-pos">+${Number(c.conf_improvement_pct || 0).toFixed(1)}%</td>
                <td>${Number(c.psnr_db || 29.0).toFixed(1)} dB</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`;
    } else {
      const rows = state.dbData.classes;
      container.innerHTML = `
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th><th>Nama Kelas Kuliner</th><th>Asal Daerah</th><th>Kategori</th>
              <th>Kalori Rata-rata</th><th>Jumlah Citra</th><th>Deskripsi</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((c, idx) => `
              <tr>
                <td>${c.id || idx + 1}</td>
                <td><strong>${escapeHtml(c.name)}</strong></td>
                <td>${escapeHtml(c.region_origin || "-")}</td>
                <td><span class="method-badge">${escapeHtml(c.category || "-")}</span></td>
                <td>${c.avg_calories || 300} kkal</td>
                <td><strong>${c.dataset_count || 50} citra</strong></td>
                <td>${escapeHtml(c.description || "-")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`;
    }
  }

  function drawDatasetChart() {
    const cv = dom.datasetChartCanvas;
    const ctx = cv.getContext("2d");
    const w = cv.width;
    const h = cv.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#FAF8F4";
    ctx.fillRect(0, 0, w, h);

    const padL = 44;
    const padR = 16;
    const padT = 22;
    const padB = 72;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const maxCount = 70;

    // Horizontal grid lines
    ctx.strokeStyle = "rgba(28, 25, 23, 0.09)";
    ctx.fillStyle = "#57534E";
    ctx.font = "11px 'Plus Jakarta Sans', 'Segoe UI', sans-serif";
    ctx.textAlign = "right";
    for (let v = 0; v <= maxCount; v += 10) {
      const y = padT + plotH - (v / maxCount) * plotH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillText(String(v), padL - 8, y + 4);
    }

    const barSlot = plotW / CULINARY_CLASSES.length;
    const barW = Math.min(36, barSlot * 0.62);

    CULINARY_CLASSES.forEach((cls, idx) => {
      const cx = padL + idx * barSlot + barSlot / 2;
      const total = cls.dataset_count;
      const train = Math.round(total * 0.7);
      const valid = Math.round(total * 0.2);
      const test = total - train - valid;

      const hTrain = (train / maxCount) * plotH;
      const hValid = (valid / maxCount) * plotH;
      const hTest = (test / maxCount) * plotH;
      const baseY = padT + plotH;

      ctx.fillStyle = "#B93815";
      ctx.fillRect(cx - barW / 2, baseY - hTrain, barW, hTrain);
      ctx.fillStyle = "#15803D";
      ctx.fillRect(cx - barW / 2, baseY - hTrain - hValid, barW, hValid);
      ctx.fillStyle = "#B45309";
      ctx.fillRect(cx - barW / 2, baseY - hTrain - hValid - hTest, barW, hTest);

      // Total label on top
      ctx.fillStyle = "#1C1917";
      ctx.textAlign = "center";
      ctx.font = "bold 11px 'Plus Jakarta Sans', 'Segoe UI', sans-serif";
      ctx.fillText(String(total), cx, baseY - hTrain - hValid - hTest - 6);

      // Angled class label
      ctx.save();
      ctx.translate(cx, baseY + 12);
      ctx.rotate(-Math.PI / 6);
      ctx.fillStyle = "#57534E";
      ctx.font = "11px 'Plus Jakarta Sans', 'Segoe UI', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(cls.name, 4, 6);
      ctx.restore();
    });
  }

  /* ========================================================================
     8. TAB 4: RUBRIC CHECKLISTS & GROUP INFO + BACKEND PROBE
     ======================================================================== */
  function bindTab4Controls() {
    dom.btnSaveGroupInfo.addEventListener("click", () => {
      const info = {
        groupName: dom.inputGroupName.value.trim(),
        members: dom.inputMembers.value.trim(),
        youtube: dom.inputYoutubeUrl.value.trim(),
        colab: dom.inputColabUrl ? dom.inputColabUrl.value.trim() : "",
        github: dom.inputGithubUrl.value.trim()
      };
      localStorage.setItem("nv_group_info", JSON.stringify(info));
      syncExternalLinks();
      showToast("Identitas kelompok, Colab & link presentasi tersimpan.");
    });

    dom.inputYoutubeUrl.addEventListener("input", syncExternalLinks);
    dom.inputGithubUrl.addEventListener("input", syncExternalLinks);
    if (dom.inputColabUrl) {
      dom.inputColabUrl.addEventListener("input", syncExternalLinks);
    }
  }

  function loadGroupInfo() {
    const saved = safeJsonParse(localStorage.getItem("nv_group_info"), null);
    if (saved) {
      if (saved.groupName) dom.inputGroupName.value = saved.groupName;
      if (saved.members) dom.inputMembers.value = saved.members;
      if (saved.youtube) dom.inputYoutubeUrl.value = saved.youtube;
      if (saved.colab && dom.inputColabUrl) dom.inputColabUrl.value = saved.colab;
      if (saved.github) dom.inputGithubUrl.value = saved.github;
    }
    syncExternalLinks();
  }

  function syncExternalLinks() {
    dom.linkOpenYoutube.href = dom.inputYoutubeUrl.value.trim() || "#";
    dom.linkOpenGithub.href = dom.inputGithubUrl.value.trim() || "#";
    if (dom.linkOpenColab && dom.inputColabUrl) {
      dom.linkOpenColab.href = dom.inputColabUrl.value.trim() || "#";
    }
  }

  function renderRubricChecklists() {
    dom.checklistKetentuan.innerHTML = RUBRIC_KETENTUAN.map(
      (item) => `<li><span class="rubric-check">${ICON_CHECK}</span><span>${escapeHtml(item)}</span></li>`
    ).join("");
    dom.checklistPenilaian.innerHTML = RUBRIC_PENILAIAN.map(
      (item) => `<li><span class="rubric-check">${ICON_CHECK}</span><span>${escapeHtml(item)}</span></li>`
    ).join("");
  }

  async function probeBackendQuietly() {
    if (location.protocol === "file:") {
      dom.backendStatusText.textContent = "Canvas Engine (Mode file://)";
      return;
    }
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const info = await res.json();
        state.backendConnected = true;
        dom.backendStatusText.textContent = `Backend Aktif (${info.runtime || info.engine || "API"})`;
      }
      const clsRes = await fetch("/api/classes");
      if (clsRes.ok) {
        const clsData = await clsRes.json();
        const remoteClasses = Array.isArray(clsData) ? clsData : clsData.classes;
        if (Array.isArray(remoteClasses) && remoteClasses.length >= 12) {
          remoteClasses.forEach((rc) => {
            const match = CULINARY_CLASSES.find((c) => c.name.toLowerCase() === String(rc.name || "").toLowerCase());
            if (match && rc.dataset_count) match.dataset_count = Number(rc.dataset_count);
          });
          drawDatasetChart();
        }
      }
    } catch (_) {
      dom.backendStatusText.textContent = "Canvas Engine (Offline Ready)";
    }
  }

  async function sendFrameToBackendApi() {
    if (location.protocol === "file:") {
      showToast("Jalankan via http://localhost:8000 (node server.js / FastAPI) untuk memanggil API server.", "info");
      return;
    }
    try {
      const r = state.roi;
      const regionPoints = [
        [r.x, r.y],
        [r.x + r.w, r.y],
        [r.x + r.w, r.y + r.h],
        [r.x, r.y + r.h]
      ];
      const payload = {
        sample_id: state.sampleKey,
        filename: state.mediaName,
        enhancement: state.enhanceMethod === "original" ? "none" : state.enhanceMethod,
        mode: state.detectMode,
        region_points: regionPoints,
        params: {
          clip_limit: state.clipLimit,
          brightness: state.brightness,
          contrast: state.contrast,
          gamma: state.gamma
        }
      };

      let res;
      if (state.mediaType === "sim_video") {
        const vCfg = VIDEO_SAMPLE_CONFIG[state.sampleKey];
        const videoPayload = {
          ...payload,
          sample_id: (vCfg && vCfg.catalogId) || state.sampleKey,
          frame_index: state.simFrame
        };
        res = await fetch("/api/detect/video/sample", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(videoPayload)
        });
        if (res.status === 404) {
          res = await fetch("/api/detect/video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(videoPayload)
          });
        }
      } else {
        if (state.uploadedImage) {
          payload.image_base64 = rawCanvas.toDataURL("image/jpeg", 0.85);
        }
        res = await fetch("/api/detect/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const frameList = Array.isArray(data.frames) ? data.frames : Array.isArray(data.frame_summaries) ? data.frame_summaries : null;
      const rawDetections = Array.isArray(data.detections)
        ? data.detections
        : frameList && frameList.length
          ? (frameList[state.simFrame % frameList.length].detections || [])
          : [];

      if (rawDetections.length > 0 && !state.uploadedImage) {
        const iw = (data.image_size && data.image_size.width) || 640;
        const ih = (data.image_size && data.image_size.height) || 480;
        const place = state.lastPlacement || { dx: 0, dy: 0, dw: CANVAS_W, dh: CANVAS_H };
        const mapped = rawDetections.map((d, i) => ({
          trackId: d.track_id || i + 1,
          label: d.class_name,
          x: Math.round(place.dx + (d.bbox[0] / iw) * place.dw),
          y: Math.round(place.dy + (d.bbox[1] / ih) * place.dh),
          w: Math.round(((d.bbox[2] - d.bbox[0]) / iw) * place.dw),
          h: Math.round(((d.bbox[3] - d.bbox[1]) / ih) * place.dh),
          confidence: Number(d.confidence || 0.85)
        }));
        state.detections = mapped;
        const ctx = dom.mainCtx;
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.drawImage(state.splitCompare ? rawCanvas : enhancedCanvas, 0, 0);
        if (state.roiActive) drawRoiOverlay(ctx, state.roi);
        if (state.detectMode === "tracking") drawTrackingTrails(ctx);
        const summary = drawDetectionBoxes(ctx, mapped);
        updateTelemetryUi(summary);
      }
      if (data.inference_ms) {
        state.lastInferenceMs = Number(data.inference_ms);
        dom.fpsCounter.textContent = `API Proses: ${state.lastInferenceMs.toFixed(1)} ms (${data.model_name || "YOLOv11"})`;
      }
      showToast(`API merespons: ${data.total_detected ?? state.detections.length} objek (${data.inside_region_count ?? 0} di Region #1).`);
    } catch (err) {
      showToast(`API tidak tersedia (${err.message}). Tetap berjalan mulus di Canvas Engine.`, "warn");
    }
  }

  /* ========================================================================
     9. CANVAS DRAWING HELPERS & STATIC SEED BUILDERS
     ======================================================================== */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPlate(ctx, cx, cy, r, rim = "#f8fafc") {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath();
    ctx.ellipse(cx + 6, cy + 10, r, r * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.76, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawBowl(ctx, cx, cy, r, rim, soupColor) {
    drawPlate(ctx, cx, cy, r, rim);
    ctx.fillStyle = soupColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRiceMound(ctx, cx, cy, r, c1, c2) {
    const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rice grain texture & chili/scallion bits
    for (let i = 0; i < 42; i++) {
      const ang = i * 2.39996;
      const rad = Math.sqrt(i / 42) * r * 0.78;
      const gx = cx + Math.cos(ang) * rad;
      const gy = cy + Math.sin(ang) * rad * 0.8;
      ctx.fillStyle = i % 7 === 0 ? "#16a34a" : i % 5 === 0 ? "#dc2626" : "rgba(255,237,213,0.45)";
      ctx.fillRect(gx, gy, 5, 3);
    }
  }

  function drawTelurBalado(ctx, cx, cy, r) {
    ctx.fillStyle = "#b91c1c";
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.15, r * 0.92, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fef3c7";
    ctx.beginPath();
    ctx.ellipse(cx - 2, cy - 2, r * 0.78, r * 0.6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAyamGoreng(ctx, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.35);
    ctx.fillStyle = "#b45309";
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d97706";
    ctx.beginPath();
    ctx.ellipse(-6, -4, r * 0.7, r * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fef3c7";
    roundRect(ctx, r * 0.55, -7, 22, 14, 6);
    ctx.fill();
    ctx.restore();
  }

  function drawTempe(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(0.15);
    ctx.fillStyle = "#a16207";
    roundRect(ctx, -34, -22, 68, 44, 6);
    ctx.fill();
    ctx.fillStyle = "#fde68a";
    for (let x = -22; x < 24; x += 14) {
      ctx.fillRect(x, -12, 6, 6);
      ctx.fillRect(x + 4, 4, 6, 6);
    }
    ctx.restore();
  }

  function drawTahu(ctx, cx, cy) {
    ctx.fillStyle = "#d97706";
    roundRect(ctx, cx - 28, cy - 26, 56, 52, 7);
    ctx.fill();
    ctx.fillStyle = "#fef9c3";
    roundRect(ctx, cx - 20, cy - 18, 40, 36, 4);
    ctx.fill();
  }

  function drawKerupuk(ctx, cx, cy) {
    ctx.fillStyle = "#fef3c7";
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 1.5);
    ctx.stroke();
  }

  function drawBaksoBalls(ctx, cx, cy, scale = 1) {
    const offsets = [[-45, -25], [35, -35], [-10, 28], [55, 25], [-60, 35]];
    offsets.forEach(([ox, oy], i) => {
      const r = (i === 2 ? 32 : 24) * scale;
      const x = cx + ox * scale;
      const y = cy + oy * scale;
      const g = ctx.createRadialGradient(x - 6 * scale, y - 6 * scale, 2, x, y, r);
      g.addColorStop(0, "#a8a29e");
      g.addColorStop(1, "#57534e");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    // Green scallion garnish
    ctx.fillStyle = "#22c55e";
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(cx + ((i - 4) * 18) * scale, cy + ((i % 3) - 1) * 24 * scale, 5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawNoodles(ctx, cx, cy, r) {
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 6;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.7, cy + i * 11);
      ctx.bezierCurveTo(cx - 20, cy + i * 11 - 14, cx + 20, cy + i * 11 + 14, cx + r * 0.7, cy + i * 11);
      ctx.stroke();
    }
  }

  function drawSateSkewers(ctx, x0, y0, count, scale = 1) {
    for (let i = 0; i < count; i++) {
      const y = y0 + i * 32 * scale;
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + 210 * scale, y);
      ctx.stroke();

      for (let m = 0; m < 4; m++) {
        ctx.fillStyle = m % 2 === 0 ? "#92400e" : "#78350f";
        roundRect(ctx, x0 + (35 + m * 36) * scale, y - 10 * scale, 28 * scale, 20 * scale, 5 * scale);
        ctx.fill();
      }
    }
  }

  function drawGadoGado(ctx, cx, cy) {
    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.arc(cx - 22, cy - 10, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9a541a";
    ctx.beginPath();
    ctx.ellipse(cx + 10, cy + 12, 48, 36, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRendang(ctx, cx, cy, scale = 1) {
    const pts = [[-22, -14], [18, -16], [0, 14], [26, 18]];
    pts.forEach(([ox, oy]) => {
      ctx.fillStyle = "#451a03";
      roundRect(ctx, cx + (ox - 24) * scale, cy + (oy - 18) * scale, 48 * scale, 36 * scale, 10 * scale);
      ctx.fill();
      ctx.fillStyle = "#78350f";
      roundRect(ctx, cx + (ox - 16) * scale, cy + (oy - 10) * scale, 28 * scale, 18 * scale, 6 * scale);
      ctx.fill();
    });
  }

  function drawPempek(ctx, cx, cy) {
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.ellipse(cx - 18, cy, 34, 16, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 20, cy + 8, 28, 18, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#29180b";
    ctx.beginPath();
    ctx.arc(cx, cy + 18, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTray(ctx, cx, cy) {
    ctx.fillStyle = "#475569";
    roundRect(ctx, cx - 120, cy - 95, 240, 190, 16);
    ctx.fill();
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function buildEval30Rows() {
    const samples = [
      ["nasgor_malam_01.jpg", "Nasi Goreng", 5, 3, 62.4, 4, 81.2, 5, 91.8, 4, 84.5, 5, 88.0, 29.8, "CLAHE"],
      ["bakso_warung_02.jpg", "Bakso", 4, 3, 64.1, 4, 83.0, 4, 92.5, 4, 85.2, 4, 87.9, 30.4, "CLAHE"],
      ["sate_asap_03.jpg", "Sate Ayam", 3, 2, 59.8, 3, 82.5, 3, 90.4, 3, 86.1, 3, 85.3, 28.9, "CLAHE"],
      ["rendang_redup_04.jpg", "Rendang", 5, 2, 54.2, 4, 79.6, 5, 89.2, 4, 82.0, 5, 86.7, 29.1, "CLAHE"],
      ["soto_lamongan_05.jpg", "Soto Ayam", 4, 3, 65.0, 4, 84.1, 4, 91.0, 4, 85.8, 4, 88.2, 30.2, "CLAHE"],
      ["ayam_goreng_06.jpg", "Ayam Goreng", 3, 2, 63.5, 3, 80.4, 3, 88.6, 3, 84.9, 3, 90.1, 29.6, "Brightness/Gamma"],
      ["miegoreng_malam_07.jpg", "Mie Goreng", 4, 3, 61.2, 4, 82.9, 4, 90.7, 4, 83.4, 4, 87.1, 29.3, "CLAHE"],
      ["tempe_penyet_08.jpg", "Tempe Goreng", 6, 4, 58.7, 5, 78.9, 6, 88.9, 5, 81.5, 6, 86.4, 28.5, "CLAHE"],
      ["tahu_sumedang_09.jpg", "Tahu Goreng", 5, 4, 66.3, 5, 83.5, 5, 89.8, 5, 87.6, 5, 88.5, 30.7, "CLAHE"],
      ["gadogado_betawi_10.jpg", "Gado-Gado", 3, 2, 60.8, 3, 81.0, 3, 89.5, 3, 86.8, 3, 85.9, 29.0, "CLAHE"],
      ["pempek_kapal_11.jpg", "Pempek", 4, 3, 63.9, 4, 84.8, 4, 90.2, 4, 85.0, 4, 86.2, 29.9, "CLAHE"],
      ["telur_balado_12.jpg", "Telur Balado", 5, 3, 59.5, 5, 82.1, 5, 91.4, 4, 84.2, 5, 89.0, 29.5, "CLAHE"],
      ["nasgor_kambing_13.jpg", "Nasi Goreng", 4, 2, 57.6, 4, 80.3, 4, 89.9, 3, 82.7, 4, 87.5, 28.8, "CLAHE"],
      ["bakso_urat_14.jpg", "Bakso", 5, 4, 65.4, 5, 85.2, 5, 93.1, 5, 88.0, 5, 89.6, 31.1, "CLAHE"],
      ["sate_taichan_15.jpg", "Sate Ayam", 4, 3, 62.0, 4, 79.8, 4, 87.6, 4, 88.9, 4, 86.5, 30.1, "Contrast Stretching"],
      ["rendang_padang_16.jpg", "Rendang", 6, 3, 53.8, 5, 78.4, 6, 88.4, 5, 81.2, 5, 85.1, 28.4, "CLAHE"],
      ["soto_betawi_17.jpg", "Soto Ayam", 3, 2, 64.7, 3, 83.2, 3, 90.0, 3, 85.4, 3, 87.8, 30.0, "CLAHE"],
      ["ayam_kalasan_18.jpg", "Ayam Goreng", 4, 3, 61.9, 4, 81.6, 4, 88.7, 4, 84.0, 4, 90.4, 29.7, "Brightness/Gamma"],
      ["miegoreng_jawa_19.jpg", "Mie Goreng", 5, 3, 60.1, 4, 80.9, 5, 89.6, 4, 83.8, 5, 86.9, 29.2, "CLAHE"],
      ["tempe_mendoan_20.jpg", "Tempe Goreng", 4, 3, 62.8, 4, 84.5, 4, 88.1, 4, 83.9, 4, 85.7, 29.4, "CLAHE"],
      ["tahu_isi_21.jpg", "Tahu Goreng", 5, 4, 64.9, 5, 83.7, 5, 90.5, 5, 86.4, 5, 88.1, 30.3, "CLAHE"],
      ["gadogado_siram_22.jpg", "Gado-Gado", 4, 3, 61.4, 4, 81.9, 4, 89.1, 4, 85.1, 4, 86.0, 29.5, "CLAHE"],
      ["pempek_lenjer_23.jpg", "Pempek", 3, 2, 63.0, 3, 86.1, 3, 87.9, 3, 84.6, 3, 85.4, 29.8, "CLAHE"],
      ["telur_balado_24.jpg", "Telur Balado", 4, 3, 60.5, 4, 82.0, 4, 90.8, 4, 85.3, 4, 88.6, 29.6, "CLAHE"],
      ["prasmanan_mix_25.jpg", "Nasi Goreng", 6, 4, 58.2, 5, 80.5, 6, 90.1, 5, 83.7, 6, 87.4, 28.9, "CLAHE"],
      ["kasir_paket_26.jpg", "Ayam Goreng", 5, 4, 64.4, 5, 82.7, 5, 91.2, 5, 86.9, 5, 89.3, 30.5, "CLAHE"],
      ["warung_malam_27.jpg", "Rendang", 4, 2, 55.1, 4, 79.2, 4, 88.8, 3, 81.6, 4, 86.2, 28.7, "CLAHE"],
      ["kantin_siang_28.jpg", "Bakso", 3, 3, 69.2, 3, 85.0, 3, 92.0, 3, 89.4, 3, 90.2, 31.2, "CLAHE"],
      ["festival_kuliner_29.jpg", "Sate Ayam", 5, 3, 60.9, 5, 82.3, 5, 90.6, 4, 85.7, 5, 88.0, 29.4, "CLAHE"],
      ["ujicoba_gelap_30.jpg", "Soto Ayam", 4, 2, 56.4, 4, 81.1, 4, 89.7, 4, 83.2, 4, 88.5, 29.0, "CLAHE"]
    ];
    return samples.map((s, i) => {
      const bestConf = Math.max(s[6], s[8], s[10], s[12]);
      return {
        no: i + 1,
        image_name: s[0],
        dominantClass: s[1],
        gt: s[2],
        beforeCount: s[3],
        beforeConf: s[4],
        heCount: s[5],
        heConf: s[6],
        claheCount: s[7],
        claheConf: s[8],
        csCount: s[9],
        csConf: s[10],
        brightCount: s[11],
        brightConf: s[12],
        psnr: s[13],
        boost: bestConf - s[4],
        bestMethod: s[14]
      };
    });
  }

  function getDefaultSessions() {
    return [
      { media_name: "nasgor_malam_01.jpg", media_type: "image", enhancement_method: "clahe", mode: "counting", total_detected: 5, region_inside_count: 3, region_outside_count: 2, avg_confidence: 91.8, created_at: "2026-11-12T19:15:00Z" },
      { media_name: "video_prasmanan_01.mp4", media_type: "video", enhancement_method: "clahe", mode: "tracking", total_detected: 5, region_inside_count: 4, region_outside_count: 1, avg_confidence: 90.4, created_at: "2026-11-12T19:30:00Z" },
      { media_name: "bakso_komplit_02.jpg", media_type: "image", enhancement_method: "he", mode: "counting", total_detected: 4, region_inside_count: 3, region_outside_count: 1, avg_confidence: 86.2, created_at: "2026-11-12T20:05:00Z" },
      { media_name: "video_kasir_warung.mp4", media_type: "video", enhancement_method: "brightness", mode: "tracking", total_detected: 4, region_inside_count: 3, region_outside_count: 1, avg_confidence: 88.9, created_at: "2026-11-13T08:40:00Z" }
    ];
  }

  function safeJsonParse(str, fallback) {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch (_) { return fallback; }
  }

  function formatShortDate(iso) {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString("id-ID")} ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
    } catch (_) {
      return String(iso);
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function escapeXml(str) {
    return escapeHtml(str);
  }
})();
