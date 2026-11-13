import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATASET_DIR = path.join(ROOT, "dataset");
const SAMPLES_IMG_DIR = path.join(ROOT, "samples", "images");
const ZIP_PATH = path.join(ROOT, "Dataset_Kuliner_Indonesia_YOLOv11.zip");
const CACHE_DIR = path.join(os.tmpdir(), "nusantara_vision_dataset_cache_v2");
const SCRATCH_DIR = "C:/Users/rangg/.gemini/antigravity/brain/cd511827-867c-445e-81e8-f340f3358775/scratch";

const USER_AGENT =
  "NusantaraVisionYOLOv11/2.0 (https://github.com/RanggaIkan/YOLOv11_Kuliner_Indonesia; academic-cv-dataset)";

const TARGET_TRAIN_PER_CLASS = 35;
const TARGET_VALID_PER_CLASS = 10;
const TARGET_TEST_PER_CLASS = 5;
const TARGET_PER_CLASS = TARGET_TRAIN_PER_CLASS + TARGET_VALID_PER_CLASS + TARGET_TEST_PER_CLASS; // 50
const MAX_ORIGINALS_PER_CLASS = 50;
const MIN_DATASET_BYTES = 35 * 1024;
const MAX_DATASET_SIDE = 800; // Keeps 600-image ZIP ~55-75 MB (<100MB GitHub limit) while >= 480px min side

// Old synthetic PNGs in samples/images/ to remove once real hero photos are verified
const OLD_SYNTHETIC_PNGS = [
  "bakso_komplit.png",
  "gado_gado_tahu_tempe.png",
  "nasi_goreng_spesial.png",
  "nasi_padang_rendang.png",
  "prasmanan_kuliner_nusantara.png",
  "sate_ayam_madura.png",
];

// Global reject patterns (metadata/title/URL/categories/tags)
const GLOBAL_NEGATIVE_RE =
  /\b(menu|price|harga|daftar|sign|signage|papan|banner|spanduk|logo|icon|map|peta|chart|diagram|graph|gerobak|cart|stall|stalls|kaki lima|building|gedung|facade|storefront|shophouse|eating house|eating houses|inside of|toko|parkiran|interior|suasana|person|people|selfie|portrait|vendor|pedagang|penjual|pembeli|buying|hawker|seller|crowd|pot\s*lid|tutup|panci|steamer|kukusan|baskom|colander|raw|mentah|uncooked|unfried|packaging|kemasan|bungkus|wrapper|packet|sachet|poster|flyer|brochure|receipt|nota|meme|cartoon|vector|illustration|drawing|sketch|wajan|frying pan|wok|minyak|oil bottle|adonan|batter|dough|collage|grid|infographic|screenshot|stamp|stamps|film|newspaper|magazine|book cover|geograph|airfield|bridge|radome|satellite|station|scotland|arizona|fossae|colles|crater|lake|airport|railway|statue|museum|tropenmuseum|collectie|bestanddeelnr|cemetery|grave|flag|bendera|coin|pork|babi|ham|bacon|lard|dog|cat|preparation|pembuatan|sejarah|foto sejarah|cooking|pan[\s-]*frying|before fermentation|pre fermentation|after fermentation|fermentation|step by step|ingredients|making)\b/i;

// Known problematic historical/off-topic Wikimedia titles from audit & visual QA
const BLACKLIST_TITLE_SUBSTRINGS = [
  "bakso street food",
  "bakso-shop.jpg",
  "tahu sumedang saribumi",
  "tahu sumedang renyah",
  "fried pieces of tofu",
  "油豆腐拆骨肉",
  "日式稻荷壽司",
  "社子市場炸豆腐",
  "延平北路燙炸",
  "죽순 유부",
  "sate ayam, soto, es teh",
  "tahu digoreng.jpg",
  "sukarsih and zaenah",
  "nasi uduk telur balado jkt 11 juli 18",
  "jakarta street hawker",
  "stamps of indonesia",
  "geograph.org.uk",
  "balado airfield",
  "hk ktd",
  "oseng mlinjo.jpg",
  "sate bandeng 2.jpg",
  "horse satay, yogyakarta.jpg",
  "sate unta in taif.jpg",
  "satay stalls along boon tat",
  "soto babat 1.jpg",
  "soto kikil bondowoso.jpg",
  "soto sapi pak marto",
  "soto tangkar",
  "soto bandung.jpg",
  "soto padang 2.jpg",
  "spanduk soto ayam",
  "suasana warung soto",
  "foto sejarah pembuatan soto",
  "pembuatan soto ayam",
  "randang limpo",
  "katupek sayua randang limpo",
  "rendang hati",
  "randang maco",
  "jering masak rendang",
  "randang jariang",
  "bumbu rendang.png",
  "indomie mi goreng rendang",
  "frozen spaghetti rendang",
  "tempe burger.jpg",
  "penjual tempe.jpg",
  "tempe mendoan.jpg",
  "before fermentation",
  "pre fermentation",
  "after fermentation",
  "sliced tempeh.jpg",
  "pan-frying bites of tempeh",
  "green bean and tempeh bun",
  "pizza tempe.jpg",
  "asian pear and tempeh salad",
  "buffalo tempeh",
  "cooking tempeh",
  "makanan tempe goreng.roti",
  "es teh tempe goreng pisang",
  "parkiran tahu sumedang",
  "ethnic women buying fried tofu",
  "gulai tahu",
  "lonthong opor.jpg",
  "risoles in tahu sumedang",
  "tahu acie.png",
  "gado gado ulek.jpg",
  "bumbu gado-gado.png",
  "indonesian snack-emping-01.jpg",
  "sambalkacang.jpg",
  "tipat cantok khas bali.jpg",
  "serombotan.jpg",
  "pempek.jpg",
  "empek-empek bangka.jpg",
  "inside of toko pempek",
  "2 pempek eating houses",
  "toko pempek & kerupuk",
  "pempek beringin ptc",
  "pempek tunas baru",
  "pempek pak raden",
  "pempek candy",
  "pempek telor in a display",
  "kapal selem becuko (blank).png",
  "seblak 2.jpg",
  "seblak 3.jpg",
  "ketupat sayur.jpg",
  "2016 0717 lontong sayur.jpg",
  "set lontong basah.jpg",
  "rice bowl.jpg",
  "nasi tim ayam in jakarta.jpg",
  "nasi campur - 01.jpg",
  "nasi campur china",
  "nasi campur tionghoa",
];

