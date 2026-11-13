# Dataset Kuliner Umum Indonesia (YOLOv11 Format)

Total images: 600 images across 12 classes (50 per class).
- Train : 420 images (70% = 35/class; 314 unique originals + 106 photorealistic train-only augmentations)
- Valid : 120 images (20% = 10/class; 100% unique originals, ZERO augmentation, ZERO leakage)
- Test  : 60 images (10% = 5/class; 100% unique originals, ZERO augmentation, ZERO leakage)
- Unique Original Photographs Total: 494

Quality & Deduplication Guarantees:
- Every image decoded & EXIF-normalized with .NET System.Drawing (min side >= 480px, max side >= 640px, aspect 0.55..1.95, >= 35 KB).
- Sharpness, luminance, exposure, colorfulness, and native center-crop edge gradient checked on every image.
- Exact MD5 + 64-bit dHash perceptual deduplication enforced across ALL classes and splits.
- Zero Data Leakage: unique originals are split into train/valid/test FIRST before generating sharp train-only augmentations (horizontal flip, clean 86-88% crop zoom, gentle warmth/gamma 0.94..1.06, JPEG quality 95).
- Labels in dataset/*/labels/*.txt use per-image food saliency bounding box estimation (NOT blind hardcoded boxes).

Per-Class Honest Breakdown:
Class           | Unique Originals | Train Orig | Train Aug | Train Total | Valid (Orig) | Test (Orig) | Total
----------------+------------------+------------+-----------+-------------+--------------+-------------+------
Nasi Goreng     |               50 |         35 |         0 |          35 |           10 |           5 |    50
Bakso           |               50 |         35 |         0 |          35 |           10 |           5 |    50
Sate Ayam       |               50 |         35 |         0 |          35 |           10 |           5 |    50
Rendang         |               37 |         22 |        13 |          35 |           10 |           5 |    50
Soto Ayam       |               50 |         35 |         0 |          35 |           10 |           5 |    50
Ayam Goreng     |               50 |         35 |         0 |          35 |           10 |           5 |    50
Mie Goreng      |               31 |         16 |        19 |          35 |           10 |           5 |    50
Tempe Goreng    |               48 |         33 |         2 |          35 |           10 |           5 |    50
Tahu Goreng     |               35 |         20 |        15 |          35 |           10 |           5 |    50
Gado-Gado       |               33 |         18 |        17 |          35 |           10 |           5 |    50
Pempek          |               39 |         24 |        11 |          35 |           10 |           5 |    50
Telur Balado    |               21 |          6 |        29 |          35 |           10 |           5 |    50
