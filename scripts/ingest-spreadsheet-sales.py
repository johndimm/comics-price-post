"""
Ingest spreadsheet sold prices into ebay_listings so they:
1. Participate in LOESS curve fitting
2. Are found by calcFMV tight-window searches
"""
import csv
import sqlite3
import re
from datetime import datetime

CSV_PATH = 'public/Silver Age Marvels - 2026 all comics.csv'
DB_PATH = 'data/comics.db'

def parse_price(s):
    if not s:
        return None
    s = s.strip().replace('$', '').replace(',', '')
    try:
        v = float(s)
        return v if v > 0 else None
    except ValueError:
        return None

def parse_date(s):
    if not s:
        return None
    s = s.strip()
    for fmt in ('%Y-%m-%d', '%b %d, %Y', '%b %d, %Y', '%B %d, %Y'):
        try:
            return datetime.strptime(s, fmt).strftime('%Y-%m-%d')
        except ValueError:
            pass
    # Try with space-collapsed month
    m = re.match(r'(\w+)\s+(\d+),?\s+(\d{4})', s)
    if m:
        try:
            return datetime.strptime(f"{m.group(1)} {m.group(2)} {m.group(3)}", '%b %d %Y').strftime('%Y-%m-%d')
        except ValueError:
            pass
    return None

def is_cgc(cgc_field):
    if not cgc_field:
        return False
    f = cgc_field.strip()
    return f.lower() == 'yes' or (f.isdigit() and len(f) >= 8)

db = sqlite3.connect(DB_PATH)
inserted = 0
skipped = 0

with open(CSV_PATH, newline='', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        marvel_id = row.get('marvel_id', '').strip()
        if not marvel_id or marvel_id == '#N/A':
            continue

        price = parse_price(row.get('Sold Price', ''))
        if price is None or price < 5:
            skipped += 1
            continue

        grade_str = row.get('grade', '').strip()
        try:
            grade = float(grade_str)
        except ValueError:
            skipped += 1
            continue

        sale_date = parse_date(row.get('Sold Date', ''))
        slabbed = 1 if is_cgc(row.get('CGC', '')) else 0

        item_id = f'spreadsheet_{marvel_id}'
        raw_title = f'Spreadsheet sale gr{grade}'

        db.execute('''
            INSERT OR REPLACE INTO ebay_listings
              (item_id, marvel_id, type, price, currency, sale_date, grade, is_slabbed, raw_title, listing_url, image_url)
            VALUES (?, ?, 'sold', ?, 'USD', ?, ?, ?, ?, NULL, NULL)
        ''', (item_id, marvel_id, price, sale_date, grade, slabbed, raw_title))

        print(f"  {marvel_id}: gr{grade} ${price} slabbed={slabbed} date={sale_date}")
        inserted += 1

db.commit()
db.close()
print(f"\nInserted/updated {inserted} spreadsheet sales, skipped {skipped}")
