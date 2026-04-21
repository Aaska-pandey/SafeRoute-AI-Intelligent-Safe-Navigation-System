

// 🔥 NEW: Backend AI call
async function getAIScore(routeFeatures) {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/score-route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        features: routeFeatures
      })
    });

    if (!res.ok) throw new Error("Backend error");

    return await res.json();

  } catch (err) {
    console.error("⚠️ AI backend failed, using fallback");

    return {
      finalScore: 5
    };
  }
}


const CITY_CENTER = {
  lat: 21.2514,
  lng: 81.6296,
  zoom: 13,
};

const HOTSPOT_RADIUS_METERS = 150;
const HOTSPOTS_URL = "data/raipur_hotspots.json";

const WOMEN_SAFETY_TYPES = ["harassment", "dark_area", "robbery"];

const RAIPUR_VIEWBOX = "81.55,21.35,81.75,21.15";

const BACKEND_BASE_URL = "";

let map;
let hotspots = [];
let hotspotMarkers = [];
let startMarker = null;
let endMarker = null;
let routesLayerGroup = null;
let heatLayer = null;

let CURRENT_ROUTE_ID = null;
let LAST_ROUTE_RESULT = null;

function buildRouteId(start, end) {
  return (
    start.lat.toFixed(5) +
    "," +
    start.lng.toFixed(5) +
    "->" +
    end.lat.toFixed(5) +
    "," +
    end.lng.toFixed(5)
  );
}

function distanceInMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function formatCoords(lat, lng) {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function getHotspotsNearRoute(routeCoords) {
  const near = [];

  hotspots.forEach((hs) => {
    const { lat, lng } = hs;
    let isNear = false;

    for (const [rLng, rLat] of routeCoords) {
      const d = distanceInMeters(lat, lng, rLat, rLng);
      if (d <= HOTSPOT_RADIUS_METERS) {
        isNear = true;
        break;
      }
    }

    if (isNear) near.push(hs);
  });

  return near;
}

function getSeverityColor(severity, type) {
  const isWomenType = WOMEN_SAFETY_TYPES.includes(type);

  if (severity >= 3) return isWomenType ? "#dc2626" : "#f97316";
  if (severity === 2) return isWomenType ? "#f97316" : "#eab308";
  return isWomenType ? "#eab308" : "#22c55e";
}

function renderHotspotsForRoute(nearHotspots) {
  hotspotMarkers.forEach((m) => map.removeLayer(m));
  hotspotMarkers = [];

  nearHotspots.forEach((hs) => {
    const severity = hs.severity || 1;
    const color = getSeverityColor(severity, hs.type);

    const marker = L.circleMarker([hs.lat, hs.lng], {
      radius: 6 + severity,
      color: "#020617",
      weight: 1,
      fillColor: color,
      fillOpacity: 0.9,
    }).addTo(map);

    marker.bindPopup(
      `<strong>${hs.label || "Hotspot"}</strong><br/>
       Type: ${hs.type || "unknown"}<br/>
       Severity: ${severity}`
    );

    hotspotMarkers.push(marker);
  });
}

function loadHotspots() {
  return fetch(HOTSPOTS_URL)
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load hotspots");
      return res.json();
    })
    .then((data) => {
      hotspots = data;
    })
    .catch((err) => {
      console.error("Error loading hotspots:", err);
      alert("Failed to load hotspot data. Check console for details.");
    });
}