const CLASSES = [
  {
    id: 0,
    name: "Nasi Goreng",
    slug: "nasi_goreng",
    categories: ["Category:Nasi_goreng"],
    queries: [
      "Nasi goreng Indonesia",
      "Nasi goreng kampung",
      "Nasi goreng Jawa",
      "Nasi goreng spesial",
      "Indonesian fried rice nasi goreng",
    ],
    wikiPages: {
      id: ["Nasi_goreng"],
      en: ["Nasi_goreng"],
    },
    positiveRe: /\b(nasi\s*goreng|fried\s*rice)\b/i,
    negativeRe: /\b(nasi\s*putih|nasi\s*kuning|nasi\s*uduk|nasi\s*liwet|nasi\s*campur|nasi\s*padang|nasi\s*lemak|nasi\s*pecel|mie\s*goreng|raw\s*rice|paddy|sawah)\b/i,
    heroPenaltyRe: /\b(sausage|sosis|ketchup|spaghetti)\b/i,
  },
  {
    id: 1,
    name: "Bakso",
    slug: "bakso",
    categories: ["Category:Bakso", "Category:Bakso_Malang", "Category:Bakso_beranak"],
    queries: [
      "Bakso kuah Indonesia",
      "Mie bakso Indonesia",
      "Bakso sapi mangkuk",
      "Bakso urat Malang",
      "Indonesian meatball soup bakso",
    ],
    wikiPages: {
      id: ["Bakso", "Bakso_Malang"],
      en: ["Bakso"],
    },
    positiveRe: /\b(bakso|baso|meatball)\b/i,
    negativeRe: /\b(tutup|panci|gerobak|cart|stall|soto|rawon|bakpao|bakpia|cilok|siomay|cuanki\s*kosong|empty\s*bowl|stacked\s*bowls|bakar|grilled|sate|dim\s*sum|shaomai|siu\s*mai|cantonese|hong\s*kong|yum\s*cha)\b/i,
    heroPreferRe: /\b(bakso.*(spesial|urat|kuah|malang|sapi)|bowl\s*of\s*bakso)\b/i,
    heroPenaltyRe: /\b(bakar|tumpeng|kosong|kemasan|frozen)\b/i,
  },
  {
    id: 2,
    name: "Sate Ayam",
    slug: "sate_ayam",
    categories: ["Category:Sate_ayam", "Category:Chicken_satay", "Category:Satay"],
    queries: [
      "Sate ayam Madura",
      "Sate ayam bumbu kacang",
      "Chicken satay skewers Indonesia",
      "Sate ayam Ponorogo",
      "Sate ayam lontong",
      "Satay skewers peanut sauce",
    ],
    wikiPages: {
      id: ["Sate_ayam", "Sate_Madura"],
      en: ["Satay"],
    },
    positiveRe: /\b(sate|satay)\b/i,
    negativeRe: /\b(bandeng|milkfish|horse|kuda|onta|unta|camel|babi|pork|kambing|mutton|lamb|kelinci|rabbit|sapi|beef|padang|lilit|maranggi|es\s*teh|iced\s*tea|soto|bakaran\s*kosong|charcoal\s*only|raw\s*meat|tusuk\s*kosong|kerang|udang|tempe|usus|bekicot|singapore\s*airlines)\b/i,
    heroPreferRe: /\b(sate\s*ayam|chicken\s*satay|madura|ponorogo|bumbu\s*kacang|peanut\s*sauce)\b/i,
    heroPenaltyRe: /\b(es\s*teh|tea|soto|sup|bakso|wings|spring\s*roll|drink|gelas|cup|plastic|styrofoam|uritan|merah|cocos|coconut)\b/i,
  },
  {
    id: 3,
    name: "Rendang",
    slug: "rendang",
    categories: ["Category:Rendang", "Category:Beef_rendang"],
    queries: [
      "Beef rendang Padang",
      "Rendang daging sapi",
      "Rendang Indonesia",
      "Minangkabau beef rendang",
      "Rendang Minang",
      "Rendang Padang close up",
    ],
    wikiPages: {
      id: ["Rendang"],
      en: ["Rendang"],
    },
    positiveRe: /\b(rendang|randang)\b/i,
    negativeRe: /\b(babi|pork|jengkol|jering|jariang|daun\s*singkong|keripik|telur|ayam|chicken|lokan|jamur|nangka|limpo|limpa|hati|paru|jantung|liver|spleen|maco|ikan|indomie|mie|mi\s*goreng|spaghetti|pasta|7-eleven|frozen|bumbu|paste|nasi\s*padang\s*buffet)\b/i,
    heroPreferRe: /\b(beef\s*rendang|rendang\s*daging\s*sapi|rendang\s*plate|rendang\s*dish|randang|sepotong\s*rendang)\b/i,
    heroPenaltyRe: /\b(nasi|rice|lemak|ketupat|katupek|lontong|nasi\s*bungkus|kotak|box|masala|curry|mutton|lamb|biriyani|kuning|beans|ramas|padang|campur)\b/i,
  },
  {
    id: 4,
    name: "Soto Ayam",
    slug: "soto_ayam",
    categories: ["Category:Soto_ayam", "Category:Soto_Banjar", "Category:Soto"],
    queries: [
      "Soto ayam Lamongan",
      "Soto ayam Indonesia",
      "Soto ayam kuah kuning",
      "Soto ayam Kudus",
      "Soto ayam spesial",
      "Indonesian chicken soup soto",
    ],
    wikiPages: {
      id: ["Soto_ayam", "Soto_Lamongan", "Soto_Banjar"],
      en: ["Soto_ayam", "Soto_(food)"],
    },
    positiveRe: /\b(soto)\b/i,
    negativeRe: /\b(soto\s*daging|soto\s*betawi|soto\s*mie|soto\s*kaki|soto\s*babat|babat|tripe|kikil|tangkar|soto\s*bandung|soto\s*sapi|soto\s*padang|sapi|beef|kambing|kerbau|buntut|paru|coto|rawon|bakso|tauto|laksa|gulai|sate)\b/i,
    heroPreferRe: /\b(soto\s*ayam|lamongan|kudus|banjar|ambengan)\b/i,
    heroPenaltyRe: /\b(kosong|sambal\s*only|ceker|kulit|kemiri|botol|bottle)\b/i,
  },
  {
    id: 5,
    name: "Ayam Goreng",
    slug: "ayam_goreng",
    categories: ["Category:Ayam_goreng", "Category:Ayam_penyet"],
    queries: [
      "Ayam goreng Indonesia",
      "Ayam goreng kremes",
      "Ayam penyet Indonesia",
      "Ayam goreng kalasan",
      "Ayam goreng lalapan",
    ],
    wikiPages: {
      id: ["Ayam_goreng", "Ayam_penyet", "Ayam_kalasan"],
      en: ["Ayam_goreng", "Ayam_penyet"],
    },
    positiveRe: /\b(ayam\s*goreng|ayam\s*penyet|ayam\s*kalasan|ayam\s*kremes|fried\s*chicken|lalapan)\b/i,
    negativeRe: /\b(ayam\s*bakar|panggang|roasted|curry|gulai|opor|soto|rendang|nugget|burger|live|rooster|hen|chick|kecap\s*soup|semur)\b/i,
    heroPenaltyRe: /\b(nasi\s*kotak|box|fast\s*food)\b/i,
  },
  {
    id: 6,
    name: "Mie Goreng",
    slug: "mie_goreng",
    categories: ["Category:Mie_goreng"],
    queries: [
      "Mie goreng Indonesia",
      "Mie goreng Jawa",
      "Bakmi goreng Indonesia",
      "Bakmi goreng Jawa",
      "Indonesian fried noodles mie goreng",
      "Mi goreng tek tek",
    ],
    wikiPages: {
      id: ["Mi_goreng", "Bakmi"],
      en: ["Mie_goreng", "Bakmi"],
    },
    positiveRe: /\b(mie\s*goreng|mi\s*goreng|bakmi\s*goreng|fried\s*noodle)\b/i,
    negativeRe: /\b(mie\s*rebus|mie\s*kuah|mie\s*ayam|bakso|ramen|pho|udon|spaghetti|pasta|bihun|kwetiau|oseng\s*mlinjo|melinjo|indomie\s*packet|bungkus|kemasan|raw\s*noodle)\b/i,
    heroPreferRe: /\b(mi\s*goreng|mie\s*goreng|bakmi\s*goreng)\b/i,
    heroPenaltyRe: /\b(sachet|packet|instan\s*bungkus)\b/i,
  },
  {
    id: 7,
    name: "Tempe Goreng",
    slug: "tempe_goreng",
    categories: ["Category:Tempe_goreng", "Category:Tempeh"],
    queries: [
      "Tempe goreng Indonesia",
      "Tempe penyet sambal",
      "Tempe mendoan Kebumen",
      "Fried tempeh plate",
      "Tempe goreng tepung",
      "Tempeh goreng sambal",
      "Indonesian fried tempeh",
    ],
    wikiPages: {
      id: ["Tempe", "Tempe_mendoan"],
      en: ["Tempeh"],
    },
    positiveRe: /\b(tempe|tempeh|mendoan|menjes)\b/i,
    negativeRe: /\b(tahu|tofu|mentah|raw|ragi|mold|kapang|ferment|soybean|kedelai|rhizopus|unfried|fresh\s*tempeh|block\s*of\s*tempeh|sliced\s*tempeh|keripik|kripik|bacem\s*mentah|burger|sandwich|bun|bread|pizza|salad|pear|buffalo|orak[\s-]*arik|ikan\s*asin|roti|es\s*teh|gado)\b/i,
    heroPreferRe: /\b(tempe\s*goreng|fried\s*tempeh|mendoan\s*kebumen|penyet|garing|tepung)\b/i,
    heroPenaltyRe: /\b(raw|uncooked|block|tahu|gembus|remah|menjes|kering|teri|orak|bacem|ayam)\b/i,
  },
  {
    id: 8,
    name: "Tahu Goreng",
    slug: "tahu_goreng",
    categories: [
      "Category:Tahu_goreng",
      "Category:Tahu_Sumedang",
      "Category:Fried_tofu",
      "Category:Deep-fried_tofu",
      "Category:Tahu_gejrot",
    ],
    queries: [
      "Tahu goreng Indonesia",
      "Tahu sumedang",
      "Tahu isi goreng",
      "Fried tofu plate",
      "Tahu crispy goreng",
    ],
    wikiPages: {
      id: ["Tahu_goreng", "Tahu_Sumedang", "Tahu_gejrot"],
      en: ["Tahu_goreng", "Tahu_sumedang"],
    },
    positiveRe: /\b(tahu|tofu)\b/i,
    negativeRe: /\b(wajan|frying|minyak|oil|ember|bucket|batter|adonan|tempe|tempeh|raw|mentah|fresh\s*tofu|silken|curd|mapo|miso|soup|kuah|stinky|udon|ramen|salad|pakora|korean|sandwich|poutine|gulai|risoles|opor|spinach|panoramio|banyuasin|muara\s*enim|inari|sushi)\b/i,
    heroPreferRe: /\b(tahu\s*isi\s*goreng|tahu\s*goreng\s*plus|indonesia\s*tahu\s*goreng|tahu\s*isi|crispy\s*fried\s*tofu)\b/i,
    heroPenaltyRe: /\b(wajan|frying|wok|pan|bucket|oil|grease|gejrot|plastic|kocek|kripik|paris|japanese|marinated|sumedang\.jpg)\b/i,
  },
  {
    id: 9,
    name: "Gado-Gado",
    slug: "gado_gado",
    categories: ["Category:Gado-gado"],
    queries: [
      "Gado-gado Indonesia",
      "Gado gado Jakarta",
      "Gado-gado peanut sauce",
      "Indonesian gado gado salad",
      "Gado-gado siram",
      "Gado-gado komplit",
      "Gado gado lontong",
    ],
    wikiPages: {
      id: ["Gado-gado"],
      en: ["Gado-gado"],
    },
    positiveRe: /\b(gado[\s-]*gado)\b/i,
    negativeRe: /\b(pecel|ketoprak|lotek|karedok|rujak|urap|ulekan|ulek|cobek|tangan|hand|hands|spatula|mortar|tipat\s*cantok|serombotan|bumbu\s*saja|bumbu\s*gado|emping-01|sambalkacang|restaurant\s*sign)\b/i,
    heroPreferRe: /\b(gado[\s-]*gado.*(surabaya|jakarta|betawi|cuisine|ny\s*suharti|kacang|enak|01|001|02)|^gado-gado\.jpg$)\b/i,
    heroPenaltyRe: /\b(fork\s*close|bokeh|blur|ulek|minang|ecolodge|dinner|down\s*the\s*rabbit)\b/i,
  },
  {
    id: 10,
    name: "Pempek",
    slug: "pempek",
    categories: [
      "Category:Pempek",
      "Category:Pempek_kapal_selam",
      "Category:Pempek_Lenjer",
      "Category:Pempek_kulit",
      "Category:Pempek_adaan",
      "Category:Pempek_Keriting",
    ],
    queries: [
      "Pempek Palembang",
      "Pempek kapal selam",
      "Pempek lenjer cuko",
      "Empek empek Palembang",
      "Pempek cuko Indonesia",
      "Pempek kapal selam cuko",
    ],
    wikiPages: {
      id: ["Pempek"],
      en: ["Pempek"],
    },
    positiveRe: /\b(pempek|empek)\b/i,
    negativeRe: /\b(tekwan|model|laksan|celimpungan|otak[\s-]*otak|siomay|batagor|vendor|pedagang|making|adonan|dough|stamp|film|display)\b/i,
    heroPreferRe: /\b(kapal\s*selam|kuah\s*cuko|dengan\s*cuka|pempek\s*palembang|pempek\s*campur|pempek\s*&\s*cuko)\b/i,
    heroPenaltyRe: /\b(raw|uncooked|frozen|dough|keriting|tunu|tumpah|mini|pepaya|kulit\s*dan\s*pempek\s*adaan)\b/i,
  },
  {
    id: 11,
    name: "Telur Balado",
    slug: "telur_balado",
    categories: ["Category:Telur_balado", "Category:Egg_dishes_of_Indonesia", "Category:Balado"],
    queries: [
      "Telur balado",
      "Talua balado",
      "Telur bumbu bali",
      "Sambal tumis telur",
      "Telur sambal balado",
      "Sambal goreng telur",
      "Telur masak merah",
      "Egg sambal",
      "Sambal egg",
      "Sambalado telur",
      "Indonesian chili egg",
      "Sambal telur Indonesia",
    ],
    wikiPages: {
      id: ["Balado", "Telur_balado", "Sambal_tumis"],
      en: ["Balado", "Sambal"],
      ms: ["Sambal_telur"],
    },
    positiveRe: /\b(telur|talua|egg)\b/i,
    requireSecondRe: /\b(balado|sambal|bumbu\s*bali|masak\s*merah|tumis|chili|pedas|goreng|merah)\b/i,
    negativeRe: /\b(telur\s*asin|salted\s*egg|telur\s*dadar|omelette|telur\s*ceplok|sunny\s*side|seblak|ketupat\s*sayur|lontong|rice\s*bowl|nasi\s*tim|lauk-pauk|sour\s*cream|nasi\s*uduk|nasi\s*campur|nasi\s*rames|nasi\s*kuning|nasi\s*lemak|nasi\s*padang|kerupuk|terong|dendeng|ikan|jengkol|udang|kentang|teri|bubur|soto|bakso|fuyong|mie\s*telur|chicken\s*shed|airfield|bridge)\b/i,
    heroPreferRe: /\b(talua\s*balado|telur\s*balado|sambal\s*tumis\s*telur)\b/i,
    heroPenaltyRe: /\b(nasi|rice|kerupuk|mie|puyuh)\b/i,
  },
];

