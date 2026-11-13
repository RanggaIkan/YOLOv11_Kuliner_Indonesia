import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATASET_DIR = path.join(ROOT, "dataset");
const SAMPLES_IMG_DIR = path.join(ROOT, "samples", "images");
const ZIP_PATH = path.join(ROOT, "Dataset_Kuliner_Indonesia_YOLOv11.zip");

const CLASSES = [
  { id: 0, name: "Nasi Goreng", slug: "nasi_goreng" },
  { id: 1, name: "Bakso", slug: "bakso" },
  { id: 2, name: "Sate Ayam", slug: "sate_ayam" },
  { id: 3, name: "Rendang", slug: "rendang" },
  { id: 4, name: "Soto Ayam", slug: "soto_ayam" },
  { id: 5, name: "Ayam Goreng", slug: "ayam_goreng" },
  { id: 6, name: "Mie Goreng", slug: "mie_goreng" },
  { id: 7, name: "Tempe Goreng", slug: "tempe_goreng" },
  { id: 8, name: "Tahu Goreng", slug: "tahu_goreng" },
  { id: 9, name: "Gado-Gado", slug: "gado_gado" },
  { id: 10, name: "Pempek", slug: "pempek" },
  { id: 11, name: "Telur Balado", slug: "telur_balado" },
];

const EXPECTED_SPLITS = {
  train: { total: 420, perClass: 35 },
  valid: { total: 120, perClass: 10 },
  test: { total: 60, perClass: 5 },
};

function hammingHex64(hexA, hexB) {
  let x = BigInt("0x" + hexA) ^ BigInt("0x" + hexB);
  let dist = 0;
  while (x > 0n) {
    x &= x - 1n;
    dist++;
  }
  return dist;
}

function batchInspectImages(imagePaths) {
  const listPath = path.join(os.tmpdir(), `audit_paths_${process.pid}.txt`);
  const psPath = path.join(os.tmpdir(), `audit_worker_${process.pid}.ps1`);
  fs.writeFileSync(listPath, imagePaths.join("\n"), "utf8");

  const psCode = String.raw`
param([string]$ListFile)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

public static class AuditImgTool {
  public static string Inspect(string p) {
    try {
      long bytes = new FileInfo(p).Length;
      using (var img = Image.FromFile(p)) {
        int w = img.Width, h = img.Height;
        string md5;
        using (var md5er = MD5.Create())
        using (var fs = File.OpenRead(p)) {
          byte[] hash = md5er.ComputeHash(fs);
          var sb = new StringBuilder(32);
          foreach (byte b in hash) sb.Append(b.ToString("x2"));
          md5 = sb.ToString();
        }
        string dhash;
        using (var tiny = new Bitmap(9, 8, PixelFormat.Format24bppRgb)) {
          using (var g = Graphics.FromImage(tiny)) {
            g.InterpolationMode = InterpolationMode.HighQualityBilinear;
            g.DrawImage(img, 0, 0, 9, 8);
          }
          var rect = new Rectangle(0, 0, 9, 8);
          var data = tiny.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
          int stride = Math.Abs(data.Stride);
          byte[] buf = new byte[stride * 8];
          Marshal.Copy(data.Scan0, buf, 0, buf.Length);
          tiny.UnlockBits(data);
          double[,] lum = new double[8, 9];
          for (int y = 0; y < 8; y++) {
            for (int x = 0; x < 9; x++) {
              int idx = y * stride + x * 3;
              lum[y, x] = 0.299 * buf[idx + 2] + 0.587 * buf[idx + 1] + 0.114 * buf[idx];
            }
          }
          ulong dh = 0;
          int bit = 0;
          for (int y = 0; y < 8; y++) {
            for (int x = 0; x < 8; x++) {
              if (lum[y, x] > lum[y, x + 1]) dh |= (1UL << bit);
              bit++;
            }
          }
          dhash = dh.ToString("x16");
        }

        double meanL = 0, stdL = 0;
        using (var sm = new Bitmap(120, 90, PixelFormat.Format24bppRgb)) {
          using (var g = Graphics.FromImage(sm)) {
            g.InterpolationMode = InterpolationMode.HighQualityBilinear;
            g.DrawImage(img, 0, 0, 120, 90);
          }
          var rect = new Rectangle(0, 0, 120, 90);
          var data = sm.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
          int stride = Math.Abs(data.Stride);
          byte[] buf = new byte[stride * 90];
          Marshal.Copy(data.Scan0, buf, 0, buf.Length);
          sm.UnlockBits(data);
          double s1 = 0, s2 = 0;
          for (int y = 0; y < 90; y++) {
            for (int x = 0; x < 120; x++) {
              int idx = y * stride + x * 3;
              double l = 0.299 * buf[idx + 2] + 0.587 * buf[idx + 1] + 0.114 * buf[idx];
              s1 += l; s2 += l * l;
            }
          }
          int n = 120 * 90;
          meanL = s1 / n;
          stdL = Math.Sqrt(Math.Max(0, s2 / n - meanL * meanL));
        }

        return string.Format(System.Globalization.CultureInfo.InvariantCulture,
          "{{\"ok\":true,\"path\":\"{0}\",\"w\":{1},\"h\":{2},\"bytes\":{3},\"md5\":\"{4}\",\"dhash\":\"{5}\",\"meanL\":{6},\"stdL\":{7} }}",
          p.Replace("\\", "/"), w, h, bytes, md5, dhash, Math.Round(meanL, 1), Math.Round(stdL, 1));
      }
    } catch (Exception ex) {
      return string.Format("{{\"ok\":false,\"path\":\"{0}\",\"err\":\"{1}\"}}",
        p.Replace("\\", "/"), ex.Message.Replace("\"", "'").Replace("\\", "/"));
    }
  }
}
'@
foreach ($line in Get-Content -Path $ListFile -Encoding UTF8) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  Write-Output ([AuditImgTool]::Inspect($line))
}
`;
  fs.writeFileSync(psPath, psCode, "utf8");
  try {
    const out = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psPath, "-ListFile", listPath],
      { encoding: "utf8", maxBuffer: 25 * 1024 * 1024 }
    );
    return out
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } finally {
    try { fs.unlinkSync(listPath); } catch {}
    try { fs.unlinkSync(psPath); } catch {}
  }
}

