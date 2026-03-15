"""
Ingest slabbed-2025 CGC photos into comics-images.csv and
update CGC cert numbers in the master spreadsheet CSV.
"""
import csv, os, shutil

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER_CSV = os.path.join(BASE, "public", "Silver Age Marvels - 2026 all comics.csv")
IMAGES_CSV = os.path.join(BASE, "public", "comic-photos", "comics-images.csv")

# ── Full manifest ────────────────────────────────────────────────────────────
# (invoice, seq, marvel_id, cert_number)
MANIFEST = [
    # Order 4659391
    ("4659391", "001", "13205",  "4659391001"),   # FF 38
    ("4659391", "002", "13239",  "4659391002"),   # FF 41
    ("4659391", "003", "13249",  "4659391003"),   # FF 44
    ("4659391", "004", "13252",  "4659391004"),   # FF 47
    ("4659391", "005", "13262",  "4659391005"),   # FF 56
    ("4659391", "006", "12414",  "4659391006"),   # X-Men 10
    ("4659391", "007", "12425",  "4659391007"),   # X-Men 11
    ("4659391", "008", "12447",  "4659391008"),   # X-Men 13
    ("4659391", "009", "12462",  "4659391009"),   # X-Men 16
    ("4659391", "010", "12464",  "4659391010"),   # X-Men 18
    ("4659391", "011", "12470",  "4659391011"),   # X-Men 23
    ("4659391", "012", "9689",   "4659391012"),   # JIM/Thor 114
    ("4659391", "013", "9690",   "4659391013"),   # JIM/Thor 115
    ("4659391", "014", "9691",   "4659391014"),   # JIM/Thor 116
    ("4659391", "015", "9693",   "4659391015"),   # JIM/Thor 118
    ("4659391", "016", "11462",  "4659391016"),   # Thor 134
    ("4659391", "017", "6671",   "4659391017"),   # ASM 27
    ("4659391", "018", "6705",   "4659391018"),   # ASM 30
    ("4659391", "019", "13274",  "4659391019"),   # FF 67
    ("4659391", "020", "11302",  "4659391020"),   # Tales of Suspense 59
    ("4659391", "021", "13264",  "4659391021"),   # FF 58
    # Order 4659813
    ("4659813", "001", "6582",   "4659813001"),   # ASM 19
    ("4659813", "002", "6660",   "4659813002"),   # ASM 26
    ("4659813", "003", "13216",  "4659813003"),   # FF 39
    ("4659813", "004", "13251",  "4659813004"),   # FF 46
    ("4659813", "005", "13261",  "4659813005"),   # FF 55
]

# ── 1. Update comics-images.csv ──────────────────────────────────────────────
with open(IMAGES_CSV, newline="", encoding="utf-8") as f:
    existing_rows = list(csv.DictReader(f))

existing_photos = {(r["comic_id"], r["photo"]) for r in existing_rows}
new_rows = []

for invoice, seq, marvel_id, cert in MANIFEST:
    for side in ("OBV", "REV"):
        filename = f"CGC{invoice}-{seq}_{side}.jpg"
        photo_path = f"/comic-photos/slabbed-2025/{invoice}/{filename}"
        full_path = os.path.join(BASE, "public", "comic-photos", "slabbed-2025", invoice, filename)
        if not os.path.exists(full_path):
            print(f"  MISSING file: {full_path}")
            continue
        if (marvel_id, photo_path) not in existing_photos:
            new_rows.append({"comic_id": marvel_id, "area": "", "photo": photo_path})
            print(f"  + {marvel_id} {side}: {photo_path}")
        else:
            print(f"  = {marvel_id} {side}: already in CSV")

if new_rows:
    with open(IMAGES_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["comic_id", "area", "photo"])
        writer.writerows(new_rows)
    print(f"\nAdded {len(new_rows)} photo rows to comics-images.csv")
else:
    print("\nNo new photo rows to add")

# ── 2. Update CGC cert numbers in master CSV ─────────────────────────────────
cert_map = {marvel_id: cert for _, _, marvel_id, cert in MANIFEST}

with open(MASTER_CSV, newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows = list(reader)

updated = 0
for row in rows:
    mid = row.get("marvel_id", "").strip()
    if mid in cert_map:
        old_cgc = row.get("CGC", "").strip()
        new_cgc = cert_map[mid]
        if old_cgc != new_cgc:
            row["CGC"] = new_cgc
            print(f"  CGC {mid}: '{old_cgc}' → '{new_cgc}'")
            updated += 1

with open(MASTER_CSV, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"\nUpdated {updated} CGC cert numbers in master CSV")
print("\nDone. Restart the dev server to pick up changes.")