const PRASMANAN_HERO = {
  id: "prasmanan_kuliner",
  name: "Prasmanan Kuliner Nusantara",
  slug: "prasmanan_kuliner",
  sampleFile: "prasmanan_kuliner_real.jpg",
  categories: ["Category:Nasi_Padang", "Category:Rijsttafel", "Category:Nasi_campur", "Category:Indonesian_cuisine"],
  queries: [
    "Nasi Padang hidangan lengkap",
    "Rijsttafel Indonesian food",
    "Nasi campur mie goreng ayam",
    "Nasi rames Indonesia",
    "Prasmanan makanan Indonesia",
    "Indonesian nasi campur",
  ],
  wikiPages: {
    id: ["Masakan_Padang", "Nasi_Padang", "Nasi_campur", "Masakan_Indonesia"],
    en: ["Nasi_padang", "Rijsttafel", "Nasi_campur", "Indonesian_cuisine"],
  },
  positiveRe: /\b(nasi\s*padang|rijsttafel|nasi\s*campur|nasi\s*rames|prasmanan|hidangan|warteg|masakan\s*padang)\b/i,
  negativeRe: /\b(menu|sign|building|person|people|selfie|empty|raw|tionghoa|china|chinese|charsiu|samcan|babi|pork|tropenmuseum|collectie|officieren|pempek|bakso|black\s*and\s*white)\b/i,
  heroPreferRe: /\b(nasi\s*padang|rijsttafel|nasi\s*campur\s*(mie|ayam|sate|bali)|nasi\s*rames|javanese\s*nasi\s*campur|made's\s*warung)\b/i,
  heroPenaltyRe: /\b(tionghoa|china|bebek|sop\s*saudara|rawon)\b/i,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let lastWikimediaAt = 0;
let openverseConsecutiveFailures = 0;

async function fetchJsonPolite(url, sourceType, timeoutMs = 12000) {
  const apiCacheDir = path.join(CACHE_DIR, "api");
  fs.mkdirSync(apiCacheDir, { recursive: true });
  const cacheKey = crypto.createHash("sha1").update(url).digest("hex") + ".json";
  const cacheFile = path.join(apiCacheDir, cacheKey);
  if (fs.existsSync(cacheFile)) {
    try {
      return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    } catch {}
  }

  if (sourceType === "wikimedia") {
    const now = Date.now();
    const wait = Math.max(0, lastWikimediaAt + 700 - now);
    if (wait > 0) await sleep(wait);
    lastWikimediaAt = Date.now();
  }
  const maxAttempts = sourceType === "openverse" ? 1 : 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await resp.text();
      if (resp.status === 429 || text.includes("making too many requests")) {
        if (attempt + 1 < maxAttempts) await sleep(4000 * (attempt + 1));
        continue;
      }
      if (!resp.ok) {
        if (attempt + 1 < maxAttempts && resp.status >= 500) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        return null;
      }
      const trimmed = text.trim();
      if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
      const parsed = JSON.parse(trimmed);
      try { fs.writeFileSync(cacheFile, trimmed, "utf8"); } catch {}
      return parsed;
    } catch {
      if (attempt + 1 < maxAttempts) await sleep(700 * (attempt + 1));
    }
  }
  return null;
}

async function downloadBufferCached(url, cacheKeyHint) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const hash = crypto.createHash("sha1").update(url).digest("hex");
  const existingHit = fs.readdirSync(CACHE_DIR).find((f) => f.startsWith(`${hash}_`) && f.endsWith(".bin"));
  if (existingHit) {
    const p = path.join(CACHE_DIR, existingHit);
    if (fs.statSync(p).size >= 10000) return p;
  }
  const cachePath = path.join(CACHE_DIR, `${hash}_${cacheKeyHint.replace(/[^a-z0-9_-]/gi, "").slice(0, 24)}.bin`);
  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    if (stat.size >= 10000) return cachePath;
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (url.includes("wikimedia.org")) await sleep(220);
      const resp = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(15000),
      });
      if (resp.status === 429) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      if (!resp.ok) return null;
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length < 10000) return null;
      fs.writeFileSync(cachePath, buf);
      return cachePath;
    } catch {
      if (attempt < 2) await sleep(600 * (attempt + 1));
    }
  }
  return null;
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function passesMetadataFilter(cls, candidate) {
  const title = String(candidate.title || "");
  const lowerTitle = title.toLowerCase();
  for (const bad of BLACKLIST_TITLE_SUBSTRINGS) {
    if (lowerTitle.includes(bad)) return false;
  }
  const blob = `${title} ${candidate.description || ""} ${candidate.categories || ""} ${candidate.tags || ""}`;
  if (GLOBAL_NEGATIVE_RE.test(blob)) return false;
  if (/\b19[0-8]\d\b/.test(blob)) return false;
  if (cls.negativeRe && cls.negativeRe.test(blob)) return false;
  if (cls.requireSecondRe && !cls.requireSecondRe.test(blob)) return false;
  // Require positive keyword match on title or metadata unless directly from exact dish wiki page
  if (cls.positiveRe && !cls.positiveRe.test(blob)) {
    return false;
  }
  return true;
}

function scoreCandidateMetadata(cls, candidate) {
  const title = String(candidate.title || "");
  const blob = `${title} ${candidate.description || ""}`;
  let score = candidate.tierScore || 15;
  if (cls.positiveRe?.test(title)) score += 25;
  if (cls.requireSecondRe?.test(title)) score += 15;
  if (/\b(plate|bowl|piring|mangkuk|sambal|kacang|cuko|goreng|kuah|spesial|indonesia|nusantara)\b/i.test(blob)) {
    score += 8;
  }
  if (cls.heroPreferRe?.test(title)) score += 14;
  if (cls.heroPenaltyRe && cls.heroPenaltyRe.test(blob)) {
    score -= 24;
  }
  if (candidate.width >= 960 && candidate.height >= 540) score += 10;
  return score;
}

function extractWikimediaPages(data, tierScore, sourceLabel) {
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  const out = [];
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info) continue;
    const dlUrl = info.thumburl || info.url;
    if (!dlUrl) continue;
    const mime = String(info.mime || "").toLowerCase();
    if (!mime.includes("jpeg") && !mime.includes("jpg") && !mime.includes("png")) continue;
    const w = Number(info.thumbwidth || info.width || 0);
    const h = Number(info.thumbheight || info.height || 0);
    if (w > 0 && h > 0) {
      if (Math.min(w, h) < 480 || Math.max(w, h) < 640) continue;
      const ar = w / h;
      if (ar < 0.55 || ar > 1.95) continue;
    }
    const meta = info.extmetadata || {};
    out.push({
      title: String(p.title || "").replace(/^File:/i, ""),
      url: dlUrl,
      width: w,
      height: h,
      source: sourceLabel,
      tierScore,
      license: stripHtml(meta.LicenseShortName?.value || "Wikimedia Commons"),
      description: stripHtml(meta.ImageDescription?.value || ""),
      categories: stripHtml(meta.Categories?.value || ""),
      tags: "",
    });
  }
  return out;
}

async function harvestWikimediaCategory(catTitle) {
  const url =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      generator: "categorymembers",
      gcmtitle: catTitle,
      gcmtype: "file",
      gcmlimit: "50",
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: "1280",
      format: "json",
    });
  const data = await fetchJsonPolite(url, "wikimedia");
  return extractWikimediaPages(data, 32, `wikimedia:${catTitle}`);
}

async function harvestWikimediaSearch(query) {
  const url =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      generator: "search",
      gsrnamespace: "6",
      gsrsearch: `${query} filetype:bitmap`,
      gsrlimit: "50",
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: "1280",
      format: "json",
    });
  const data = await fetchJsonPolite(url, "wikimedia");
  return extractWikimediaPages(data, 18, "wikimedia:search");
}

async function harvestWikipediaMediaList(lang, pageTitle) {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(pageTitle)}`;
  const data = await fetchJsonPolite(url, "wikipedia", 9000);
  if (!data?.items?.length) return [];
  const fileTitles = [];
  for (const item of data.items) {
    if (item.type !== "image" || !item.title) continue;
    const t = String(item.title);
    if (!/\.(jpe?g|png)$/i.test(t)) continue;
    fileTitles.push(t.startsWith("File:") ? t : `File:${t}`);
  }
  if (!fileTitles.length) return [];
  const wmUrl =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      titles: fileTitles.slice(0, 30).join("|"),
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: "1280",
      format: "json",
    });
  const wmData = await fetchJsonPolite(wmUrl, "wikimedia");
  return extractWikimediaPages(wmData, 36, `wikipedia:${lang}:${pageTitle}`);
}

async function harvestOpenverse(query) {
  if (openverseConsecutiveFailures >= 2) return [];
  const out = [];
  for (const page of [1, 2]) {
    const url =
      "https://api.openverse.org/v1/images/?" +
      new URLSearchParams({
        q: query,
        page_size: "20",
        page: String(page),
      });
    const data = await fetchJsonPolite(url, "openverse", 3500);
    if (!data?.results) {
      openverseConsecutiveFailures++;
      if (openverseConsecutiveFailures >= 2) {
        console.log("[INFO] Openverse API unavailable/timed out; continuing with Wikimedia Commons + Wikipedia REST.");
        break;
      }
      continue;
    }
    openverseConsecutiveFailures = 0;
    for (const r of data.results) {
      if (!r.url) continue;
      const w = Number(r.width || 0);
      const h = Number(r.height || 0);
      if (w > 0 && h > 0) {
        if (Math.min(w, h) < 480 || Math.max(w, h) < 640) continue;
        const ar = w / h;
        if (ar < 0.55 || ar > 1.95) continue;
      }
      const tags = (r.tags || []).map((t) => t.name || t).join(" ");
      out.push({
        title: String(r.title || path.basename(r.url)),
        url: r.url,
        width: w,
        height: h,
        source: `openverse:${r.source || "web"}`,
        tierScore: 20,
        license: r.license ? `${r.license} ${r.license_version || ""}`.trim() : "Openverse",
        description: String(r.category || ""),
        categories: "",
        tags,
      });
    }
  }
  return out;
}

async function gatherCandidatesForClass(cls) {
  const byUrl = new Map();
  const byTitle = new Set();

  const pushHits = (hits) => {
    for (const h of hits) {
      const cleanTitle = h.title.toLowerCase().trim();
      if (byUrl.has(h.url) || byTitle.has(cleanTitle)) continue;
      if (!passesMetadataFilter(cls, h)) continue;
      byUrl.set(h.url, h);
      byTitle.add(cleanTitle);
    }
  };

  for (const lang of ["id", "en", "ms"]) {
    for (const page of cls.wikiPages?.[lang] || []) {
      pushHits(await harvestWikipediaMediaList(lang, page));
    }
  }
  for (const cat of cls.categories || []) {
    pushHits(await harvestWikimediaCategory(cat));
  }
  for (const q of cls.queries || []) {
    pushHits(await harvestWikimediaSearch(q));
    if (byUrl.size >= 140) break;
  }
  // Openverse multi-source queries
  for (const q of (cls.queries || []).slice(0, 2)) {
    pushHits(await harvestOpenverse(q));
  }

  const list = [...byUrl.values()].map((c) => ({
    ...c,
    metaScore: scoreCandidateMetadata(cls, c),
  }));
  list.sort((a, b) => b.metaScore - a.metaScore);
  return list;
}

// Persistent PowerShell .NET System.Drawing worker
function createDotNetWorker() {
  const psScriptPath = path.join(os.tmpdir(), `culinary_img_worker_${process.pid}.ps1`);
  const psCode = String.raw`
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

public static class CulinaryImageTool {
  private static ImageCodecInfo GetJpegEncoder() {
    foreach (var c in ImageCodecInfo.GetImageEncoders()) {
      if (c.MimeType == "image/jpeg") return c;
    }
    return null;
  }