function inspectZipArchive(zipPath) {
  const psPath = path.join(os.tmpdir(), `audit_zip_${process.pid}.ps1`);
  const psCode = String.raw`
param([string]$ZipFile)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($ZipFile)
try {
  $entries = $z.Entries | ForEach-Object { $_.FullName.Replace('\', '/') }
  $imgs = ($entries | Where-Object { $_ -match '^(train|valid|test)/images/.+\.jpg$' }).Count
  $lbls = ($entries | Where-Object { $_ -match '^(train|valid|test)/labels/.+\.txt$' }).Count
  $hasYaml = $entries -contains 'data.yaml'
  $hasReadme = $entries -contains 'README.dataset.txt'
  Write-Output ("{0}|{1}|{2}|{3}|{4}" -f $z.Entries.Count, $imgs, $lbls, $hasYaml, $hasReadme)
} finally {
  $z.Dispose()
}
`;
  fs.writeFileSync(psPath, psCode, "utf8");
  try {
    const out = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psPath, "-ZipFile", zipPath],
      { encoding: "utf8" }
    ).trim();
    const [totalEntries, imgs, lbls, hasYaml, hasReadme] = out.split("|");
    return {
      totalEntries: Number(totalEntries),
      images: Number(imgs),
      labels: Number(lbls),
      hasYaml: hasYaml === "True",
      hasReadme: hasReadme === "True",
    };
  } finally {
    try { fs.unlinkSync(psPath); } catch {}
  }
}

