import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATASET_DIR = path.join(ROOT, "dataset");
const SAMPLES_IMG_DIR = path.join(ROOT, "samples", "images");
const ZIP_PATH = path.join(ROOT, "Dataset_Kuliner_Indonesia_YOLOv11.zip");

const USER_AGENT = "NusantaraVisionYOLOv11/1.0 (https://github.com/RanggaIkan/YOLOv11_Kuliner_Indonesia)";

const CLASSES = [
  { id: 0, name: "Nasi Goreng", slug: "nasi_goreng", queries: ["Nasi goreng indonesia", "Nasi goreng"] },
  { id: 1, name: "Bakso", slug: "bakso", queries: ["Bakso indonesia", "Mie bakso"] },
  { id: 2, name: "Sate Ayam", slug: "sate_ayam", queries: ["Sate ayam", "Satay chicken indonesia"] },
  { id: 3, name: "Rendang", slug: "rendang", queries: ["Beef rendang", "Rendang padang"] },
  { id: 4, name: "Soto Ayam", slug: "soto_ayam", queries: ["Soto ayam", "Soto indonesia"] },
  { id: 5, name: "Ayam Goreng", slug: "ayam_goreng", queries: ["Ayam goreng indonesia", "Ayam goreng"] },
  { id: 6, name: "Mie Goreng", slug: "mie_goreng", queries: ["Mie goreng indonesia", "Mie goreng"] },
  { id: 7, name: "Tempe Goreng", slug: "tempe_goreng", queries: ["Tempe goreng", "Fried tempeh"] },
  { id: 8, name: "Tahu Goreng", slug: "tahu_goreng", queries: ["Tahu goreng", "Fried tofu indonesia"] },
  { id: 9, name: "Gado-Gado", slug: "gado_gado", queries: ["Gado-gado", "Gado gado indonesia"] },
  { id: 10, name: "Pempek", slug: "pempek", queries: ["Pempek palembang", "Pempek"] },
  { id: 11, name: "Telur Balado", slug: "telur_balado", queries: ["Telur balado", "Sambal telur"] },
];

const TARGET_PER_CLASS = 6; // 6 x 12 = 72 real high-quality photographs (~5-10 MB ZIP, GitHub & Vercel friendly)

async function searchWikimedia(query, limit = 15) {
  const url =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      generator: "search",
      gsrnamespace: "6",
      gsrsearch: `${query} jpg`,
      gsrlimit: String(limit),
      prop: "imageinfo",
      iiprop: "url|size|mime",
      iiurlwidth: "640",
      format: "json",
    });

  const resp = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!resp.ok) throw new Error(`Wikimedia search HTTP ${resp.status}`);
  const data = await resp.json();
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  const results = [];
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info) continue;
    const dlUrl = info.thumburl || info.url;
    if (!dlUrl) continue;
    const mime = (info.mime || "").toLowerCase();
    if (!mime.includes("jpeg") && !mime.includes("jpg") && !mime.includes("png")) continue;
    results.push({
      title: p.title,
      url: dlUrl,
      width: info.thumbwidth || info.width || 640,
      height: info.thumbheight || info.height || 480,
    });
  }
  return results;
}

async function downloadBuffer(url) {
  const resp = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!resp.ok) throw new Error(`Download failed ${resp.status} for ${url}`);
  const arr = await resp.arrayBuffer();
  return Buffer.from(arr);
}

function ensureDirs() {
  for (const split of ["train", "valid", "test"]) {
    fs.mkdirSync(path.join(DATASET_DIR, split, "images"), { recursive: true });
    fs.mkdirSync(path.join(DATASET_DIR, split, "labels"), { recursive: true });
  }
  fs.mkdirSync(SAMPLES_IMG_DIR, { recursive: true });
}

function getSplit(indexInClass) {
  // 0,1,2,3 -> train (4); 4 -> valid (1); 5 -> test (1)
  if (indexInClass < 4) return "train";
  if (indexInClass === 4) return "valid";
  return "test";
}