function extractRouteFeatures(routeCoords, nearHotspots) {
  let harassmentCount = 0;
  let darkAreaCount = 0;
  let robberyCount = 0;
  let otherCount = 0;
  let activityCount = 0;

  let recent3mCount = 0;
  let recent3mWomenCount = 0;

  nearHotspots.forEach((h) => {
    const t = h.type || "other";

    if (t === "harassment") {
      harassmentCount++;
    } else if (t === "dark_area") {
      darkAreaCount++;
    } else if (t === "robbery") {
      robberyCount++;
    } else {
      otherCount++;
      activityCount++;
    }

    if (h.is_recent_3m) {
      recent3mCount++;
      if (WOMEN_SAFETY_TYPES.includes(t)) {
        recent3mWomenCount++;
      }
    }
  });

  let totalDistMeters = 0;
  for (let i = 1; i < routeCoords.length; i++) {
    const [lng1, lat1] = routeCoords[i - 1];
    const [lng2, lat2] = routeCoords[i];
    totalDistMeters += distanceInMeters(lat1, lng1, lat2, lng2);
  }
  const routeLengthKm = totalDistMeters / 1000;

  let distSumFromCenter = 0;
  if (routeCoords.length > 0) {
    routeCoords.forEach(([lng, lat]) => {
      distSumFromCenter += distanceInMeters(
        lat,
        lng,
        CITY_CENTER.lat,
        CITY_CENTER.lng
      );
    });
  }
  const avgDistFromCenterKm =
    routeCoords.length > 0
      ? distSumFromCenter / routeCoords.length / 1000
      : 0;

  const safeLenKm = routeLengthKm + 0.3;
  const womenHotspotDensity =
    (harassmentCount + darkAreaCount + robberyCount) / safeLenKm;
  const activityDensity = activityCount / safeLenKm;
  const darkDensity = darkAreaCount / safeLenKm;

  const recent3mDensity = recent3mCount / safeLenKm;
  const recent3mWomenDensity = recent3mWomenCount / safeLenKm;

  const distIso = Math.max(0, Math.min(1, avgDistFromCenterKm / 10));
  const activityIso = 1 - Math.tanh(activityDensity);
  const isolationScore = Math.max(
    0,
    Math.min(1, 0.6 * distIso + 0.4 * activityIso)
  );

  return {
    harassmentCount,
    darkAreaCount,
    robberyCount,
    otherCount,
    activityCount,
    routeLengthKm,
    avgDistFromCenterKm,
    womenHotspotDensity,
    activityDensity,
    darkDensity,
    isolationScore,
    recent3mCount,
    recent3mWomenCount,
    recent3mDensity,
    recent3mWomenDensity,
  };
}

function predictRiskProbability(features, timeBand) {
  const {
    harassmentCount,
    darkAreaCount,
    robberyCount,
    otherCount,
    routeLengthKm,
    womenHotspotDensity,
    activityDensity,
    darkDensity,
    isolationScore,
    recent3mCount,
    recent3mWomenCount,
    recent3mDensity,
    recent3mWomenDensity,
  } = features;

  const totalHotspots =
    harassmentCount + darkAreaCount + robberyCount + otherCount;
  const womenHotspots = harassmentCount + darkAreaCount + robberyCount;

  if (totalHotspots === 0) {
    let base;
    if (timeBand === "day") {
      base = 0.15;
    } else if (timeBand === "evening") {
      base = 0.22;
    } else {
      base = 0.3;
    }

    base += 0.15 * isolationScore;

    if (base < 0.1) base = 0.1;
    if (base > 0.45) base = 0.45;

    return base;
  }

  let risk = 0.2;

  if (typeof AI_MODEL !== "undefined" && AI_MODEL) {
    const categories = AI_MODEL.time_categories;
    const coef = AI_MODEL.coef;
    const intercept = AI_MODEL.intercept;

    const x = [];
    categories.forEach((cat) => x.push(cat === timeBand ? 1 : 0));

    x.push(harassmentCount);
    x.push(darkAreaCount);
    x.push(robberyCount);
    x.push(otherCount);
    x.push(routeLengthKm);

    let z = intercept;
    for (let i = 0; i < coef.length; i++) z += coef[i] * x[i];
    risk = 1 / (1 + Math.exp(-z));
  }

  const timeMult =
    timeBand === "night" ? 1.6 : timeBand === "evening" ? 1.2 : 1.0;

  const isolationMult = 1 + 0.5 * isolationScore;
  const lightingMult = 1 + 0.4 * Math.tanh(darkDensity);

  let crowdMult = 1 - 0.3 * Math.tanh(activityDensity);
  if (crowdMult < 0.7) crowdMult = 0.7;

  const womenMult = 1 + 0.5 * Math.tanh(womenHotspotDensity);

  const recentAllMult = 1 + 0.35 * Math.tanh(recent3mDensity);
  const recentWomenMult = 1 + 0.55 * Math.tanh(recent3mWomenDensity);

  let combinedMult =
    timeMult *
    isolationMult *
    lightingMult *
    womenMult *
    crowdMult *
    recentAllMult *
    recentWomenMult;

  combinedMult = Math.max(0.7, Math.min(1.8, combinedMult));
  risk *= combinedMult;

  if (womenHotspots >= 5 || recent3mWomenCount >= 4) {
    risk = Math.max(risk, 0.5);
  }

  if (totalHotspots >= 12) {
    risk = Math.max(risk, 0.45);
  }

  if (timeBand === "night" && isolationScore > 0.6) {
    risk = Math.max(risk, 0.55);
  }

  risk = Math.min(0.9, Math.max(0.05, risk));
  return risk;
}