function main() {
  const errors = [];
  const warnings = [];
  const allDatasetImagePaths = [];
  const datasetMetaByNormPath = new Map();

  console.log("=== Audit Kualitas Dataset & Hero Samples YOLOv11 Kuliner Indonesia ===");

  // 1. Check data.yaml & README.dataset.txt
  const yamlPath = path.join(DATASET_DIR, "data.yaml");
  const readmePath = path.join(DATASET_DIR, "README.dataset.txt");
  if (!fs.existsSync(yamlPath)) errors.push("Missing dataset/data.yaml");
  else {
    const yamlTxt = fs.readFileSync(yamlPath, "utf8");
    if (!yamlTxt.includes("nc: 12")) errors.push("dataset/data.yaml does not specify nc: 12");
    for (const c of CLASSES) {
      if (!yamlTxt.includes(`${c.id}: ${c.name}`)) errors.push(`data.yaml missing class ${c.id}: ${c.name}`);
    }
  }
  if (!fs.existsSync(readmePath)) errors.push("Missing dataset/README.dataset.txt");

  // 2. Check dataset splits, pairing, and YOLO label format
  const uniqueBboxes = new Set();
  let totalImages = 0;

  for (const [split, spec] of Object.entries(EXPECTED_SPLITS)) {
    const imgDir = path.join(DATASET_DIR, split, "images");
    const lblDir = path.join(DATASET_DIR, split, "labels");
    if (!fs.existsSync(imgDir) || !fs.existsSync(lblDir)) {
      errors.push(`Missing directory for split ${split}`);
      continue;
    }
    const imgs = fs.readdirSync(imgDir).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
    const lbls = fs.readdirSync(lblDir).filter((f) => /\.txt$/i.test(f)).sort();

    if (imgs.length !== spec.total) {
      errors.push(`Split ${split}: expected ${spec.total} images, found ${imgs.length}`);
    }
    if (lbls.length !== spec.total) {
      errors.push(`Split ${split}: expected ${spec.total} labels, found ${lbls.length}`);
    }
    totalImages += imgs.length;

    const imgStems = new Set(imgs.map((f) => path.parse(f).name));
    const lblStems = new Set(lbls.map((f) => path.parse(f).name));
    for (const s of imgStems) {
      if (!lblStems.has(s)) errors.push(`Orphan image without label: ${split}/images/${s}`);
    }
    for (const s of lblStems) {
      if (!imgStems.has(s)) errors.push(`Orphan label without image: ${split}/labels/${s}`);
    }

    const perClassCounts = Object.fromEntries(CLASSES.map((c) => [c.slug, 0]));
    for (const imgFile of imgs) {
      const stem = path.parse(imgFile).name;
      const cls = CLASSES.find((c) => stem.startsWith(`${c.slug}_`));
      if (!cls) {
        errors.push(`Unexpected class prefix on ${split}/images/${imgFile}`);
        continue;
      }
      perClassCounts[cls.slug]++;

      const lblPath = path.join(lblDir, `${stem}.txt`);
      if (fs.existsSync(lblPath)) {
        const content = fs.readFileSync(lblPath, "utf8").trim();
        const lines = content.split(/\r?\n/).filter(Boolean);
        if (lines.length === 0) {
          errors.push(`Empty label file: ${split}/labels/${stem}.txt`);
        } else {
          for (const line of lines) {
            const parts = line.trim().split(/\s+/).map(Number);
            if (parts.length !== 5 || parts.some((n) => !Number.isFinite(n))) {
              errors.push(`Malformed YOLO label in ${split}/labels/${stem}.txt: "${line}"`);
              continue;
            }
            const [cid, cx, cy, bw, bh] = parts;
            if (cid !== cls.id) {
              errors.push(`Label classId mismatch in ${split}/labels/${stem}.txt: got ${cid}, expected ${cls.id}`);
            }
            if (cx <= 0 || cx >= 1 || cy <= 0 || cy >= 1 || bw < 0.2 || bw > 0.98 || bh < 0.2 || bh > 0.98) {
              errors.push(`Out-of-bounds YOLO bbox in ${split}/labels/${stem}.txt: ${line}`);
            }
            uniqueBboxes.add(`${cx.toFixed(4)},${cy.toFixed(4)},${bw.toFixed(4)},${bh.toFixed(4)}`);
          }
        }
      }

      const fullPath = path.join(imgDir, imgFile);
      allDatasetImagePaths.push(fullPath);
      datasetMetaByNormPath.set(fullPath.replace(/\\/g, "/"), {
        split,
        filename: imgFile,
        classId: cls.id,
        className: cls.name,
        slug: cls.slug,
      });
    }

    for (const c of CLASSES) {
      if (perClassCounts[c.slug] !== spec.perClass) {
        errors.push(`Split ${split} class ${c.name}: expected ${spec.perClass}, found ${perClassCounts[c.slug]}`);
      }
    }
  }

  if (uniqueBboxes.size < 250) {
    errors.push(`Labels appear overly uniform/hardcoded: only ${uniqueBboxes.size} unique bounding boxes across ${totalImages} images`);
  }

  // 3. Check dataset_manifest.json for zero leakage
  const dsManifestPath = path.join(DATASET_DIR, "dataset_manifest.json");
  if (fs.existsSync(dsManifestPath)) {
    const m = JSON.parse(fs.readFileSync(dsManifestPath, "utf8"));
    const nonOrigValTest = (m.items || []).filter(
      (x) => (x.split === "valid" || x.split === "test") && x.isAugmented === true
    );
    if (nonOrigValTest.length > 0) {
      errors.push(`Data leakage: found ${nonOrigValTest.length} augmented images in valid/test!`);
    }
  }

  // 4. Inspect all 600 dataset images + 13 hero samples via .NET System.Drawing
  const sampleFiles = fs.existsSync(SAMPLES_IMG_DIR) ? fs.readdirSync(SAMPLES_IMG_DIR) : [];
  const leftoverPngs = sampleFiles.filter((f) => /\.png$/i.test(f));
  if (leftoverPngs.length > 0) {
    errors.push(`Old cartoon PNGs still present in samples/images/: ${leftoverPngs.join(", ")}`);
  }

  const expectedHeroes = [
    ...CLASSES.map((c) => `${c.slug}_real.jpg`),
    "prasmanan_kuliner_real.jpg",
  ];
  const heroPaths = [];
  for (const hf of expectedHeroes) {
    const p = path.join(SAMPLES_IMG_DIR, hf);
    if (!fs.existsSync(p)) {
      errors.push(`Missing hero sample: samples/images/${hf}`);
    } else {
      heroPaths.push(p);
    }
  }

  const inspectedDataset = batchInspectImages(allDatasetImagePaths);
  const inspectedHeroes = batchInspectImages(heroPaths);

  let corruptCount = 0;
  let lowResCount = 0;
  let badAspectCount = 0;
  let smallBytesCount = 0;
  let poorExposureCount = 0;

  const md5Map = new Map();
  const records = [];

  for (const r of inspectedDataset) {
    const meta = datasetMetaByNormPath.get(r.path);
    if (!r.ok) {
      corruptCount++;
      errors.push(`Corrupt image: ${r.path} (${r.err})`);
      continue;
    }
    const minSide = Math.min(r.w, r.h);
    const maxSide = Math.max(r.w, r.h);
    const aspect = r.w / r.h;
    if (minSide < 480 || maxSide < 640) {
      lowResCount++;
      errors.push(`Low resolution (${r.w}x${r.h}): ${meta.split}/${meta.filename}`);
    }
    if (aspect < 0.55 || aspect > 1.95) {
      badAspectCount++;
      errors.push(`Bad aspect ratio (${aspect.toFixed(2)}): ${meta.split}/${meta.filename}`);
    }
    if (r.bytes < 35 * 1024) {
      smallBytesCount++;
      errors.push(`Too small (${r.bytes} B < 35KB): ${meta.split}/${meta.filename}`);
    }
    if (r.meanL < 30 || r.meanL > 235 || r.stdL < 18) {
      poorExposureCount++;
      errors.push(`Poor luminance/contrast (meanL=${r.meanL}, stdL=${r.stdL}): ${meta.split}/${meta.filename}`);
    }

    if (md5Map.has(r.md5)) {
      const prev = md5Map.get(r.md5);
      errors.push(`Exact MD5 duplicate: ${prev.split}/${prev.filename} == ${meta.split}/${meta.filename}`);
    } else {
      md5Map.set(r.md5, meta);
    }

    records.push({ ...meta, ...r });
  }

  // dHash near-duplicate & cross-split leakage checks
  let crossSplitNearDup = 0;
  let crossClassNearDup = 0;
  let valTestIntraNearDup = 0;
  let trainIntraNearDup = 0;

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i];
      const b = records[j];
      const dist = hammingHex64(a.dhash, b.dhash);
      if (a.classId !== b.classId && dist <= 8) {
        crossClassNearDup++;
        errors.push(`Cross-class near-dup (dHash dist=${dist}): ${a.split}/${a.filename} vs ${b.split}/${b.filename}`);
      } else if (a.split !== b.split && dist <= 8) {
        crossSplitNearDup++;
        errors.push(`Cross-split data leakage (dHash dist=${dist}): ${a.split}/${a.filename} vs ${b.split}/${b.filename}`);
      } else if ((a.split === "valid" || a.split === "test") && dist <= 8) {
        valTestIntraNearDup++;
        errors.push(`Intra-${a.split} near-dup (dHash dist=${dist}): ${a.filename} vs ${b.filename}`);
      } else if (a.split === "train" && b.split === "train" && dist <= 4) {
        trainIntraNearDup++;
        warnings.push(`Close train pair (dHash dist=${dist}): ${a.filename} vs ${b.filename}`);
      }
    }
  }

  // Hero validation
  for (const h of inspectedHeroes) {
    const name = path.basename(h.path);
    if (!h.ok) {
      errors.push(`Corrupt hero image: ${name}`);
      continue;
    }
    if (h.w < 960 || Math.min(h.w, h.h) < 540) {
      errors.push(`Hero resolution < 960px wide or <540px tall: ${name} (${h.w}x${h.h})`);
    }
    if (h.bytes < 35 * 1024) {
      errors.push(`Hero too small (<35KB): ${name}`);
    }
  }

  const heroManifestPath = path.join(SAMPLES_IMG_DIR, "real_samples_manifest.json");
  if (!fs.existsSync(heroManifestPath)) {
    errors.push("Missing samples/images/real_samples_manifest.json");
  } else {
    const hm = JSON.parse(fs.readFileSync(heroManifestPath, "utf8"));
    if (!Array.isArray(hm.samples) || hm.samples.length !== 12) {
      errors.push(`real_samples_manifest.json: expected 12 class samples, got ${hm.samples?.length}`);
    }
    if (!hm.prasmanan_hero || hm.prasmanan_hero.sampleFile !== "prasmanan_kuliner_real.jpg") {
      errors.push("real_samples_manifest.json: missing prasmanan_hero entry");
    }
  }

  // 5. ZIP validation
  let zipInfo = null;
  if (!fs.existsSync(ZIP_PATH)) {
    errors.push("Missing Dataset_Kuliner_Indonesia_YOLOv11.zip");
  } else {
    const fd = fs.openSync(ZIP_PATH, "r");
    const hdr = Buffer.alloc(4);
    fs.readSync(fd, hdr, 0, 4, 0);
    fs.closeSync(fd);
    if (hdr[0] !== 0x50 || hdr[1] !== 0x4b || hdr[2] !== 0x03 || hdr[3] !== 0x04) {
      errors.push("Dataset_Kuliner_Indonesia_YOLOv11.zip invalid PK magic bytes");
    }
    const zipBytes = fs.statSync(ZIP_PATH).size;
    if (zipBytes > 98 * 1024 * 1024) {
      errors.push(`ZIP exceeds 98 MB GitHub safety limit: ${(zipBytes / (1024 * 1024)).toFixed(2)} MB`);
    }
    zipInfo = { sizeMB: Number((zipBytes / (1024 * 1024)).toFixed(2)), ...inspectZipArchive(ZIP_PATH) };
    if (zipInfo.images !== 600 || zipInfo.labels !== 600 || !zipInfo.hasYaml || !zipInfo.hasReadme) {
      errors.push(`ZIP structure mismatch: ${JSON.stringify(zipInfo)}`);
    }
  }

  console.log("\n--- Ringkasan Audit ---");
  console.log(`Total Dataset Images : ${totalImages} (target: 600 = 420 train / 120 valid / 60 test)`);
  console.log(`Corrupt / <480px     : ${corruptCount} corrupt, ${lowResCount} <480px, ${badAspectCount} bad-aspect, ${smallBytesCount} <35KB`);
  console.log(`Unique BBoxes        : ${uniqueBboxes.size} / ${totalImages}`);
  console.log(`MD5 Duplicates       : ${records.length - md5Map.size}`);
  console.log(`Near-Duplicates      : crossClass=${crossClassNearDup}, crossSplitLeakage=${crossSplitNearDup}, valTestIntra=${valTestIntraNearDup}, trainIntraDist<=4=${trainIntraNearDup}`);
  console.log(`Hero Samples         : ${inspectedHeroes.length}/13 verified (${leftoverPngs.length} leftover PNGs)`);
  if (zipInfo) {
    console.log(`ZIP Archive          : ${zipInfo.sizeMB} MB (${zipInfo.images} imgs, ${zipInfo.labels} labels, yaml=${zipInfo.hasYaml}, readme=${zipInfo.hasReadme})`);
  }

  if (warnings.length > 0) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings.slice(0, 15)) console.log(`  [WARN] ${w}`);
  }

  if (errors.length > 0) {
    console.error(`\n[FAIL] Audit failed with ${errors.length} error(s):`);
    for (const e of errors.slice(0, 30)) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log("\n[PASS] ALL DATASET & SAMPLE QUALITY CHECKS PASSED (0 corrupt, 0 <480px, 0 duplicates, 0 leakage, 420+120+60=600)!");
}

main();
