import random
import csv

"""
Synthetic dataset generator for SafeRoute Raipur.

Each row is a "route": features + label:
- harassment_count
- dark_area_count
- robbery_count
- other_count
- route_length_km
- time_band (day/evening/night)
- safe_label (1 = safe, 0 = unsafe)
"""

N_SAMPLES = 1200
OUTPUT_CSV = "route_data.csv"

time_bands = ["day", "evening", "night"]

rows = []

for i in range(N_SAMPLES):
    # Random time band, slightly more routes in day/evening than night
    r = random.random()
    if r < 0.45:
        time = "day"
    elif r < 0.8:
        time = "evening"
    else:
        time = "night"

    # Base hotspot counts – tuned to look reasonable
    if time == "day":
        harassment = random.randint(0, 2)
        dark = random.randint(0, 1)
        robbery = random.randint(0, 2)
    elif time == "evening":
        harassment = random.randint(0, 3)
        dark = random.randint(0, 2)
        robbery = random.randint(0, 3)
    else:  # night
        harassment = random.randint(0, 4)
        dark = random.randint(0, 4)
        robbery = random.randint(0, 4)

    other = random.randint(0, 5)

    # Route length in km
    length_km = round(random.uniform(1.0, 10.0), 2)

    # Risk score (hand-crafted "true" function)
    base_risk = (
        2.0 * harassment +
        1.8 * dark +
        2.3 * robbery +
        0.6 * other +
        0.35 * length_km
    )

    if time == "evening":
        base_risk *= 1.15
    elif time == "night":
        base_risk *= 1.5

    # Add some noise
    noise = random.uniform(-1.0, 1.0)
    risk_score = base_risk + noise

    # Label: 1 = safe, 0 = unsafe
    safe_label = 1 if risk_score < 7.0 else 0

    rows.append([
        harassment,
        dark,
        robbery,
        other,
        length_km,
        time,
        safe_label
    ])

with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow([
        "harassment_count",
        "dark_area_count",
        "robbery_count",
        "other_count",
        "route_length_km",
        "time_band",
        "safe_label"
    ])
    writer.writerows(rows)

print(f"Wrote {len(rows)} rows to {OUTPUT_CSV}")