async function computeSafetyScore(routeCoords) {
  const nearHotspots = getHotspotsNearRoute(routeCoords);
  const features = extractRouteFeatures(routeCoords, nearHotspots);

  // 🔥 Call backend AI
 
let ai = { finalScore: 5 };

try {
  ai = await getAIScore({
    harassment: features.harassmentCount,
    dark: features.darkAreaCount,
    robbery: features.robberyCount,
    other: features.otherCount,
    distance: features.routeLengthKm
  });
} catch (e) {
  console.warn("AI backend failed, using fallback score");
}

  let score = 10 - ai.finalScore;

  if (score > 9.5) score = 9.5;
  if (score < 1) score = 1;

  const explanation = generateExplanation(features);

  const timeSelect = document.getElementById("time-select");
  const timeBand = timeSelect && timeSelect.value ? timeSelect.value : "day";
  const riskProbability = predictRiskProbability(features, timeBand);

  return {
    score,
    nearHotspots,
    features,
    riskProbability,
    ai
  };
}

async function submitCrowdReport(report) {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Failed to submit crowd report:", text);
      return { ok: false };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    console.error("Error submitting crowd report:", err);
    return { ok: false };
  }
}

async function fetchCrowdStats(routeId) {
  if (!routeId) return null;
  try {
    const res = await fetch(
      `${BACKEND_BASE_URL}/api/reports/summary?routeId=` +
      encodeURIComponent(routeId)
    );
    if (!res.ok) {
      console.error("Failed to fetch crowd stats:", await res.text());
      return null;
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error fetching crowd stats:", err);
    return null;
  }
}

async function updateSummary(result) {
  if (!result || !CURRENT_ROUTE_ID) {
    renderSummary(result, null);
    return;
  }

  const crowdStats = await fetchCrowdStats(CURRENT_ROUTE_ID);
  renderSummary(result, crowdStats);
}

function renderSummary(result, crowdStats) {
  const el = document.getElementById("safety-summary");

  if (!result) {
    el.innerHTML = `<p>No route evaluated yet.</p>`;
    return;
  }

  const { score, nearHotspots, riskProbability, features } = result;
  const explanations = generateExplanation(features);
  const total = nearHotspots.length;

  const byType = {};
  nearHotspots.forEach((h) => {
    byType[h.type] = (byType[h.type] || 0) + 1;
  });

  const womenCount = nearHotspots.filter((h) =>
    WOMEN_SAFETY_TYPES.includes(h.type)
  ).length;
  const generalCount = total - womenCount;

  const typeLines = Object.keys(byType)
    .map((t) => `<li>${t}: ${byType[t]} hotspot(s)</li>`)
    .join("");

  const { activityDensity, isolationScore } = features;

  let crowdLabel;
  if (activityDensity < 0.15) {
    crowdLabel = "Very low (mostly empty segments)";
  } else if (activityDensity < 0.45) {
    crowdLabel = "Moderate (some people / traffic)";
  } else {
    crowdLabel = "High (busy, many people / vehicles)";
  }

  let isolationLabel;
  if (isolationScore < 0.2) {
    isolationLabel = "Low – mostly central / well-connected areas";
  } else if (isolationScore < 0.6) {
    isolationLabel = "Medium – mix of central and slightly isolated stretches";
  } else {
    isolationLabel = "High – long, empty or outer-ring segments";
  }

  const recent3mTotal = nearHotspots.filter((h) => h.is_recent_3m).length;
  const recent3mWomen = nearHotspots.filter(
    (h) => h.is_recent_3m && WOMEN_SAFETY_TYPES.includes(h.type)
  ).length;

  let timeBand = "day";
  const sel = document.getElementById("time-select");
  if (sel && sel.value) timeBand = sel.value;

  const timeLabels = {
    day: "Daytime (7 AM – 6 PM)",
    evening: "Evening (6 PM – 10 PM)",
    night: "Late night (10 PM – 5 AM)",
  };

  const label =
    score < 4
      ? "Unsafe route for women"
      : score < 7
        ? "Moderately safe route"
        : "Safe route for women";

  // 🔥 AI EXPLANATION LOGIC
let explanation = [];

if (features.darkAreaCount > 0) {
  explanation.push("⚠️ Dark areas detected");
}

if (features.harassmentCount > 0) {
  explanation.push("🚨 Harassment-prone zones nearby");
}

if (features.robberyCount > 0) {
  explanation.push("💰 Robbery risk areas present");
}

if (features.activityDensity > 0.4) {
  explanation.push("✅ Good crowd presence (safer)");
}

if (features.isolationScore > 0.5) {
  explanation.push("⚠️ Isolated route segments");
}

if (explanation.length === 0) {
  explanation.push("✅ No major risks detected");
}

  const riskPercent = (riskProbability * 100).toFixed(1);

  let crowdOpinionLine = "No community feedback for this route yet.";
  let issuesLine = "No specific issues reported yet.";

  if (crowdStats && typeof crowdStats.count === "number") {
    const totalVotes = crowdStats.count;
    if (totalVotes > 0) {
      const pct = (n) => ((n / totalVotes) * 100).toFixed(0);
      crowdOpinionLine = `
        Based on <strong>${totalVotes}</strong> community report(s): 
        <strong>${pct(crowdStats.safe || 0)}%</strong> felt safe, 
        <strong>${pct(crowdStats.ok || 0)}%</strong> neutral, 
        <strong>${pct(crowdStats.unsafe || 0)}%</strong> felt unsafe.
      `;

      if (Array.isArray(crowdStats.topIssues) && crowdStats.topIssues.length) {
        issuesLine =
          "Most reported issues: " +
          crowdStats.topIssues
            .map((i) => `${i.type} (${i.count})`)
            .join(", ");
      }
    }
  }

  el.innerHTML = `
  <div class="summary-card">

    <div class="score-box">
      <div class="score">${score.toFixed(1)} / 10</div>
      <div class="score-label">${label}</div>
    </div>

    <div class="risk-box">
      ⚠️ Risk: <strong>${(riskProbability * 100).toFixed(1)}%</strong>
    </div>

    <div class="info-box">
      <p>📍 Total hotspots: <strong>${total}</strong></p>
      <p>👩 Women safety: <strong>${womenCount}</strong></p>
      <p>🚦 Other risks: <strong>${generalCount}</strong></p>
    </div>

    <div class="explain-box">
      <strong>Why this score?</strong>
      ${explanations.map(e => `<div>${e}</div>`).join("")}
    </div>

    <p style="margin-top:.8rem;font-size:.85rem;color:#ccc;">
      <strong>Algorithm Analysis:</strong><br/>
      To find the nearest distance accurately, the system evaluates both <strong>Dijkstra's Algorithm</strong> and <strong>A* Search</strong>. 
      A* is primarily selected because its heuristic guidance specifically targets the destination, making it exceptionally efficient for geographical routing compared to Dijkstra's unguided radial expansion. 
      The path movement costs are dynamically weighted by hotspot severity (dark areas, harassment zones) to ensure the <em>safest</em> optimal path is prioritized.
    </p>

    <p style="margin-top:.4rem;font-size:.8rem;">
  <strong>Why this score?</strong><br/>
  ${explanation.join("<br/>")}
</p>

  </div>
`;




}

function setStartMarker(lat, lng) {
  const latlng = L.latLng(lat, lng);
  if (startMarker) map.removeLayer(startMarker);

  startMarker = L.marker(latlng).addTo(map).bindPopup("Start").openPopup();
  document.getElementById("start-coords").textContent = formatCoords(lat, lng);
}

function setEndMarker(lat, lng) {
  const latlng = L.latLng(lat, lng);
  if (endMarker) map.removeLayer(endMarker);

  endMarker = L.marker(latlng).addTo(map).bindPopup("End").openPopup();
  document.getElementById("end-coords").textContent = formatCoords(lat, lng);
}

function initMap() {
  map = L.map("map").setView(
    [CITY_CENTER.lat, CITY_CENTER.lng],
    CITY_CENTER.zoom
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  routesLayerGroup = L.layerGroup().addTo(map);

  map.on("click", (e) => handleMapClick(e.latlng));
}

function handleMapClick(latlng) {
  if (!startMarker) setStartMarker(latlng.lat, latlng.lng);
  else if (!endMarker) setEndMarker(latlng.lat, latlng.lng);
  else setEndMarker(latlng.lat, latlng.lng);
}

function clearRouteAndMarkers() {
  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);

  startMarker = null;
  endMarker = null;
  CURRENT_ROUTE_ID = null;
  LAST_ROUTE_RESULT = null;

  document.getElementById("start-coords").textContent = "Not set";
  document.getElementById("end-coords").textContent = "Not set";

  document.getElementById("start-search").value = "";
  document.getElementById("end-search").value = "";

  document.getElementById("start-suggestions").innerHTML = "";
  document.getElementById("end-suggestions").innerHTML = "";

  routesLayerGroup.clearLayers();

  hotspotMarkers.forEach((m) => map.removeLayer(m));
  hotspotMarkers = [];

  renderSummary(null, null);

  const crowdPanel = document.getElementById("crowd-panel");
  if (crowdPanel) crowdPanel.style.display = "none";
}

function scrollToRiskSection() {
  const sidebar = document.querySelector(".sidebar");
  const summary = document.getElementById("safety-summary");
  if (!sidebar || !summary) return;

  sidebar.scrollTo({
    top: summary.offsetTop - 20,
    behavior: "smooth",
  });
}

async function fetchRoutes(start, end) {
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&alternatives=3`;

  console.log("Fetching route from:", url);

  try {
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      console.error("OSRM Error:", text);
      throw new Error("Routing failed");
    }

    const data = await res.json();

    console.log("OSRM response:", data);

    if (!data.routes || data.routes.length === 0) {
      throw new Error("No routes found");
    }

    return data.routes;

  } catch (err) {
    console.error("Fetch route error:", err);
    throw err;
  }
}


async function findSafestRoute() {
  if (!startMarker || !endMarker) {
    alert("Set both Start and End first.");
    return;
  }

  const start = startMarker.getLatLng();
  const end = endMarker.getLatLng();

  routesLayerGroup.clearLayers();
  hotspotMarkers.forEach((m) => map.removeLayer(m));
  hotspotMarkers = [];
  renderSummary(null, null);



  try {

    // ✅ SHOW LOADING MESSAGE
document.getElementById("safety-summary").innerHTML =
  "⏳ Calculating safest route...";

    const routes = await fetchRoutes(start, end);

    let bestRoute = null;
    let bestResult = null;
    let allResults = [];

    let processedRoutes = [];

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const coords = route.geometry.coordinates;

      const result = await computeSafetyScore(coords);

      processedRoutes.push({ route, coords, result, index: i });

      allResults.push({
        index: i,
        score: result.score
      });

      if (!bestResult || result.score > bestResult.score) {
        bestResult = result;
        bestRoute = { route, index: i };
      }
    }

    // ✅ DRAW ROUTES: Alternatives first, Best route last (on top)
    for (let pr of processedRoutes) {
      const isBest = pr.index === bestRoute.index;
      if (!isBest) {
        const coordsLatLng = pr.coords.map(([lng, lat]) => [lat, lng]);
        L.polyline(coordsLatLng, {
          color: "#6B7280", // Gray for alternatives
          weight: 4,
          opacity: 0.6
        }).addTo(routesLayerGroup);
      }
    }

    if (bestRoute) {
      const bestPr = processedRoutes.find(pr => pr.index === bestRoute.index);
      const coordsLatLng = bestPr.coords.map(([lng, lat]) => [lat, lng]);
      L.polyline(coordsLatLng, {
        color: "#10b981", // Bright green for selected
        weight: 6,
        opacity: 1.0
      }).addTo(routesLayerGroup);
    }

    if (bestRoute) {
      const coordsLatLng = bestRoute.route.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng]
      );
      map.fitBounds(L.latLngBounds(coordsLatLng), { padding: [40, 40] });

      CURRENT_ROUTE_ID = buildRouteId(start, end);
      LAST_ROUTE_RESULT = bestResult;
    }
    await updateSummary(bestResult);

    // ⭐ ADD THIS LINE
    displayRouteComparison(allResults, bestRoute.index);

    renderHotspotsForRoute(bestResult.nearHotspots);
    renderHeatmap(bestResult.nearHotspots);
    scrollToRiskSection();

    const crowdPanel = document.getElementById("crowd-panel");
    if (crowdPanel) crowdPanel.style.display = "block";
  } 
  catch (err) {
  console.error("Route error:", err);

  // ❌ Don't block UI if route already drawn
  const el = document.getElementById("safety-summary");

  if (el) {
    el.innerHTML = `
      <p style="color:orange;">
        ⚠️ Route shown, but some AI features failed. Check backend.
      </p>
    `;
  }
}


}

function useCurrentLocationAsStart() {
  if (!navigator.geolocation) {
    alert("Geolocation unsupported.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      console.log("Your location:", lat, lng);

      setStartMarker(lat, lng);
      map.setView([lat, lng], 14);
    },
    (err) => {
      console.error("Geolocation error:", err);
      alert("Unable to get your location.");
    },
    {
      enableHighAccuracy: false,
      timeout: 30000,
      maximumAge: 300000,
    }
  );
}

async function geocodeInRaipur(query) {
  const url =
    "https://nominatim.openstreetmap.org/search" +
    "?format=json" +
    "&limit=1" +
    "&countrycodes=in" +
    "&bounded=1" +
    "&viewbox=" +
    RAIPUR_VIEWBOX +
    "&q=" +
    encodeURIComponent(query + " Raipur");

  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!res.ok) throw new Error("Geocoding failed");

  const data = await res.json();
  if (!data || data.length === 0) return null;

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    display_name: data[0].display_name,
  };
}

async function searchSuggestionsInRaipur(query, limit = 5) {
  const url =
    "https://nominatim.openstreetmap.org/search" +
    "?format=json" +
    "&limit=" +
    limit +
    "&countrycodes=in" +
    "&bounded=1" +
    "&viewbox=" +
    RAIPUR_VIEWBOX +
    "&q=" +
    encodeURIComponent(query + " Raipur");

  const res = await fetch(url, {
    headers: { "Accept-Language": "en" },
  });

  if (!res.ok) throw new Error("Suggestion request failed");

  const data = await res.json();
  return data || [];
}

function setupAutocomplete(inputId, listId, onSelectPlace) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);

  let debounceTimer = null;
  let lastQuery = "";

  input.addEventListener("input", () => {
    const q = input.value.trim();

    if (debounceTimer) clearTimeout(debounceTimer);

    if (q.length < 3) {
      list.innerHTML = "";
      list.style.display = "none";
      lastQuery = "";
      return;
    }

    debounceTimer = setTimeout(async () => {
      if (q === lastQuery) return;
      lastQuery = q;

      try {
        const results = await searchSuggestionsInRaipur(q, 5);
        list.innerHTML = "";

        if (!results || results.length === 0) {
          list.style.display = "none";
          return;
        }

        results.forEach((place) => {
          const li = document.createElement("li");
          li.className = "suggestion-item";
          li.textContent = place.display_name;

          li.addEventListener("mousedown", (e) => {
            e.preventDefault();
            onSelectPlace(place);
            input.value = place.display_name;
            list.innerHTML = "";
            list.style.display = "none";
          });

          list.appendChild(li);
        });

        list.style.display = "block";
      } catch (err) {
        console.error("Suggestion error:", err);
      }
    }, 150);
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      list.innerHTML = "";
      list.style.display = "none";
    }
  });

} // End of setupAutocomplete

    function displayRouteComparison(results, bestIndex) {
  const el = document.getElementById("safety-summary");

  let html = `<h4 style="margin-top:10px;">Route Comparison</h4>`;

  results.forEach((r) => {
    const isBest = r.index === bestIndex;

    html += `
      <p style="font-size:0.85rem;">
        Route ${r.index + 1} → Score: 
        <strong>${r.score.toFixed(2)}</strong>
        ${isBest ? " ⭐ BEST" : ""}
      </p>
    `;
  });

  el.innerHTML += html;
}

async function searchStartLocation() {
  const input = document.getElementById("start-search");
  const query = input.value.trim();

  if (!query) {
    alert("Enter start location.");
    return;
  }

  try {
    const res = await geocodeInRaipur(query);
    if (!res) {
      alert("No location found.");
      return;
    }

    setStartMarker(res.lat, res.lng);

    if (endMarker) {
      const bounds = L.latLngBounds([
        endMarker.getLatLng(),
        L.latLng(res.lat, res.lng),
      ]);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      map.setView([res.lat, res.lng], 14);
    }
  } catch (err) {
    console.error(err);
    alert("Failed to search start location.");
  }
}

async function searchEndLocation() {
  const input = document.getElementById("end-search");
  const query = input.value.trim();

  if (!query) {
    alert("Enter end location.");
    return;
  }

  try {
    const res = await geocodeInRaipur(query);
    if (!res) {
      alert("No location found.");
      return;
    }

    setEndMarker(res.lat, res.lng);

    if (startMarker) {
      const bounds = L.latLngBounds([
        startMarker.getLatLng(),
        L.latLng(res.lat, res.lng),
      ]);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      map.setView([res.lat, res.lng], 14);
    }
  } catch (err) {
    console.error(err);
    alert("Failed to search end location.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadHotspots();
  renderSummary(null, null);

  const crowdForm = document.getElementById("crowd-form");
  if (crowdForm) {
    crowdForm.addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  const btnClear = document.getElementById("btn-clear");
  if (btnClear) btnClear.addEventListener("click", clearRouteAndMarkers);

  const btnFind = document.getElementById("btn-find");
  if (btnFind) btnFind.addEventListener("click", () => findSafestRoute());

  const btnLocate = document.getElementById("btn-locate");
  if (btnLocate)
    btnLocate.addEventListener("click", () => useCurrentLocationAsStart());

  const btnSearchStart = document.getElementById("btn-search-start");
  if (btnSearchStart) btnSearchStart.addEventListener("click", searchStartLocation);

  const btnSearchEnd = document.getElementById("btn-search-end");
  if (btnSearchEnd) btnSearchEnd.addEventListener("click", searchEndLocation);

  const startInput = document.getElementById("start-search");
  if (startInput) {
    startInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchStartLocation();
      }
    });
  }

  const endInput = document.getElementById("end-search");
  if (endInput) {
    endInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchEndLocation();
      }
    });
  }

  setupAutocomplete("start-search", "start-suggestions", (place) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);

    setStartMarker(lat, lng);

    if (endMarker) {
      const bounds = L.latLngBounds([
        endMarker.getLatLng(),
        L.latLng(lat, lng),
      ]);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  });

  setupAutocomplete("end-search", "end-suggestions", (place) => {
    const lat = parseFloat(place.lat);
    const lng = parseFloat(place.lon);

    setEndMarker(lat, lng);

    if (startMarker) {
      const bounds = L.latLngBounds([
        startMarker.getLatLng(),
        L.latLng(lat, lng),
      ]);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  });

  let selectedFeeling = null;

  const ratingButtons = document.querySelectorAll(".crowd-btn");
  ratingButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedFeeling = btn.dataset.rating || null;
      ratingButtons.forEach((b) => b.classList.remove("primary"));
      btn.classList.add("primary");
    });
  });

  const submitBtn = document.getElementById("crowd-submit");
  const statusEl = document.getElementById("crowd-status");

  if (submitBtn) {
    submitBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!CURRENT_ROUTE_ID || !LAST_ROUTE_RESULT) {
        if (statusEl)
          statusEl.textContent = "First calculate a route before submitting.";
        return;
      }

      if (!selectedFeeling) {
        if (statusEl) statusEl.textContent = "Select how the route felt.";
        return;
      }

      const issueEl = document.getElementById("crowd-issue");
      const commentEl = document.getElementById("crowd-comment");

      const issue = issueEl ? issueEl.value : "";
      const comment = commentEl ? commentEl.value.trim() : "";

      const timeSelect = document.getElementById("time-select");
      const timeBand =
        timeSelect && timeSelect.value ? timeSelect.value : "day";

      const report = {
        routeId: CURRENT_ROUTE_ID,
        feeling: selectedFeeling,
        issueType: issue || null,
        timeBand,
        comment: comment || null,
      };

      const resp = await submitCrowdReport(report);
      if (!resp.ok) {
        if (statusEl)
          statusEl.textContent =
            "Could not submit feedback. Please try again.";
        return;
      }

      if (statusEl) statusEl.textContent = "Thanks! Your report was saved.";

      await updateSummary(LAST_ROUTE_RESULT);
    });
  }

  const crowdPanel = document.getElementById("crowd-panel");
  if (crowdPanel) crowdPanel.style.display = "none";
});




function renderHeatmap(nearHotspots) {
  if (heatLayer) {
    map.removeLayer(heatLayer);
  }

  const heatData = nearHotspots.map(h => [
    h.lat,
    h.lng,
    (h.severity || 1) * 0.5
  ]);

  heatLayer = L.heatLayer(heatData, {
    radius: 25,
    blur: 15,
    maxZoom: 17
  }).addTo(map);
}

function generateExplanation(features) {
  const reasons = [];

  if (features.darkAreaCount > 2) {
    reasons.push("⚠️ Multiple dark/low-light areas detected");
  }

  if (features.harassmentCount > 1) {
    reasons.push("⚠️ Harassment-prone zones on route");
  }

  if (features.robberyCount > 0) {
    reasons.push("⚠️ Robbery risk areas present");
  }

  if (features.isolationScore > 0.6) {
    reasons.push("⚠️ Route passes through isolated areas");
  }

  if (features.activityDensity > 0.4) {
    reasons.push("✅ Good crowd presence (safer)");
  }

  if (features.recent3mWomenCount > 1) {
    reasons.push("⚠️ Recent women-safety incidents reported");
  }

  if (reasons.length === 0) {
    reasons.push("✅ No major risk factors detected");
  }

  return reasons;
}