  private static void SaveJpeg(Bitmap bmp, string outPath, long quality) {
    string dir = Path.GetDirectoryName(outPath);
    if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
    var enc = GetJpegEncoder();
    var ep = new EncoderParameters(1);
    ep.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);
    bmp.Save(outPath, enc, ep);
    ep.Dispose();
  }

  private static void FixExifOrientation(Image img) {
    const int propId = 0x0112;
    if (Array.IndexOf(img.PropertyIdList, propId) < 0) return;
    var prop = img.GetPropertyItem(propId);
    if (prop == null || prop.Value == null || prop.Value.Length < 2) return;
    ushort orient = BitConverter.ToUInt16(prop.Value, 0);
    RotateFlipType rft = RotateFlipType.RotateNoneFlipNone;
    switch (orient) {
      case 2: rft = RotateFlipType.RotateNoneFlipX; break;
      case 3: rft = RotateFlipType.Rotate180FlipNone; break;
      case 4: rft = RotateFlipType.Rotate180FlipX; break;
      case 5: rft = RotateFlipType.Rotate90FlipX; break;
      case 6: rft = RotateFlipType.Rotate90FlipNone; break;
      case 7: rft = RotateFlipType.Rotate270FlipX; break;
      case 8: rft = RotateFlipType.Rotate270FlipNone; break;
    }
    if (rft != RotateFlipType.RotateNoneFlipNone) {
      img.RotateFlip(rft);
    }
    try { img.RemovePropertyItem(propId); } catch {}
  }

  private static Bitmap ResizeClean(Image src, int w, int h) {
    var bmp = new Bitmap(w, h, PixelFormat.Format24bppRgb);
    using (var g = Graphics.FromImage(bmp)) {
      g.CompositingQuality = CompositingQuality.HighQuality;
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      g.SmoothingMode = SmoothingMode.HighQuality;
      g.PixelOffsetMode = PixelOffsetMode.HighQuality;
      g.DrawImage(src, 0, 0, w, h);
    }
    return bmp;
  }

  private static byte[] LockRgb(Bitmap bmp, out int stride) {
    var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
    var data = bmp.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);
    stride = Math.Abs(data.Stride);
    byte[] buf = new byte[stride * bmp.Height];
    Marshal.Copy(data.Scan0, buf, 0, buf.Length);
    bmp.UnlockBits(data);
    return buf;
  }

  private static string ComputeDHash(Image src) {
    using (var tiny = new Bitmap(9, 8, PixelFormat.Format24bppRgb)) {
      using (var g = Graphics.FromImage(tiny)) {
        g.InterpolationMode = InterpolationMode.HighQualityBilinear;
        g.DrawImage(src, 0, 0, 9, 8);
      }
      int stride;
      byte[] buf = LockRgb(tiny, out stride);
      double[,] lum = new double[8, 9];
      for (int y = 0; y < 8; y++) {
        for (int x = 0; x < 9; x++) {
          int idx = y * stride + x * 3;
          lum[y, x] = 0.299 * buf[idx + 2] + 0.587 * buf[idx + 1] + 0.114 * buf[idx];
        }
      }
      ulong hash = 0;
      int bit = 0;
      for (int y = 0; y < 8; y++) {
        for (int x = 0; x < 8; x++) {
          if (lum[y, x] > lum[y, x + 1]) {
            hash |= (1UL << bit);
          }
          bit++;
        }
      }
      return hash.ToString("x16");
    }
  }

  private static string ComputeMd5(string filePath) {
    using (var md5 = MD5.Create())
    using (var fs = File.OpenRead(filePath)) {
      byte[] hash = md5.ComputeHash(fs);
      var sb = new StringBuilder(32);
      foreach (byte b in hash) sb.Append(b.ToString("x2"));
      return sb.ToString();
    }
  }

  private static double[] EstimateSaliencyBbox(Image src) {
    int sw = 160, sh = 120;
    using (var bmp = ResizeClean(src, sw, sh)) {
      int stride;
      byte[] buf = LockRgb(bmp, out stride);
      double[,] lum = new double[sh, sw];
      double[,] R = new double[sh, sw];
      double[,] G = new double[sh, sw];
      double[,] B = new double[sh, sw];

      var borderR = new List<double>();
      var borderG = new List<double>();
      var borderB = new List<double>();
      int mX = Math.Max(4, (int)(sw * 0.06));
      int mY = Math.Max(4, (int)(sh * 0.06));

      for (int y = 0; y < sh; y++) {
        for (int x = 0; x < sw; x++) {
          int idx = y * stride + x * 3;
          double b = buf[idx], g = buf[idx + 1], r = buf[idx + 2];
          R[y, x] = r; G[y, x] = g; B[y, x] = b;
          lum[y, x] = 0.299 * r + 0.587 * g + 0.114 * b;
          if (x < mX || x >= sw - mX || y < mY || y >= sh - mY) {
            borderR.Add(r); borderG.Add(g); borderB.Add(b);
          }
        }
      }
      borderR.Sort(); borderG.Sort(); borderB.Sort();
      int mid = borderR.Count / 2;
      double bgR = borderR[mid], bgG = borderG[mid], bgB = borderB[mid];

      double[,] rawSal = new double[sh, sw];
      for (int y = 1; y < sh - 1; y++) {
        for (int x = 1; x < sw - 1; x++) {
          double dr = R[y, x] - bgR, dg = G[y, x] - bgG, db = B[y, x] - bgB;
          double colorDiff = Math.Sqrt(dr * dr + dg * dg + db * db) / 441.67;
          double gx = Math.Abs(lum[y, x + 1] - lum[y, x - 1]);
          double gy = Math.Abs(lum[y + 1, x] - lum[y - 1, x]);
          double localGrad = Math.Min(1.0, (gx + gy) / 140.0);
          double mx = Math.Max(R[y, x], Math.Max(G[y, x], B[y, x]));
          double mn = Math.Min(R[y, x], Math.Min(G[y, x], B[y, x]));
          double chroma = (mx - mn) / 255.0;
          double nx = (x / (double)(sw - 1)) - 0.5;
          double ny = (y / (double)(sh - 1)) - 0.5;
          double centerPrior = Math.Exp(-(nx * nx + ny * ny) / 0.24);
          rawSal[y, x] = (0.44 * colorDiff + 0.34 * localGrad + 0.22 * chroma) * (0.62 + 0.38 * centerPrior);
        }
      }

      // 5x5 box smooth
      double[,] sal = new double[sh, sw];
      double sum = 0, sum2 = 0;
      int cnt = sw * sh;
      for (int y = 2; y < sh - 2; y++) {
        for (int x = 2; x < sw - 2; x++) {
          double s = 0;
          for (int dy = -2; dy <= 2; dy++)
            for (int dx = -2; dx <= 2; dx++)
              s += rawSal[y + dy, x + dx];
          s /= 25.0;
          sal[y, x] = s;
          sum += s;
          sum2 += s * s;
        }
      }
      double mean = sum / cnt;
      double std = Math.Sqrt(Math.Max(0, sum2 / cnt - mean * mean));
      double thresh = mean + 0.38 * std;

      double[] rowMass = new double[sh];
      double[] colMass = new double[sw];
      double totalMass = 0;
      for (int y = 2; y < sh - 2; y++) {
        for (int x = 2; x < sw - 2; x++) {
          double v = sal[y, x] - thresh;
          if (v > 0) {
            rowMass[y] += v;
            colMass[x] += v;
            totalMass += v;
          }
        }
      }

      if (totalMass <= 1e-6) {
        return new double[] { 0.50, 0.50, 0.72, 0.70 };
      }

      // 3%..97% weighted quantiles to ignore isolated border noise while hugging the dish
      double acc = 0;
      int x1 = 2, x2 = sw - 3, y1 = 2, y2 = sh - 3;
      for (int x = 0; x < sw; x++) { acc += colMass[x]; if (acc >= totalMass * 0.03) { x1 = x; break; } }
      acc = 0;
      for (int x = sw - 1; x >= 0; x--) { acc += colMass[x]; if (acc >= totalMass * 0.03) { x2 = x; break; } }
      acc = 0;
      for (int y = 0; y < sh; y++) { acc += rowMass[y]; if (acc >= totalMass * 0.03) { y1 = y; break; } }
      acc = 0;
      for (int y = sh - 1; y >= 0; y--) { acc += rowMass[y]; if (acc >= totalMass * 0.03) { y2 = y; break; } }

      double nx1 = Math.Max(0.02, x1 / (double)sw - 0.035);
      double ny1 = Math.Max(0.02, y1 / (double)sh - 0.035);
      double nx2 = Math.Min(0.98, x2 / (double)sw + 0.035);
      double ny2 = Math.Min(0.98, y2 / (double)sh + 0.035);

      double bw = Math.Max(0.32, Math.Min(0.94, nx2 - nx1));
      double bh = Math.Max(0.32, Math.Min(0.94, ny2 - ny1));
      double cx = Math.Max(bw * 0.5 + 0.01, Math.Min(1.0 - bw * 0.5 - 0.01, (nx1 + nx2) * 0.5));
      double cy = Math.Max(bh * 0.5 + 0.01, Math.Min(1.0 - bh * 0.5 - 0.01, (ny1 + ny2) * 0.5));
      return new double[] { Math.Round(cx, 6), Math.Round(cy, 6), Math.Round(bw, 6), Math.Round(bh, 6) };
    }
  }

  public static string AnalyzeAndSave(string inPath, string outDatasetPath, int maxDatasetSide, int quality, string heroOutPath) {
    try {
      byte[] rawBytes = File.ReadAllBytes(inPath);
      using (var ms = new MemoryStream(rawBytes))
      using (var img = Image.FromStream(ms, true, true)) {
        FixExifOrientation(img);
        int ow = img.Width, oh = img.Height;
        int minSide = Math.Min(ow, oh);
        int maxSide = Math.Max(ow, oh);
        double aspect = ow / (double)oh;
        if (minSide < 480 || maxSide < 640 || aspect < 0.55 || aspect > 1.95) {
          return "{\"ok\":false,\"reason\":\"dim_or_aspect\"}";
        }

        double meanL = 0, stdL = 0, meanGrad = 0, centerGrad = 0, colorfulness = 0, whiteRatio = 0, darkRatio = 0;
        using (var probe = ResizeClean(img, 320, 240)) {
          int stride;
          byte[] buf = LockRgb(probe, out stride);
          double[,] lum = new double[240, 320];
          double sumL = 0, sumL2 = 0, sumCol = 0;
          int whiteCnt = 0, darkCnt = 0;
          for (int y = 0; y < 240; y++) {
            for (int x = 0; x < 320; x++) {
              int idx = y * stride + x * 3;
              double b = buf[idx], g = buf[idx + 1], r = buf[idx + 2];
              double l = 0.299 * r + 0.587 * g + 0.114 * b;
              lum[y, x] = l;
              sumL += l; sumL2 += l * l;
              sumCol += Math.Abs(r - g) + Math.Abs(0.5 * (r + g) - b);
              if (r > 246 && g > 246 && b > 246) whiteCnt++;
              if (r < 12 && g < 12 && b < 12) darkCnt++;
            }
          }
          int n = 320 * 240;
          meanL = sumL / n;
          stdL = Math.Sqrt(Math.Max(0, sumL2 / n - meanL * meanL));
          colorfulness = sumCol / n;
          whiteRatio = whiteCnt / (double)n;
          darkRatio = darkCnt / (double)n;

          double gAll = 0, gCenter = 0;
          int cAll = 0, cCenter = 0;
          for (int y = 1; y < 239; y++) {
            for (int x = 1; x < 319; x++) {
              double gx = Math.Abs(lum[y, x + 1] - lum[y, x - 1]);
              double gy = Math.Abs(lum[y + 1, x] - lum[y - 1, x]);
              double gm = Math.Sqrt(gx * gx + gy * gy);
              gAll += gm; cAll++;
              if (x >= 70 && x <= 250 && y >= 52 && y <= 188) {
                gCenter += gm; cCenter++;
              }
            }
          }
          meanGrad = gAll / cAll;
          centerGrad = gCenter / cCenter;
        }

        // Native-resolution center crop sharpness to reject bokeh/blur/soft upscales
        double nativeCenterGrad = 0;
        int cw = Math.Min(320, ow), ch = Math.Min(240, oh);
        using (var natCrop = new Bitmap(cw, ch, PixelFormat.Format24bppRgb)) {
          using (var g = Graphics.FromImage(natCrop)) {
            g.DrawImage(img, new Rectangle(0, 0, cw, ch), new Rectangle((ow - cw) / 2, (oh - ch) / 2, cw, ch), GraphicsUnit.Pixel);
          }
          int stride;
          byte[] buf = LockRgb(natCrop, out stride);
          double[,] lum = new double[ch, cw];
          for (int y = 0; y < ch; y++) {
            for (int x = 0; x < cw; x++) {
              int idx = y * stride + x * 3;
              lum[y, x] = 0.299 * buf[idx + 2] + 0.587 * buf[idx + 1] + 0.114 * buf[idx];
            }
          }
          double gSum = 0; int gCnt = 0;
          for (int y = 1; y < ch - 1; y++) {
            for (int x = 1; x < cw - 1; x++) {
              double gx = Math.Abs(lum[y, x + 1] - lum[y, x - 1]);
              double gy = Math.Abs(lum[y + 1, x] - lum[y - 1, x]);
              gSum += Math.Sqrt(gx * gx + gy * gy);
              gCnt++;
            }
          }
          nativeCenterGrad = gSum / Math.Max(1, gCnt);
        }

        if (meanL < 38 || meanL > 228 || stdL < 22 || meanGrad < 10.5 || centerGrad < 11.5 || nativeCenterGrad < 4.5 || colorfulness < 11.0 || whiteRatio > 0.52 || darkRatio > 0.55) {
          return string.Format(System.Globalization.CultureInfo.InvariantCulture,
            "{{\"ok\":false,\"reason\":\"quality\",\"meanL\":{0},\"stdL\":{1},\"grad\":{2},\"cGrad\":{3},\"natGrad\":{4},\"col\":{5} }}",
            Math.Round(meanL, 1), Math.Round(stdL, 1), Math.Round(meanGrad, 1), Math.Round(centerGrad, 1), Math.Round(nativeCenterGrad, 1), Math.Round(colorfulness, 1));
        }

        double[] bbox = EstimateSaliencyBbox(img);

        // Dataset target size: keep minSide >= 480 & maxSide >= 640, cap maxSide <= maxDatasetSide
        double scale = 1.0;
        if (maxSide > maxDatasetSide) {
          scale = maxDatasetSide / (double)maxSide;
          if (minSide * scale < 480.0) scale = 480.0 / minSide;
          if (maxSide * scale < 640.0) scale = Math.Max(scale, 640.0 / maxSide);
          scale = Math.Min(1.0, scale);
        }
        int dw = Math.Max(480, (int)Math.Round(ow * scale));
        int dh = Math.Max(480, (int)Math.Round(oh * scale));
        if (Math.Max(dw, dh) < 640) {
          if (dw >= dh) dw = 640; else dh = 640;
        }

        using (var dsBmp = ResizeClean(img, dw, dh)) {
          SaveJpeg(dsBmp, outDatasetPath, quality);
          long len = new FileInfo(outDatasetPath).Length;
          if (len < 35840) {
            SaveJpeg(dsBmp, outDatasetPath, 96);
            len = new FileInfo(outDatasetPath).Length;
          }
          if (len < 35840) {
            try { File.Delete(outDatasetPath); } catch {}
            return "{\"ok\":false,\"reason\":\"small_bytes\"}";
          }
        }
        string dhash;
        using (var savedImg = Image.FromFile(outDatasetPath)) {
          dhash = ComputeDHash(savedImg);
        }
        string md5 = ComputeMd5(outDatasetPath);
        long dsBytes = new FileInfo(outDatasetPath).Length;

        int heroW = 0, heroH = 0;
        long heroBytes = 0;
        if (!string.IsNullOrEmpty(heroOutPath) && ow >= 960 && minSide >= 540) {
          double hScale = ow > 1280 ? (1280.0 / ow) : 1.0;
          if (ow * hScale < 960.0) hScale = 960.0 / ow;
          heroW = (int)Math.Round(ow * hScale);
          heroH = (int)Math.Round(oh * hScale);
          using (var hBmp = ResizeClean(img, heroW, heroH)) {
            SaveJpeg(hBmp, heroOutPath, 95);
            heroBytes = new FileInfo(heroOutPath).Length;
          }
        }

        return string.Format(System.Globalization.CultureInfo.InvariantCulture,
          "{{\"ok\":true,\"origW\":{0},\"origH\":{1},\"dsW\":{2},\"dsH\":{3},\"dsBytes\":{4},\"md5\":\"{5}\",\"dhash\":\"{6}\",\"meanL\":{7},\"stdL\":{8},\"grad\":{9},\"cGrad\":{10},\"natGrad\":{11},\"col\":{12},\"bbox\":[{13},{14},{15},{16}],\"heroW\":{17},\"heroH\":{18},\"heroBytes\":{19} }}",
          ow, oh, dw, dh, dsBytes, md5, dhash, Math.Round(meanL, 1), Math.Round(stdL, 1), Math.Round(meanGrad, 1), Math.Round(centerGrad, 1), Math.Round(nativeCenterGrad, 1), Math.Round(colorfulness, 1),
          bbox[0], bbox[1], bbox[2], bbox[3], heroW, heroH, heroBytes);
      }
    } catch (Exception ex) {
      return "{\"ok\":false,\"reason\":\"decode_err\",\"msg\":\"" + ex.Message.Replace("\"", "'").Replace("\\", "/") + "\"}";
    }
  }

  private static byte ClampByte(double v) {
    if (v < 0) return 0;
    if (v > 255) return 255;
    return (byte)Math.Round(v);
  }

  public static string AugmentTrainImage(string srcPath, string dstPath, string mode, double cx, double cy, double bw, double bh) {
    try {
      using (var srcImg = Image.FromFile(srcPath)) {
        int W = srcImg.Width, H = srcImg.Height;
        using (var work = new Bitmap(srcImg)) {
          bool doFlip = mode.Contains("hflip");
          if (doFlip) {
            work.RotateFlip(RotateFlipType.RotateNoneFlipX);
            cx = 1.0 - cx;
          }

          double cropX = 0.0, cropY = 0.0, cropS = 1.0;
          if (mode.Contains("crop88_tl")) { cropX = 0.02; cropY = 0.02; cropS = 0.88; }
          else if (mode.Contains("crop88_br")) { cropX = 0.10; cropY = 0.10; cropS = 0.88; }
          else if (mode.Contains("crop88_mid")) { cropX = 0.06; cropY = 0.05; cropS = 0.88; }
          else if (mode.Contains("crop86_tr")) { cropX = 0.11; cropY = 0.03; cropS = 0.86; }
          else if (mode.Contains("crop86_bl")) { cropX = 0.03; cropY = 0.11; cropS = 0.86; }
          else if (mode.Contains("crop86_tl")) { cropX = 0.02; cropY = 0.02; cropS = 0.86; }
          else if (mode.Contains("crop86_br")) { cropX = 0.12; cropY = 0.12; cropS = 0.86; }
          else if (mode.Contains("crop84_center")) { cropX = 0.08; cropY = 0.08; cropS = 0.84; }
          else if (mode.Contains("crop80_tl")) { cropX = 0.01; cropY = 0.02; cropS = 0.80; }
          else if (mode.Contains("crop80_br")) { cropX = 0.18; cropY = 0.18; cropS = 0.80; }
          else if (mode.Contains("crop80_tr")) { cropX = 0.17; cropY = 0.02; cropS = 0.80; }
          else if (mode.Contains("crop80_bl")) { cropX = 0.02; cropY = 0.17; cropS = 0.80; }
          else if (mode.Contains("crop84")) { cropX = 0.08; cropY = 0.08; cropS = 0.84; }

          double rotDeg = 0.0;
          float rotZoom = 1.18f;
          if (mode.Contains("rot7p")) { rotDeg = 7.0; rotZoom = 1.24f; }
          else if (mode.Contains("rot7n")) { rotDeg = -7.0; rotZoom = 1.24f; }
          else if (mode.Contains("rot4p")) { rotDeg = 4.0; rotZoom = 1.18f; }
          else if (mode.Contains("rot4n")) { rotDeg = -4.0; rotZoom = 1.18f; }

          var outBmp = new Bitmap(W, H, PixelFormat.Format24bppRgb);
          using (var g = Graphics.FromImage(outBmp)) {
            g.CompositingQuality = CompositingQuality.HighQuality;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.SmoothingMode = SmoothingMode.HighQuality;
            if (Math.Abs(rotDeg) > 0.1) {
              // Clean tilt zoomed so zero corner borders appear
              g.TranslateTransform(W * 0.5f, H * 0.5f);
              g.RotateTransform((float)rotDeg);
              g.ScaleTransform(rotZoom, rotZoom);
              g.TranslateTransform(-W * 0.5f, -H * 0.5f);
              g.DrawImage(work, new Rectangle(0, 0, W, H), new Rectangle(0, 0, W, H), GraphicsUnit.Pixel);
            } else {
              Rectangle srcRect = new Rectangle(
                (int)Math.Round(cropX * W),
                (int)Math.Round(cropY * H),
                Math.Max(1, (int)Math.Round(cropS * W)),
                Math.Max(1, (int)Math.Round(cropS * H))
              );
              g.DrawImage(work, new Rectangle(0, 0, W, H), srcRect, GraphicsUnit.Pixel);
            }
          }

          if (Math.Abs(rotDeg) > 0.1) {
            bw = Math.Min(0.95, bw * 1.08);
            bh = Math.Min(0.95, bh * 1.08);
            cx = Math.Max(bw * 0.5 + 0.01, Math.Min(1.0 - bw * 0.5 - 0.01, cx));
            cy = Math.Max(bh * 0.5 + 0.01, Math.Min(1.0 - bh * 0.5 - 0.01, cy));
          } else if (cropS < 0.999) {
            double x1 = Math.Max(cropX, cx - bw * 0.5);
            double y1 = Math.Max(cropY, cy - bh * 0.5);
            double x2 = Math.Min(cropX + cropS, cx + bw * 0.5);
            double y2 = Math.Min(cropY + cropS, cy + bh * 0.5);
            double nx1 = Math.Max(0.01, (x1 - cropX) / cropS);
            double ny1 = Math.Max(0.01, (y1 - cropY) / cropS);
            double nx2 = Math.Min(0.99, (x2 - cropX) / cropS);
            double ny2 = Math.Min(0.99, (y2 - cropY) / cropS);
            bw = Math.Max(0.28, Math.Min(0.95, nx2 - nx1));
            bh = Math.Max(0.28, Math.Min(0.95, ny2 - ny1));
            cx = Math.Max(bw * 0.5 + 0.01, Math.Min(1.0 - bw * 0.5 - 0.01, (nx1 + nx2) * 0.5));
            cy = Math.Max(bh * 0.5 + 0.01, Math.Min(1.0 - bh * 0.5 - 0.01, (ny1 + ny2) * 0.5));
          }

          // Gentle warmth / gamma 0.94..1.06 (sharp photorealistic)
          double gamma = 1.0, rMul = 1.0, bMul = 1.0, contrast = 1.02;
          if (mode.Contains("warm")) { gamma = 0.95; rMul = 1.03; bMul = 0.97; }
          else if (mode.Contains("cool")) { gamma = 1.05; rMul = 0.98; bMul = 1.03; }
          else { gamma = 0.97; rMul = 1.02; bMul = 0.98; }

          byte[] lutR = new byte[256], lutG = new byte[256], lutB = new byte[256];
          for (int i = 0; i < 256; i++) {
            double v = Math.Pow(i / 255.0, gamma);
            v = ((v - 0.5) * contrast + 0.5) * 255.0;
            lutR[i] = ClampByte(v * rMul);
            lutG[i] = ClampByte(v);
            lutB[i] = ClampByte(v * bMul);
          }

          var rect = new Rectangle(0, 0, W, H);
          var data = outBmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format24bppRgb);
          int stride = Math.Abs(data.Stride);
          byte[] buf = new byte[stride * H];
          Marshal.Copy(data.Scan0, buf, 0, buf.Length);
          for (int y = 0; y < H; y++) {
            int row = y * stride;
            for (int x = 0; x < W; x++) {
              int idx = row + x * 3;
              buf[idx] = lutB[buf[idx]];
              buf[idx + 1] = lutG[buf[idx + 1]];
              buf[idx + 2] = lutR[buf[idx + 2]];
            }
          }
          Marshal.Copy(buf, 0, data.Scan0, buf.Length);
          outBmp.UnlockBits(data);

          SaveJpeg(outBmp, dstPath, 95);
          outBmp.Dispose();
          string dhash;
          using (var savedAugImg = Image.FromFile(dstPath)) {
            dhash = ComputeDHash(savedAugImg);
          }
          long bytes = new FileInfo(dstPath).Length;
          string md5 = ComputeMd5(dstPath);

          return string.Format(System.Globalization.CultureInfo.InvariantCulture,
            "{{\"ok\":true,\"w\":{0},\"h\":{1},\"bytes\":{2},\"md5\":\"{3}\",\"dhash\":\"{4}\",\"bbox\":[{5},{6},{7},{8}]}}",
            W, H, bytes, md5, dhash, Math.Round(cx, 6), Math.Round(cy, 6), Math.Round(bw, 6), Math.Round(bh, 6));
        }
      }
    } catch (Exception ex) {
      return "{\"ok\":false,\"msg\":\"" + ex.Message.Replace("\"", "'").Replace("\\", "/") + "\"}";
    }
  }

  public static string RenderContactSheet(string manifestLines, string outPngPath, int cols) {
    try {
      string[] rows = manifestLines.Split(new[] { "||" }, StringSplitOptions.RemoveEmptyEntries);
      int count = rows.Length;
      if (count == 0) return "{\"ok\":false}";
      int rowsN = (int)Math.Ceiling(count / (double)cols);
      int tileW = 420, tileH = 310, pad = 16;
      int W = cols * tileW + (cols + 1) * pad;
      int H = rowsN * tileH + (rowsN + 1) * pad + 42;

      string dir = Path.GetDirectoryName(outPngPath);
      if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

      using (var canvas = new Bitmap(W, H, PixelFormat.Format24bppRgb))
      using (var g = Graphics.FromImage(canvas)) {
        g.Clear(Color.FromArgb(245, 243, 238));
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        using (var titleFont = new Font("Segoe UI", 14, FontStyle.Bold))
        using (var labelFont = new Font("Segoe UI", 10, FontStyle.Bold))
        using (var subFont = new Font("Segoe UI", 8.5f, FontStyle.Regular))
        using (var boxPen = new Pen(Color.FromArgb(22, 163, 74), 2.5f))
        using (var cardPen = new Pen(Color.FromArgb(210, 205, 196), 1.0f)) {
          g.DrawString("NusantaraVision YOLOv11 - Visual QA Contact Sheet (Heroes + Saliency BBox)", titleFont, Brushes.Black, pad, 10);
          for (int i = 0; i < count; i++) {
            string[] parts = rows[i].Split('|');
            string imgPath = parts[0];
            string label = parts.Length > 1 ? parts[1] : "";
            string sub = parts.Length > 2 ? parts[2] : "";
            double cx = parts.Length > 3 ? double.Parse(parts[3], System.Globalization.CultureInfo.InvariantCulture) : 0.5;
            double cy = parts.Length > 4 ? double.Parse(parts[4], System.Globalization.CultureInfo.InvariantCulture) : 0.5;
            double bw = parts.Length > 5 ? double.Parse(parts[5], System.Globalization.CultureInfo.InvariantCulture) : 0.7;
            double bh = parts.Length > 6 ? double.Parse(parts[6], System.Globalization.CultureInfo.InvariantCulture) : 0.7;

            int r = i / cols, c = i % cols;
            int tx = pad + c * (tileW + pad);
            int ty = 42 + pad + r * (tileH + pad);
            g.FillRectangle(Brushes.White, tx, ty, tileW, tileH);
            g.DrawRectangle(cardPen, tx, ty, tileW, tileH);

            int imgBoxH = tileH - 46;
            if (File.Exists(imgPath)) {
              using (var im = Image.FromFile(imgPath)) {
                double sc = Math.Min((tileW - 12) / (double)im.Width, (imgBoxH - 8) / (double)im.Height);
                int dw = (int)(im.Width * sc), dh = (int)(im.Height * sc);
                int dx = tx + (tileW - dw) / 2, dy = ty + 6 + (imgBoxH - dh) / 2;
                g.DrawImage(im, dx, dy, dw, dh);
                float bx = (float)(dx + (cx - bw * 0.5) * dw);
                float by = (float)(dy + (cy - bh * 0.5) * dh);
                g.DrawRectangle(boxPen, bx, by, (float)(bw * dw), (float)(bh * dh));
              }
            }
            g.DrawString(label, labelFont, Brushes.Black, tx + 8, ty + tileH - 40);
            g.DrawString(sub, subFont, Brushes.DimGray, tx + 8, ty + tileH - 20);
          }
        }
        canvas.Save(outPngPath, ImageFormat.Png);
      }
      return "{\"ok\":true}";
    } catch (Exception ex) {
      return "{\"ok\":false,\"msg\":\"" + ex.Message.Replace("\"", "'").Replace("\\", "/") + "\"}";
    }
  }
}
'@
Write-Output "__READY__"
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line -or $line -eq "__EXIT__") { break }
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $parts = $line.Split([char]9)
  $cmd = $parts[0]
  if ($cmd -eq "analyze") {
    Write-Output ([CulinaryImageTool]::AnalyzeAndSave($parts[1], $parts[2], [int]$parts[3], [int]$parts[4], $parts[5]))
  } elseif ($cmd -eq "augment") {
    Write-Output ([CulinaryImageTool]::AugmentTrainImage($parts[1], $parts[2], $parts[3], [double]$parts[4], [double]$parts[5], [double]$parts[6], [double]$parts[7]))
  } elseif ($cmd -eq "contact") {
    Write-Output ([CulinaryImageTool]::RenderContactSheet($parts[1], $parts[2], [int]$parts[3]))
  }
}
`;
  fs.writeFileSync(psScriptPath, psCode, "utf8");

  const proc = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psScriptPath], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdoutBuf = "";
  const waiters = [];
  proc.stdout.on("data", (chunk) => {
    stdoutBuf += chunk.toString("utf8");
    let nl;
    while ((nl = stdoutBuf.indexOf("\n")) !== -1) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (line && waiters.length > 0) {
        const resolve = waiters.shift();
        resolve(line);
      }
    }
  });
  proc.stderr.on("data", (chunk) => {
    const msg = chunk.toString("utf8").trim();
    if (msg) console.error("[PS-ERR]", msg);
  });

  const nextLine = () =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("PowerShell worker timeout")), 30000);
      waiters.push((val) => {
        clearTimeout(timer);
        resolve(val);
      });
    });

  return {
    async init() {
      const ready = await nextLine();
      if (ready !== "__READY__") throw new Error(`Worker failed init: ${ready}`);
    },
    async call(tsvCommand) {
      proc.stdin.write(tsvCommand.replace(/[\r\n]+/g, " ") + "\n");
      const raw = await nextLine();
      return JSON.parse(raw);
    },
    async close() {
      try {
        proc.stdin.write("__EXIT__\n");
        proc.stdin.end();
      } catch {}
      try {
        fs.unlinkSync(psScriptPath);
      } catch {}
    },
  };
}

function hammingHex64(hexA, hexB) {
  let x = BigInt("0x" + hexA) ^ BigInt("0x" + hexB);
  let dist = 0;
  while (x > 0n) {
    x &= x - 1n;
    dist++;
  }
  return dist;
}

function isNearDuplicate(dhash, existingDhashes, maxDist = 8) {
  for (const h of existingDhashes) {
    if (hammingHex64(dhash, h) <= maxDist) return true;
  }
  return false;
}

function cleanDatasetDir() {
  if (fs.existsSync(DATASET_DIR)) {
    fs.rmSync(DATASET_DIR, { recursive: true, force: true });
  }
  for (const split of ["train", "valid", "test"]) {
    fs.mkdirSync(path.join(DATASET_DIR, split, "images"), { recursive: true });
    fs.mkdirSync(path.join(DATASET_DIR, split, "labels"), { recursive: true });
  }
  fs.mkdirSync(SAMPLES_IMG_DIR, { recursive: true });
}

function writeYamlAndReadme(stats, perClassStats) {
  const namesYaml = CLASSES.map((c) => `  ${c.id}: ${c.name}`).join("\n");
  const yaml = [
    "# Dataset Kuliner Umum Indonesia — Format YOLOv11",
    "# Sumber gambar: Multi-sumber terverifikasi (Wikimedia Commons, Wikipedia REST, Openverse)",
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

  const lines = [
    "# Dataset Kuliner Umum Indonesia (YOLOv11 Format)",
    "",
    `Total images: ${stats.total} images across ${CLASSES.length} classes (50 per class).`,
    `- Train : ${stats.train} images (70% = 35/class; ${stats.trainOriginals} unique originals + ${stats.trainAugmented} photorealistic train-only augmentations)`,
    `- Valid : ${stats.valid} images (20% = 10/class; 100% unique originals, ZERO augmentation, ZERO leakage)`,
    `- Test  : ${stats.test} images (10% = 5/class; 100% unique originals, ZERO augmentation, ZERO leakage)`,
    `- Unique Original Photographs Total: ${stats.uniqueOriginals}`,
    "",
    "Quality & Deduplication Guarantees:",
    "- Every image decoded & EXIF-normalized with .NET System.Drawing (min side >= 480px, max side >= 640px, aspect 0.55..1.95, >= 35 KB).",
    "- Sharpness, luminance, exposure, colorfulness, and native center-crop edge gradient checked on every image.",
    "- Exact MD5 + 64-bit dHash perceptual deduplication enforced across ALL classes and splits.",
    "- Zero Data Leakage: unique originals are split into train/valid/test FIRST before generating sharp train-only augmentations (horizontal flip, clean 86-88% crop zoom, gentle warmth/gamma 0.94..1.06, JPEG quality 95).",
    "- Labels in dataset/*/labels/*.txt use per-image food saliency bounding box estimation (NOT blind hardcoded boxes).",
    "",
    "Per-Class Honest Breakdown:",
    "Class           | Unique Originals | Train Orig | Train Aug | Train Total | Valid (Orig) | Test (Orig) | Total",
    "----------------+------------------+------------+-----------+-------------+--------------+-------------+------",
  ];

  for (const c of CLASSES) {
    const p = perClassStats[c.name];
    lines.push(
      `${c.name.padEnd(15)} | ${String(p.uniqueOriginals).padStart(16)} | ${String(p.trainOriginals).padStart(10)} | ${String(p.trainAugmented).padStart(9)} | ${String(p.trainTotal).padStart(11)} | ${String(p.validTotal).padStart(12)} | ${String(p.testTotal).padStart(11)} | ${String(p.total).padStart(5)}`
    );
  }
  lines.push("");
  fs.writeFileSync(path.join(DATASET_DIR, "README.dataset.txt"), lines.join("\n"), "utf8");
}

async function main() {
  console.log("=== Overhaul Dataset & Hero Samples Kuliner Indonesia (YOLOv11) ===");
  cleanDatasetDir();
  const stageDir = path.join(CACHE_DIR, "staging");
  if (fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });

  const worker = createDotNetWorker();
  await worker.init();
  console.log("[OK] .NET System.Drawing image analysis worker ready.");

  const globalMd5 = new Set();
  const globalDhashes = [];
  const allManifestRecords = [];
  const sampleManifest = [];
  const perClassStats = {};

  let totalTrainOrig = 0;
  let totalTrainAug = 0;
  let totalUniqueOriginals = 0;

  try {
    for (const cls of CLASSES) {
      console.log(`\n[CLASS ${cls.id}] ${cls.name} — harvesting multi-source candidates...`);
      const candidates = await gatherCandidatesForClass(cls);
      console.log(`  Filtered candidates: ${candidates.length}`);

      const verifiedOriginals = [];
      for (const cand of candidates) {
        if (verifiedOriginals.length >= MAX_ORIGINALS_PER_CLASS) break;
        const rawPath = await downloadBufferCached(cand.url, `${cls.slug}_${verifiedOriginals.length}`);
        if (!rawPath) continue;

        const stagedImgPath = path.join(stageDir, `${cls.slug}_cand_${verifiedOriginals.length}.jpg`);
        const heroTempPath = path.join(stageDir, `${cls.slug}_hero_${verifiedOriginals.length}.jpg`);
        const res = await worker.call(`analyze\t${rawPath}\t${stagedImgPath}\t${MAX_DATASET_SIDE}\t90\t${heroTempPath}`);
        if (!res?.ok) {
          try { fs.unlinkSync(stagedImgPath); } catch {}
          try { fs.unlinkSync(heroTempPath); } catch {}
          continue;
        }
        if (globalMd5.has(res.md5) || isNearDuplicate(res.dhash, globalDhashes, 9)) {
          try { fs.unlinkSync(stagedImgPath); } catch {}
          try { fs.unlinkSync(heroTempPath); } catch {}
          continue;
        }

        globalMd5.add(res.md5);
        globalDhashes.push(res.dhash);

        const aspect = res.origW / res.origH;
        const heroAspectBonus = aspect >= 1.1 && aspect <= 1.85 ? 25 : aspect >= 0.85 ? 10 : -15;
        const heroQualityBonus = Math.min(25, res.cGrad * 0.65) + (res.heroBytes > 0 ? 30 : -100);
        const heroBlob = `${cand.title || ""} ${cand.description || ""}`;
        const heroPrefBonus =
          (cls.heroPreferRe?.test(cand.title || "") ? 42 : cls.heroPreferRe?.test(heroBlob) ? 20 : 0) -
          (cls.heroPenaltyRe?.test(heroBlob) ? 48 : 0);
        const heroScore = cand.metaScore + heroAspectBonus + heroQualityBonus + heroPrefBonus;

        verifiedOriginals.push({
          ...cand,
          stagedImgPath,
          heroTempPath: res.heroBytes > 0 ? heroTempPath : null,
          origW: res.origW,
          origH: res.origH,
          dsW: res.dsW,
          dsH: res.dsH,
          dsBytes: res.dsBytes,
          heroW: res.heroW,
          heroH: res.heroH,
          heroBytes: res.heroBytes,
          md5: res.md5,
          dhash: res.dhash,
          meanL: res.meanL,
          stdL: res.stdL,
          grad: res.grad,
          cGrad: res.cGrad,
          natGrad: res.natGrad,
          col: res.col,
          bbox: res.bbox,
          heroScore,
          overallScore: cand.metaScore + Math.min(25, res.cGrad * 0.6),
        });
      }

      console.log(`  Verified unique sharp originals: ${verifiedOriginals.length}`);
      if (verifiedOriginals.length < TARGET_VALID_PER_CLASS + TARGET_TEST_PER_CLASS + 1) {
        throw new Error(`Insufficient verified originals for ${cls.name}: got ${verifiedOriginals.length}, need >= 16`);
      }

      // Select best >=960px hero photo for samples/images/<slug>_real.jpg
      const sortedForHero = [...verifiedOriginals].sort((a, b) => b.heroScore - a.heroScore);
      const bestHero = sortedForHero[0];
      if (!bestHero || !bestHero.heroTempPath) {
        throw new Error(`No >=960px hero photo found for ${cls.name}`);
      }
      const heroDestPath = path.join(SAMPLES_IMG_DIR, `${cls.slug}_real.jpg`);
      fs.copyFileSync(bestHero.heroTempPath, heroDestPath);
      const [hcx, hcy, hbw, hbh] = bestHero.bbox;
      sampleManifest.push({
        classId: cls.id,
        name: cls.name,
        slug: cls.slug,
        sampleFile: `${cls.slug}_real.jpg`,
        bytes: bestHero.heroBytes,
        width: bestHero.heroW,
        height: bestHero.heroH,
        aspectRatio: Number((bestHero.heroW / bestHero.heroH).toFixed(4)),
        bbox_yolo: bestHero.bbox,
        bbox_xyxy: [
          Math.max(0, Math.round((hcx - hbw * 0.5) * bestHero.heroW)),
          Math.max(0, Math.round((hcy - hbh * 0.5) * bestHero.heroH)),
          Math.min(bestHero.heroW, Math.round((hcx + hbw * 0.5) * bestHero.heroW)),
          Math.min(bestHero.heroH, Math.round((hcy + hbh * 0.5) * bestHero.heroH)),
        ],
        sharpnessGrad: bestHero.grad,
        centerGrad: bestHero.cGrad,
        meanLuminance: bestHero.meanL,
        md5: bestHero.md5,
        dhash: bestHero.dhash,
        source: bestHero.source,
        sourceTitle: bestHero.title,
        sourceUrl: bestHero.url,
        license: bestHero.license,
      });

      // ZERO-LEAKAGE SPLIT BEFORE AUGMENTATION
      // Sort by overallScore descending and stratify deterministically across valid/test/train
      const ranked = [...verifiedOriginals].sort((a, b) => b.overallScore - a.overallScore);
      const validSet = [];
      const testSet = [];
      const trainOrigSet = [];

      // Interleave top items fairly so valid (10) & test (5) are 100% pure unique originals
      for (let i = 0; i < ranked.length; i++) {
        if (testSet.length < TARGET_TEST_PER_CLASS && i % 5 === 2) {
          testSet.push(ranked[i]);
        } else if (validSet.length < TARGET_VALID_PER_CLASS && (i % 3 === 1 || validSet.length + trainOrigSet.length + testSet.length >= ranked.length - (TARGET_VALID_PER_CLASS - validSet.length))) {
          validSet.push(ranked[i]);
        } else {
          trainOrigSet.push(ranked[i]);
        }
      }
      // Guarantee exact valid=10 & test=5 even for small U
      while (testSet.length < TARGET_TEST_PER_CLASS) {
        testSet.push(trainOrigSet.pop());
      }
      while (validSet.length < TARGET_VALID_PER_CLASS) {
        validSet.push(trainOrigSet.pop());
      }
      // Keep at most 35 originals in train if > 50 (though capped at 50)
      const trimmedTrainOrig = trainOrigSet.slice(0, TARGET_TRAIN_PER_CLASS);

      const writeDatasetEntry = (split, idx, item, isAugmented, augMode = null) => {
        const baseName = `${cls.slug}_${String(idx + 1).padStart(2, "0")}`;
        const imgDest = path.join(DATASET_DIR, split, "images", `${baseName}.jpg`);
        const lblDest = path.join(DATASET_DIR, split, "labels", `${baseName}.txt`);
        fs.copyFileSync(item.stagedImgPath, imgDest);
        const [cx, cy, bw, bh] = item.bbox;
        fs.writeFileSync(
          lblDest,
          `${cls.id} ${cx.toFixed(6)} ${cy.toFixed(6)} ${bw.toFixed(6)} ${bh.toFixed(6)}\n`,
          "utf8"
        );
        allManifestRecords.push({
          split,
          filename: `${baseName}.jpg`,
          classId: cls.id,
          className: cls.name,
          slug: cls.slug,
          isAugmented,
          augMode,
          width: item.dsW,
          height: item.dsH,
          bytes: item.dsBytes,
          md5: item.md5,
          dhash: item.dhash,
          bbox: item.bbox,
          source: item.source,
          sourceTitle: item.title,
        });
      };

      validSet.forEach((item, i) => writeDatasetEntry("valid", i, item, false));
      testSet.forEach((item, i) => writeDatasetEntry("test", i, item, false));
      trimmedTrainOrig.forEach((item, i) => writeDatasetEntry("train", i, item, false));

      // Train-only photorealistic sharp augmentation if trimmedTrainOrig.length < 35
      const augModes = [
        "hflip_warm",
        "rot7p_crop84_warm",
        "rot7n_crop84_cool",
        "crop80_tl_cool",
        "crop80_br_warm",
        "hflip_crop80_tr_warm",
        "hflip_crop80_bl_cool",
        "hflip_rot7p_crop84_warm",
        "hflip_rot7n_crop84_cool",
        "crop88_tl_warm",
        "crop88_br_cool",
        "hflip_crop88_mid_warm",
        "crop86_tr_warm",
        "hflip_crop86_bl_cool",
        "rot4p_crop84_warm",
        "rot4n_crop84_cool",
        "hflip_rot4p_crop84_warm",
        "hflip_rot4n_crop84_cool",
        "crop84_center_warm",
        "hflip_cool",
        "hflip_crop86_tl_cool",
        "hflip_crop86_br_warm",
      ];
      const crossClassOrValTestDhashes = [
        ...allManifestRecords.filter((r) => r.classId !== cls.id).map((r) => r.dhash),
        ...validSet.map((x) => x.dhash),
        ...testSet.map((x) => x.dhash),
      ];
      const sameClassTrainDhashes = trimmedTrainOrig.map((x) => x.dhash);
      let augCount = 0;
      let cursor = 0;
      while (trimmedTrainOrig.length + augCount < TARGET_TRAIN_PER_CLASS) {
        const src = trimmedTrainOrig[cursor % trimmedTrainOrig.length];
        const modeIdx = Math.floor(cursor / trimmedTrainOrig.length) % augModes.length;
        const mode = augModes[modeIdx];
        cursor++;
        if (cursor > 500) throw new Error(`Augmentation loop exceeded safe limit for ${cls.name}`);

        const idx = trimmedTrainOrig.length + augCount;
        const baseName = `${cls.slug}_${String(idx + 1).padStart(2, "0")}`;
        const imgDest = path.join(DATASET_DIR, "train", "images", `${baseName}.jpg`);
        const lblDest = path.join(DATASET_DIR, "train", "labels", `${baseName}.txt`);
        const [scx, scy, sbw, sbh] = src.bbox;
        const augRes = await worker.call(
          `augment\t${src.stagedImgPath}\t${imgDest}\t${mode}\t${scx}\t${scy}\t${sbw}\t${sbh}`
        );
        if (!augRes?.ok || augRes.bytes < MIN_DATASET_BYTES) {
          try { fs.unlinkSync(imgDest); } catch {}
          continue;
        }
        // Strictly block MD5 duplicates & cross-split/cross-class near-dups (dist <= 8)
        const crossLeak = isNearDuplicate(augRes.dhash, crossClassOrValTestDhashes, 8);
        const minIntraDist = cursor > augModes.length * trimmedTrainOrig.length ? 4 : 5;
        if (globalMd5.has(augRes.md5) || crossLeak || isNearDuplicate(augRes.dhash, sameClassTrainDhashes, minIntraDist)) {
          try { fs.unlinkSync(imgDest); } catch {}
          continue;
        }
        globalMd5.add(augRes.md5);
        globalDhashes.push(augRes.dhash);
        sameClassTrainDhashes.push(augRes.dhash);

        const [acx, acy, abw, abh] = augRes.bbox;
        fs.writeFileSync(
          lblDest,
          `${cls.id} ${acx.toFixed(6)} ${acy.toFixed(6)} ${abw.toFixed(6)} ${abh.toFixed(6)}\n`,
          "utf8"
        );
        allManifestRecords.push({
          split: "train",
          filename: `${baseName}.jpg`,
          classId: cls.id,
          className: cls.name,
          slug: cls.slug,
          isAugmented: true,
          augMode: mode,
          sourceOriginal: `${cls.slug}_${String(((cursor - 1) % trimmedTrainOrig.length) + 1).padStart(2, "0")}.jpg`,
          width: augRes.w,
          height: augRes.h,
          bytes: augRes.bytes,
          md5: augRes.md5,
          dhash: augRes.dhash,
          bbox: augRes.bbox,
          source: src.source,
          sourceTitle: src.title,
        });
        augCount++;
      }

      const uniqueCountForClass = trimmedTrainOrig.length + validSet.length + testSet.length;
      totalUniqueOriginals += uniqueCountForClass;
      totalTrainOrig += trimmedTrainOrig.length;
      totalTrainAug += augCount;

      perClassStats[cls.name] = {
        uniqueOriginals: uniqueCountForClass,
        trainOriginals: trimmedTrainOrig.length,
        trainAugmented: augCount,
        trainTotal: trimmedTrainOrig.length + augCount,
        validTotal: validSet.length,
        testTotal: testSet.length,
        total: trimmedTrainOrig.length + augCount + validSet.length + testSet.length,
      };

      console.log(
        `  [OK] ${cls.name}: unique=${uniqueCountForClass} | train=${trimmedTrainOrig.length} orig + ${augCount} aug = ${trimmedTrainOrig.length + augCount} | valid=${validSet.length} | test=${testSet.length}`
      );
    }

    // Harvest Hero #13: prasmanan_kuliner_real.jpg (>= 960px)
    console.log(`\n[HERO 13] ${PRASMANAN_HERO.name} — harvesting multi-dish hero...`);
    const prasCandidates = await gatherCandidatesForClass(PRASMANAN_HERO);
    let chosenPras = null;
    for (let prasIdx = 0; prasIdx < prasCandidates.length; prasIdx++) {
      const cand = prasCandidates[prasIdx];
      const rawPath = await downloadBufferCached(cand.url, `prasmanan_${prasIdx}`);
      if (!rawPath) continue;
      const tmpDs = path.join(stageDir, `pras_tmp_${prasIdx}.jpg`);
      const tmpHero = path.join(stageDir, `pras_hero_${prasIdx}.jpg`);
      const res = await worker.call(`analyze\t${rawPath}\t${tmpDs}\t${MAX_DATASET_SIDE}\t90\t${tmpHero}`);
      try { fs.unlinkSync(tmpDs); } catch {}
      if (!res?.ok || res.heroBytes <= 0 || res.heroW < 960) {
        try { fs.unlinkSync(tmpHero); } catch {}
        continue;
      }
      const aspect = res.heroW / res.heroH;
      const prasBlob = `${cand.title || ""} ${cand.description || ""}`;
      const prasPref =
        (PRASMANAN_HERO.heroPreferRe?.test(cand.title || "") ? 42 : PRASMANAN_HERO.heroPreferRe?.test(prasBlob) ? 20 : 0) -
        (PRASMANAN_HERO.heroPenaltyRe?.test(prasBlob) ? 45 : 0);
      const score = cand.metaScore + (aspect >= 1.15 ? 25 : -10) + Math.min(25, res.cGrad * 0.6) + prasPref;
      if (!chosenPras || score > chosenPras.score) {
        if (chosenPras?.heroTempPath) {
          try { fs.unlinkSync(chosenPras.heroTempPath); } catch {}
        }
        chosenPras = { ...cand, ...res, heroTempPath: tmpHero, score };
      } else {
        try { fs.unlinkSync(tmpHero); } catch {}
      }
      if (chosenPras && prasIdx >= 35) break;
    }
    if (!chosenPras) {
      throw new Error("Failed to find >=960px prasmanan_kuliner_real.jpg candidate");
    }
    const prasDest = path.join(SAMPLES_IMG_DIR, PRASMANAN_HERO.sampleFile);
    fs.copyFileSync(chosenPras.heroTempPath, prasDest);
    const [pcx, pcy, pbw, pbh] = chosenPras.bbox;
    const prasManifest = {
      id: PRASMANAN_HERO.id,
      classId: null,
      name: PRASMANAN_HERO.name,
      slug: PRASMANAN_HERO.slug,
      sampleFile: PRASMANAN_HERO.sampleFile,
      bytes: chosenPras.heroBytes,
      width: chosenPras.heroW,
      height: chosenPras.heroH,
      aspectRatio: Number((chosenPras.heroW / chosenPras.heroH).toFixed(4)),
      bbox_yolo: chosenPras.bbox,
      bbox_xyxy: [
        Math.max(0, Math.round((pcx - pbw * 0.5) * chosenPras.heroW)),
        Math.max(0, Math.round((pcy - pbh * 0.5) * chosenPras.heroH)),
        Math.min(chosenPras.heroW, Math.round((pcx + pbw * 0.5) * chosenPras.heroW)),
        Math.min(chosenPras.heroH, Math.round((pcy + pbh * 0.5) * chosenPras.heroH)),
      ],
      sharpnessGrad: chosenPras.grad,
      centerGrad: chosenPras.cGrad,
      meanLuminance: chosenPras.meanL,
      md5: chosenPras.md5,
      dhash: chosenPras.dhash,
      source: chosenPras.source,
      sourceTitle: chosenPras.title,
      sourceUrl: chosenPras.url,
      license: chosenPras.license,
    };
    console.log(
      `  [OK] ${PRASMANAN_HERO.sampleFile}: ${prasManifest.width}x${prasManifest.height} (${(prasManifest.bytes / 1024).toFixed(1)} KB) — ${prasManifest.sourceTitle}`
    );

    // Delete old synthetic PNG cartoons in samples/images/ ONLY AFTER all 13 real hero photos exist
    for (const oldPng of OLD_SYNTHETIC_PNGS) {
      const p = path.join(SAMPLES_IMG_DIR, oldPng);
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
        console.log(`[CLEAN] Removed old synthetic cartoon: samples/images/${oldPng}`);
      }
    }

    const stats = {
      total: CLASSES.length * TARGET_PER_CLASS,
      train: CLASSES.length * TARGET_TRAIN_PER_CLASS,
      valid: CLASSES.length * TARGET_VALID_PER_CLASS,
      test: CLASSES.length * TARGET_TEST_PER_CLASS,
      uniqueOriginals: totalUniqueOriginals,
      trainOriginals: totalTrainOrig,
      trainAugmented: totalTrainAug,
      perClass: Object.fromEntries(CLASSES.map((c) => [c.name, perClassStats[c.name].total])),
      perClassBreakdown: perClassStats,
    };

    writeYamlAndReadme(stats, perClassStats);
    fs.writeFileSync(
      path.join(DATASET_DIR, "dataset_manifest.json"),
      JSON.stringify({ generated_at: new Date().toISOString(), stats, items: allManifestRecords }, null, 2),
      "utf8"
    );

    fs.writeFileSync(
      path.join(SAMPLES_IMG_DIR, "real_samples_manifest.json"),
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          stats,
          samples: sampleManifest,
          prasmanan_hero: prasManifest,
          all_heroes: [...sampleManifest, prasManifest],
        },
        null,
        2
      ),
      "utf8"
    );

    // Build visual QA contact sheet PNG in scratch dir
    const allHeroes = [...sampleManifest, prasManifest];
    const sheetSpec = allHeroes
      .map((h) => {
        const p = path.join(SAMPLES_IMG_DIR, h.sampleFile);
        return `${p}|${h.name} (${h.sampleFile})|${h.width}x${h.height} ${(h.bytes / 1024).toFixed(0)}KB grad=${h.centerGrad}|${h.bbox_yolo[0]}|${h.bbox_yolo[1]}|${h.bbox_yolo[2]}|${h.bbox_yolo[3]}`;
      })
      .join("||");
    const contactSheetPath = path.join(SCRATCH_DIR, "heroes_contact_sheet.png");
    const csRes = await worker.call(`contact\t${sheetSpec}\t${contactSheetPath}\t4`);
    if (csRes?.ok) {
      console.log(`[OK] Contact sheet created: ${contactSheetPath}`);
    }

    // Also render a dataset diversity contact sheet (2 test + 1 valid per class = 36 tiles)
    const sampleTiles = [];
    for (const cls of CLASSES) {
      const clsRecs = allManifestRecords.filter(
        (r) => r.classId === cls.id && (r.split === "test" || r.split === "valid")
      );
      for (const rec of clsRecs.slice(0, 3)) {
        const imgP = path.join(DATASET_DIR, rec.split, "images", rec.filename);
        sampleTiles.push(
          `${imgP}|${cls.name} [${rec.split}]|${rec.width}x${rec.height} ${rec.filename}|${rec.bbox[0]}|${rec.bbox[1]}|${rec.bbox[2]}|${rec.bbox[3]}`
        );
      }
    }
    const dsSheetPath = path.join(SCRATCH_DIR, "dataset_samples_contact_sheet.png");
    const dsRes = await worker.call(`contact\t${sampleTiles.join("||")}\t${dsSheetPath}\t6`);
    if (dsRes?.ok) {
      console.log(`[OK] Dataset samples contact sheet created: ${dsSheetPath}`);
    }

    // Build clean Dataset_Kuliner_Indonesia_YOLOv11.zip without bloat
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
    console.log(
      `\n[DONE] Built ${ZIP_PATH} (${(zipStat.size / (1024 * 1024)).toFixed(2)} MB) | 600 images (${stats.train} train [${stats.trainOriginals} orig + ${stats.trainAugmented} aug] / ${stats.valid} valid [orig] / ${stats.test} test [orig])`
    );
  } finally {
    await worker.close();
  }
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
