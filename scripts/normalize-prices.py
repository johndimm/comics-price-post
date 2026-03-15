"""
Hierarchical price normalization.
Model: log(price) = V_comic + β_time * days_ago + β_grade * grade + ε

We fit via OLS with comic fixed effects using numpy lstsq.
Today is the reference date (days_ago=0 → today's price).
"""
import sqlite3
import numpy as np
import json
from datetime import date, datetime
from collections import defaultdict

TODAY = date(2026, 3, 12)

def days_ago(date_str):
    if not date_str:
        return 0
    try:
        d = datetime.fromisoformat(date_str[:10]).date()
        return (TODAY - d).days
    except:
        return 0

db = sqlite3.connect('data/comics.db')
rows = db.execute('''
    SELECT marvel_id, price, grade, sale_date, synced_at, type, item_id
    FROM ebay_listings
    WHERE grade IS NOT NULL AND price > 5
    ORDER BY marvel_id
''').fetchall()

print(f"Loaded {len(rows)} listings with grade+price")

# Index comics
comics = sorted(set(r[0] for r in rows))
comic_idx = {c: i for i, c in enumerate(comics)}
n_comics = len(comics)

n = len(rows)
print(f"{n_comics} comics, {n} listings")

# Build design matrix: [comic_dummies... | days_ago | grade]
# log(price) = sum(V_i * I_comic_i) + β_time * days_ago + β_grade * grade
X = np.zeros((n, n_comics + 2), dtype=np.float64)
y = np.zeros(n, dtype=np.float64)

for i, (marvel_id, price, grade, sale_date, synced_at, ltype, item_id) in enumerate(rows):
    ci = comic_idx[marvel_id]
    X[i, ci] = 1.0                   # comic fixed effect
    d = days_ago(sale_date or synced_at)
    X[i, n_comics] = d               # time
    X[i, n_comics + 1] = float(grade)  # grade
    y[i] = np.log(price)

print("Fitting OLS with numpy lstsq...")
coeffs, residuals, rank, sv = np.linalg.lstsq(X, y, rcond=None)

beta_time = coeffs[n_comics]
beta_grade = coeffs[n_comics + 1]
comic_values = coeffs[:n_comics]

print(f"\nGlobal coefficients:")
print(f"  β_time  = {beta_time:.6f}  (per day; {beta_time*365:.3f}/yr)")
print(f"  β_grade = {beta_grade:.4f}  (per grade point)")
print(f"  β_time %/mo = {100*(np.exp(beta_time*30)-1):.2f}%")
print(f"  β_grade ratio 8→9 = {np.exp(beta_grade):.3f}x")

# Compute normalized values: remove time and grade signal, keep V_comic
y_pred = X @ coeffs
resid = y - y_pred

# Normalized price: price adjusted to today's date and grade=comic's median grade
# intrinsic[j] = exp(V_comic_j + β_grade * median_grade_j)
# For display: normalize each listing to today + its comic's median grade
per_comic_grades = defaultdict(list)
for r in rows:
    per_comic_grades[r[0]].append(r[2])

median_grades = {c: np.median(v) for c, v in per_comic_grades.items()}

# Variance analysis
print(f"\nResidual std (log scale): {np.std(resid):.4f} ({100*(np.exp(np.std(resid))-1):.1f}% price equiv)")

# Save coefficients
out = {
    "beta_time": beta_time,
    "beta_grade": beta_grade,
    "reference_date": str(TODAY),
    "comics": {}
}
for c in comics:
    ci = comic_idx[c]
    mg = median_grades[c]
    intrinsic = float(np.exp(comic_values[ci] + beta_grade * mg))
    out["comics"][c] = {
        "log_value": float(comic_values[ci]),
        "median_grade": mg,
        "intrinsic_value": round(intrinsic, 2)
    }

with open("data/price-norm.json", "w") as f:
    json.dump(out, f, indent=2)

print(f"\nSaved data/price-norm.json")
print(f"\nSample intrinsic values:")
sample = [(c, out["comics"][c]["intrinsic_value"], out["comics"][c]["median_grade"]) for c in comics[:10]]
for c, iv, mg in sample:
    print(f"  {c}: ${iv:.0f} (median grade {mg:.1f})")
