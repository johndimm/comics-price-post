"""
Fit per-title, per-type grade curves using LOESS (local weighted regression).

For each query grade, nearby data points get high weight (Gaussian kernel),
far points get low weight. This means high-grade recent sales dominate the
prediction at high grades instead of being diluted by many cheap low-grade copies.

Stores precomputed {x, y} curve points (not a/b coefficients) so any
fitting method can be used.
"""
import sqlite3
import numpy as np
import json
from collections import defaultdict

MIN_POINTS = 4
MIN_GRADE = 4.0
SIGMA_CUT = 2.0
BANDWIDTH = 1.5        # LOESS bandwidth in grade units (Gaussian half-width)
EXTRAP_BEYOND = 1.5    # how many grade points to extrapolate beyond max data grade
CURVE_STEP = 0.25      # grade step for stored curve points

FACSIMILE_KEYWORDS = ['facsimile', 'reprint', 'replica', ' svg ', 'facsimile edition']

def is_facsimile(title: str) -> bool:
    if not title:
        return False
    t = title.lower()
    return any(kw in t for kw in FACSIMILE_KEYWORDS)

def loess_predict(grades, log_prices, query_grade, bandwidth=BANDWIDTH):
    """Locally weighted linear regression at query_grade."""
    weights = np.exp(-0.5 * ((grades - query_grade) / bandwidth) ** 2)
    total_weight = weights.sum()
    if total_weight < 1e-6:
        return None
    # Weighted linear regression in log space
    X = np.column_stack([np.ones(len(grades)), grades])
    W = np.diag(weights)
    try:
        XWX = X.T @ W @ X + 1e-6 * np.eye(2)  # small ridge for stability
        XWy = X.T @ W @ log_prices
        coeffs = np.linalg.solve(XWX, XWy)
        return float(coeffs[0] + coeffs[1] * query_grade)
    except np.linalg.LinAlgError:
        # Fallback: weighted mean
        return float(np.average(log_prices, weights=weights))

def make_monotone(points):
    """Enforce non-decreasing prices (higher grade = higher or equal price)."""
    if not points:
        return points
    result = list(points)
    # Forward pass: each point >= previous
    for i in range(1, len(result)):
        if result[i]['y'] < result[i-1]['y']:
            result[i] = {'x': result[i]['x'], 'y': result[i-1]['y']}
    return result

def fit_loess_curve(raw_points):
    """
    Given list of (grade, price) tuples, return precomputed LOESS curve.
    Returns None if insufficient data.
    """
    # Filter grade >= MIN_GRADE
    pts = [(g, p) for g, p in raw_points if g >= MIN_GRADE and p > 10]
    if len(pts) < MIN_POINTS:
        return None

    grades = np.array([p[0] for p in pts])
    log_prices = np.log([p[1] for p in pts])

    # Outlier removal using global fit residuals
    gm, lm = grades.mean(), log_prices.mean()
    denom = np.sum((grades - gm)**2)
    if denom < 1e-10:
        return None
    b0 = np.sum((grades - gm) * (log_prices - lm)) / denom
    a0 = np.median(log_prices) - b0 * np.median(grades)
    resid = log_prices - (a0 + b0 * grades)
    sigma = np.std(resid)
    mask = np.abs(resid) <= SIGMA_CUT * sigma
    if mask.sum() < MIN_POINTS:
        return None

    grades = grades[mask]
    log_prices = log_prices[mask]

    # Compute LOESS predictions at regular grade intervals
    lo = max(0.5, grades.min() - 0.5)
    hi = min(10.0, grades.max() + EXTRAP_BEYOND)
    query_grades = np.arange(lo, hi + 0.01, CURVE_STEP)

    curve_points = []
    for g in query_grades:
        lp = loess_predict(grades, log_prices, g)
        if lp is not None:
            curve_points.append({'x': round(float(g), 2), 'y': int(round(np.exp(lp)))})

    if len(curve_points) < 2:
        return None

    curve_points = make_monotone(curve_points)

    return {'points': curve_points, 'n': int(mask.sum())}


# --- Load data ---
db = sqlite3.connect('data/comics.db')
rows = db.execute('''
    SELECT marvel_id, price, grade, is_slabbed, type, raw_title
    FROM ebay_listings
    WHERE grade IS NOT NULL AND price > 10
    ORDER BY marvel_id
''').fetchall()

print(f"Loaded {len(rows)} listings")

groups = defaultdict(list)
skipped = 0
for marvel_id, price, grade, is_slabbed, ltype, raw_title in rows:
    if is_facsimile(raw_title or ''):
        skipped += 1
        continue
    key = (marvel_id, ltype, int(is_slabbed))
    groups[key].append((grade, price))

print(f"Skipped {skipped} facsimile listings")

key_map = {
    ('sold', 1): 'sold_slabbed',
    ('sold', 0): 'sold_raw',
    ('asking', 1): 'asking_slabbed',
    ('asking', 0): 'asking_raw',
}

grade_curves = defaultdict(dict)
for (marvel_id, ltype, is_slabbed), points in groups.items():
    field = key_map.get((ltype, is_slabbed))
    if not field:
        continue
    curve = fit_loess_curve(points)
    if curve:
        grade_curves[marvel_id][field] = curve

print(f"Fitted curves for {len(grade_curves)} comics")

# --- Spot check FF50 ---
ff50 = grade_curves.get('13256', {})
print(f"\nFF50 (13256) LOESS curves:")
for k, v in ff50.items():
    pts = v['points']
    # Find predictions at key grades
    by_grade = {p['x']: p['y'] for p in pts}
    vals = [(g, by_grade.get(g, '—')) for g in [7.0, 8.0, 8.5, 9.0, 9.2, 9.4]]
    print(f"  {k} (n={v['n']}): " + ", ".join(f"gr{g}=${y}" for g, y in vals))

# --- Save ---
norm = json.load(open('data/price-norm.json'))
norm['grade_curves'] = dict(grade_curves)

with open('data/price-norm.json', 'w') as f:
    json.dump(norm, f, indent=2)

print(f"\nSaved data/price-norm.json")
