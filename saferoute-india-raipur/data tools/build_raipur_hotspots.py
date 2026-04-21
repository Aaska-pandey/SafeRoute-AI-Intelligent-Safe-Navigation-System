import json
import requests
import time
import random
from datetime import datetime, timedelta

# Raipur bounding box for Overpass (approx)
# south, west, north, east
RAIPUR_BBOX = (21.15, 81.55, 21.35, 81.80)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def overpass_query(query):
    resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=120)
    resp.raise_for_status()
    return resp.json()


def build_query():
    south, west, north, east = RAIPUR_BBOX

    # We select multiple feature types relevant to safety
    # and then map them to hotspot categories later.
    query = f"""
    [out:json][timeout:90];
    (
      // Bus & transit
      node["amenity"="bus_station"]({south},{west},{north},{east});
      node["highway"="bus_stop"]({south},{west},{north},{east});

      // Markets / commercial
      node["shop"]( {south},{west},{north},{east});
      node["amenity"="marketplace"]({south},{west},{north},{east});

      // Education & hostels
      node["amenity"="college"]({south},{west},{north},{east});
      node["amenity"="university"]({south},{west},{north},{east});
      node["amenity"="school"]({south},{west},{north},{east});

      // Bars / nightlife
      node["amenity"="bar"]({south},{west},{north},{east});
      node["amenity"="pub"]({south},{west},{north},{east});
      node["amenity"="nightclub"]({south},{west},{north},{east});

      // Parks / leisure (often isolated at night)
      node["leisure"="park"]({south},{west},{north},{east});
      node["leisure"="playground"]({south},{west},{north},{east});

      // Industrial / isolated
      node["landuse"="industrial"]({south},{west},{north},{east});
      node["landuse"="commercial"]({south},{west},{north},{east});

      // Police (for context, not risk)
      node["amenity"="police"]({south},{west},{north},{east});

      // Major road intersections
      node["highway"="primary"]({south},{west},{north},{east});
      node["highway"="secondary"]({south},{west},{north},{east});
    );
    out center;
    """
    return query


def classify_hotspot(elem):
    """
    Map OSM tags into your hotspot schema:
    type ∈ { harassment, dark_area, robbery, theft, pickpocketing, accident }
    severity ∈ {1,2,3}
    """
    tags = elem.get("tags", {})
    amenity = tags.get("amenity", "")
    highway = tags.get("highway", "")
    shop = tags.get("shop", "")
    leisure = tags.get("leisure", "")
    landuse = tags.get("landuse", "")

    # Defaults
    htype = None
    severity = 1

    # Women-safety related (harassment / dark_area / robbery)
    # Parks, bars, nightclubs at night tend to be high-risk for harassment.
    if amenity in ["bar", "pub", "nightclub"]:
        htype = "harassment"
        severity = 3
    elif leisure in ["park", "playground"]:
        htype = "dark_area"
        severity = 2
    elif landuse in ["industrial"]:
        htype = "dark_area"
        severity = 2
    elif amenity in ["college", "university"]:
        # harassment / stalking around colleges, especially at night
        htype = "harassment"
        severity = 2

    # General crime: theft / pickpocketing around markets and bus stations
    elif amenity in ["bus_station", "marketplace"] or shop:
        htype = "pickpocketing"
        severity = 2

    # Accident risk: around primary/secondary roads and busy stops
    elif highway in ["primary", "secondary"]:
        htype = "accident"
        severity = 2

    # If we couldn't classify, skip
    if not htype:
        return None

    # Small heuristic bumps
    name = tags.get("name", "")

    # Very busy transit spots = higher theft/pickpocketing risk
    if amenity == "bus_station" and htype == "pickpocketing":
        severity = 3

    # Large central parks slightly higher at night
    if leisure == "park" and "central" in name.lower():
        severity = max(severity, 3)

    return htype, severity


def build_hotspots():
    print("Querying Overpass for Raipur features...")
    data = overpass_query(build_query())
    elements = data.get("elements", [])
    print(f"Fetched {len(elements)} elements from OSM.")

    hotspots = []
    for elem in elements:
        if "lat" in elem and "lon" in elem:
            lat = elem["lat"]
            lon = elem["lon"]
        elif "center" in elem:
            lat = elem["center"]["lat"]
            lon = elem["center"]["lon"]
        else:
            continue

        cls = classify_hotspot(elem)
        if not cls:
            continue

        htype, severity = cls
        tags = elem.get("tags", {})
        label = tags.get("name") or tags.get("amenity") or tags.get("shop") or htype

        hotspot = {
            "lat": lat,
            "lng": lon,
            "type": htype,
            "severity": severity,
            "label": label,
            "source": "osm_overpass",
            "osm_id": elem.get("id"),
        }
        hotspots.append(hotspot)

    print(f"Created {len(hotspots)} classified hotspots.")
    return hotspots
def assign_recency(hotspots):
    """
    Assign synthetic but realistic timestamps to hotspots.

    - Severity 3 → more likely in last 0–3 months
    - Severity 2 → mix of 0–3 and 3–9 months
    - Severity 1 → more likely older (3–12+ months)

    Also tags:
      - months_ago (float)
      - timestamp (ISO date)
      - recency_bucket ∈ {"0_3m", "3_9m", "9m_plus"}
      - is_recent_3m (bool)
    """
    now = datetime.utcnow()

    for hs in hotspots:
        sev = hs.get("severity", 1)
        u = random.random()

        # base months_ago according to severity
        if sev >= 3:
            # high severity -> skew recent
            if u < 0.7:
                months_ago = random.uniform(0, 3)       # 70% in last 3 months
            else:
                months_ago = random.uniform(3, 9)
        elif sev == 2:
            # medium -> mixed
            if u < 0.3:
                months_ago = random.uniform(0, 3)       # 30% recent
            elif u < 0.8:
                months_ago = random.uniform(3, 9)       # 50% mid
            else:
                months_ago = random.uniform(9, 15)      # 20% old
        else:
            # severity 1 → mostly older
            if u < 0.15:
                months_ago = random.uniform(0, 3)       # 15% recent
            elif u < 0.5:
                months_ago = random.uniform(3, 9)       # 35% mid
            else:
                months_ago = random.uniform(9, 18)      # 50% old

        # convert months_ago to days (approx 30 days/month)
        days_ago = months_ago * 30
        ts = now - timedelta(days=days_ago)

        # recency bucket
        if months_ago <= 3:
            bucket = "0_3m"
        elif months_ago <= 9:
            bucket = "3_9m"
        else:
            bucket = "9m_plus"

        hs["months_ago"] = round(months_ago, 2)
        hs["timestamp"] = ts.date().isoformat()
        hs["recency_bucket"] = bucket
        hs["is_recent_3m"] = months_ago <= 3

    return hotspots


def main():
    hotspots = build_hotspots()
    hotspots = assign_recency(hotspots)

    out_path = "raipur_hotspots.json"  # adjust path if needed
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(hotspots, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(hotspots)} hotspots with recency info to {out_path}")



if __name__ == "__main__":
    main()