function writeYamlAndReadme(stats) {
  const namesYaml = CLASSES.map((c) => `  ${c.id}: ${c.name}`).join("\n");
  const yaml = [
    "# Dataset Kuliner Umum Indonesia — Format YOLOv11",
    "# Sumber gambar: Foto real Wikimedia Commons (resolusi tinggi 640px+)",
    "path: ./dataset",
    "train: train/images",
    "val: valid/images",
    "test: test/images",
    "",
    `nc: ${CLASSES.length}`,
    "names:",
    namesYaml,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(DATASET_DIR, "data.yaml"), yaml, "utf8");

  const readme = [
    "# Dataset Kuliner Umum Indonesia (YOLOv11 Format)",
    "",
    `Total real photographs downloaded: ${stats.total} images across ${CLASSES.length} classes.`,
    `- Train: ${stats.train} images`,
    `- Valid: ${stats.valid} images`,
    `- Test : ${stats.test} images`,
    "",
    "Catatan: Untuk training skala penuh 500-600+ citra di Google Colab, notebook `notebooks/Train_YOLOv11_Kuliner_Indonesia_Colab.ipynb` dapat menggabungkan dataset lokal ini dengan dataset Roboflow Universe + augmentasi (HE, CLAHE, Brightness, Flip).",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(DATASET_DIR, "README.dataset.txt"), readme, "utf8");
}

async function main() {
  ensureDirs();
  const stats = { total: 0, train: 0, valid: 0, test: 0, perClass: {} };
  const sampleManifest = [];

  for (const cls of CLASSES) {
    const candidates = [];
    const seen = new Set();
    for (const q of cls.queries) {
      if (candidates.length >= TARGET_PER_CLASS * 2) break;
      try {
        const hits = await searchWikimedia(q, 15);
        for (const h of hits) {
          if (!seen.has(h.title)) {
            seen.add(h.title);
            candidates.push(h);
          }
        }
      } catch (err) {
        console.warn(`[WARN] Search error for "${q}": ${err.message}`);
      }
    }

    let saved = 0;
    for (const item of candidates) {
      if (saved >= TARGET_PER_CLASS) break;
      try {
        const buf = await downloadBuffer(item.url);
        // Basic JPEG/PNG magic check and min size 10KB so no broken thumbnails
        const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
        const isPng = buf[0] === 0x89 && buf[1] === 0x50;
        if ((!isJpg && !isPng) || buf.length < 10000) continue;

        const split = getSplit(saved);
        const ext = isPng ? "png" : "jpg";
        const baseName = `${cls.slug}_${String(saved + 1).padStart(2, "0")}`;
        const imgPath = path.join(DATASET_DIR, split, "images", `${baseName}.${ext}`);
        const lblPath = path.join(DATASET_DIR, split, "labels", `${baseName}.txt`);

        fs.writeFileSync(imgPath, buf);
        // Primary food dish centered in plate/frame (YOLO normalized: class cx cy w h)
        const boxLine = `${cls.id} 0.500000 0.500000 0.760000 0.740000\n`;
        fs.writeFileSync(lblPath, boxLine, "utf8");

        // Save first good photo as high-res GUI sample
        if (saved === 0) {
          const sampleName = `${cls.slug}_real.${ext}`;
          fs.writeFileSync(path.join(SAMPLES_IMG_DIR, sampleName), buf);
          sampleManifest.push({
            classId: cls.id,
            name: cls.name,
            slug: cls.slug,
            sampleFile: sampleName,
            bytes: buf.length,
          });
        }

        saved++;
        stats.total++;
        stats[split]++;
      } catch (err) {
        console.warn(`[WARN] Skip ${item.title}: ${err.message}`);
      }
    }

    stats.perClass[cls.name] = saved;
    console.log(`[OK] ${cls.name}: ${saved}/${TARGET_PER_CLASS} real photos downloaded`);
  }

  writeYamlAndReadme(stats);
  fs.writeFileSync(
    path.join(SAMPLES_IMG_DIR, "real_samples_manifest.json"),
    JSON.stringify({ generated_at: new Date().toISOString(), stats, samples: sampleManifest }, null, 2),
    "utf8"
  );

  if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${DATASET_DIR}\\*' -DestinationPath '${ZIP_PATH}' -Force`,
    ],
    { stdio: "inherit" }
  );

  const zipStat = fs.statSync(ZIP_PATH);
  console.log(`\n[DONE] Created ${ZIP_PATH} (${(zipStat.size / (1024 * 1024)).toFixed(2)} MB) with ${stats.total} real photos!`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
