"""
Gradient descent on β_time and β_grade to minimize within-comic price variance.
Loss = sum over all comics of variance(normalized_log_prices_for_comic)
"""
import sqlite3, numpy as np, json
from datetime import date, datetime
from collections import defaultdict

TODAY = date(2026, 3, 12)

def days_ago(date_str):
    if not date_str: return 0
    try:
        d = datetime.fromisoformat(date_str[:10]).date()
        return (TODAY - d).days
    except: return 0

db = sqlite3.connect('data/comics.db')
rows = db.execute('''
    SELECT marvel_id, price, grade, sale_date, synced_at
    FROM ebay_listings WHERE grade IS NOT NULL AND price > 5
''').fetchall()

# Precompute
data = [(r[0], np.log(r[1]), float(r[2]), days_ago(r[3] or r[4])) for r in rows]
comics = sorted(set(d[0] for d in data))
by_comic = defaultdict(list)
for mid, lp, gr, da in data:
    by_comic[mid].append((lp, gr, da))

def loss_and_grad(bt, bg):
    total_loss = 0.0
    grad_bt = 0.0
    grad_bg = 0.0
    for mid, pts in by_comic.items():
        # normalized: log_price - bt*days - bg*grade
        norms = np.array([lp - bt*da - bg*gr for lp, gr, da in pts])
        mn = np.mean(norms)
        residuals = norms - mn
        total_loss += np.sum(residuals**2)
        # grad wrt bt: d/dbt sum(r_i^2) = 2 * sum(r_i * d(r_i)/dbt)
        # d(r_i)/dbt = -days_i + mean_days
        days_arr = np.array([da for _, _, da in pts])
        grade_arr = np.array([gr for _, gr, _ in pts])
        grad_bt += 2 * np.sum(residuals * (-days_arr + np.mean(days_arr)))
        grad_bg += 2 * np.sum(residuals * (-grade_arr + np.mean(grade_arr)))
    return total_loss, grad_bt, grad_bg

# Start from OLS values as reference
with open('data/price-norm.json') as f:
    ols = json.load(f)
ols_bt = ols['beta_time']
ols_bg = ols['beta_grade']

print(f"OLS solution: β_time={ols_bt:.6f}, β_grade={ols_bg:.4f}")
l, _, _ = loss_and_grad(ols_bt, ols_bg)
print(f"OLS loss: {l:.2f}")

# Try guesses to show the loss landscape
print(f"\nLoss at different β_grade values (β_time fixed at OLS):")
for bg in [0.0, 0.1, 0.15, 0.20, 0.25, 0.27, 0.30, 0.35, 0.40]:
    l, _, _ = loss_and_grad(ols_bt, bg)
    print(f"  β_grade={bg:.2f}: loss={l:.2f}")

print(f"\nGradient descent from scratch...")
bt = 0.0001  # initial guess
bg = 0.20    # initial guess
lr = 1e-11
for step in range(500):
    l, gbt, gbg = loss_and_grad(bt, bg)
    bt -= lr * gbt
    bg -= lr * gbg
    if step % 100 == 0:
        print(f"  step {step}: loss={l:.2f}, β_time={bt:.6f}, β_grade={bg:.4f}")

print(f"\nConverged: β_time={bt:.6f}, β_grade={bg:.4f}")
print(f"OLS:       β_time={ols_bt:.6f}, β_grade={ols_bg:.4f}")
