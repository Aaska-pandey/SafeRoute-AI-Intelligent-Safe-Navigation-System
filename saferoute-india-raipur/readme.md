# SafeRoute – Raipur  
AI-assisted navigation with women-safety scoring, hotspot analysis, and community reporting.

---

## Overview
SafeRoute is a map-based routing system designed to estimate route safety levels for women.  
It combines AI risk scoring, OpenStreetMap hotspot data, and community feedback to determine the safest path between two locations in Raipur.

This project is a working prototype with a Node.js backend, hotspot dataset generator, and a complete frontend UI built on Leaflet.

---

## Features

### 🔹 AI Safety Scoring (Logistic Regression)
The model considers:
- Women-safety hotspots (harassment, dark areas, robbery)
- Road isolation score
- Activity (crowd) levels
- Recent 3-month hotspot recency
- Route length
- Time of travel (day/evening/night)
  
Produces a 1–10 safety score & 0–100 AI risk index.

---

### 🔹 Interactive Map
- Multiple OSRM driving routes  
- Best (safest) route auto-selected  
- Hotspots shown with severity colors  
- Click-to-set start and destination  
- Autocomplete search for Raipur  

---

### 🔹 Crowd Reporting System
Users can submit:
- Safe / Okay / Unsafe rating  
- Issue type (harassment, stalking, poor lighting, robbery, rash driving, etc.)  
- Optional comments  

All reports are stored in the backend and summarized per route.

---

## Project Structure

```
SafeRoute/
│── index.html
│── style.css
│── script.js
│── README.txt
│
├── data/
│   ├── ai_model_weights.json
│   ├── raipur_hotspots.json
│
├── backend/
│   ├── server.js
│   ├── reports.db.json
│   └── package.json
│
└── data-tools/
    ├── build_raipur_hotspots.py
    
```

---

## Tech Stack

### Frontend
- Leaflet.js  
- Vanilla JavaScript  
- OSRM Routing API  
- Nominatim Geocoding  
- Custom AI risk engine  

### Backend
- Node.js  
- Express.js  
- Local JSON datastore  

### Data Layer
- Python OSM Overpass downloader  
- Hotspot classifier  
- Logistic regression weights  

---

## Running the Project

### 1️⃣ Start Backend
```
cd backend
npm install
node server.js
```
Backend defaults to:  
**http://localhost:4000**

---

### 2️⃣ Start Frontend
Open **index.html** directly  
OR  
Use VS Code → **Live Server**

---

## How SafeRoute Works

### Route Evaluation
1. User selects start and end  
2. OSRM generates alternative routes  
3. System scans hotspots near each path  
4. Features extracted (density, lighting, isolation, crowd)  
5. AI model predicts risk score  
6. Best (safest) route highlighted  

### Crowd Feedback Integration
- Stored in backend  
- Summarized instantly in UI  
- Over time improves safety context  

---

## Important Files

| File | Description |
|------|-------------|
| `script.js` | Main frontend logic (routing, scoring, UI, crowd reports) |
| `ai_model_weights.json` | Logistic regression parameters |
| `raipur_hotspots.json` | Semi-realistic hotspot dataset |
| `server.js` | Node backend for saving & summarizing community reports |
| `build_raipur_hotspots.py` | Python tool to regenerate hotspot dataset |

---

## Disclaimer
SafeRoute is a **prototype**, not a certified safety tool.  
Predictions and scores are **estimates** based on public map data and heuristics.

Use judgement when traveling.

---

## Future Enhancements
- Deep-learning risk model  
- Foot-traffic estimation using mobility data  
- Integration with police FIR datasets  
- Live lighting & CCTV detection  
- Mobile app version  

---



