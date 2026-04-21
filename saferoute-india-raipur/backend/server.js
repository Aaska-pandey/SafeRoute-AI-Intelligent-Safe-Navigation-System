// const { getFinalScore } = require("./ai_model");
const express = require("express");
// const bodyParser = require('body-parser');
const cors = require("cors");

const Graph = require('./graph');
const dijkstra = require('./dijkstra');
const aStar = require('./astar');
const { getFinalScore } = require('./ai_model');


const fs = require("fs");
const path = require("path");

const app = express();

// ================= GRAPH SETUP =================

// Create graph object
const graph = new Graph();

// Add nodes (locations)
graph.addNode("A");
graph.addNode("B");
graph.addNode("C");
graph.addNode("D");

// Add edges (roads with distance)
graph.addEdge("A", "B", 5);
graph.addEdge("A", "C", 8);
graph.addEdge("B", "D", 6);
graph.addEdge("C", "D", 3);

// ==============================================
const PORT = process.env.PORT || 0;

// ✅ FIRST middleware
app.use(cors());
app.use(express.json());

// ✅ Serve frontend
app.use(express.static(path.join(__dirname, '../')));

// ✅ Root route (VERY IMPORTANT)
app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../index.html'));
});



const DATA_FILE = path.join(__dirname, "data", "crowd_reports.json");


function readData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return {};
        }
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        if (!raw.trim()) return {};
        return JSON.parse(raw);
    } catch (err) {
        console.error("Error reading crowd_reports.json:", err);
        return {};
    }
}


function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
        console.error("Error writing crowd_reports.json:", err);
    }
}


app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "SafeRoute backend running" });
});


app.post("/api/reports", (req, res) => {
    const { routeId, feeling, issueType, timeBand, comment } = req.body || {};

    if (!routeId || !feeling) {
        return res.status(400).json({
            error: "routeId and feeling are required fields",
        });
    }

    if (!["safe", "ok", "unsafe"].includes(feeling)) {
        return res.status(400).json({
            error: "feeling must be one of: 'safe', 'ok', 'unsafe'",
        });
    }

    const allowedTimeBands = ["day", "evening", "night"];
    const tb = allowedTimeBands.includes(timeBand) ? timeBand : "day";

    const report = {
        routeId,
        createdAt: new Date().toISOString(),
        feeling,
        issueType: issueType || null,
        timeBand: tb,
        comment: comment || null,
    };

    const data = readData();
    if (!data[routeId]) data[routeId] = [];
    data[routeId].push(report);
    writeData(data);

    res.status(201).json({ ok: true, report });
});


app.get("/api/reports", (req, res) => {
    const routeId = req.query.routeId;
    if (!routeId) {
        return res.status(400).json({ error: "routeId query param is required" });
    }

    const data = readData();
    const reports = data[routeId] || [];
    res.json({ routeId, count: reports.length, reports });
});


app.get("/api/reports/summary", (req, res) => {
    const routeId = req.query.routeId;
    if (!routeId) {
        return res.status(400).json({ error: "routeId query param is required" });
    }

    const data = readData();
    const arr = data[routeId] || [];

    if (arr.length === 0) {
        return res.json({
            routeId,
            count: 0,
            safe: 0,
            ok: 0,
            unsafe: 0,
            topIssues: [],
        });
    }

    let safe = 0,
        ok = 0,
        unsafe = 0;
    const issueCount = {};

    arr.forEach((r) => {
        if (r.feeling === "safe") safe++;
        else if (r.feeling === "ok") ok++;
        else if (r.feeling === "unsafe") unsafe++;

        if (r.issueType) {
            issueCount[r.issueType] = (issueCount[r.issueType] || 0) + 1;
        }
    });

    const topIssues = Object.keys(issueCount)
        .sort((a, b) => issueCount[b] - issueCount[a])
        .slice(0, 3)
        .map((t) => ({ type: t, count: issueCount[t] }));

    res.json({
        routeId,
        count: arr.length,
        safe,
        ok,
        unsafe,
        topIssues,
    });
});

app.post("/api/score-route", (req, res) => {
    const { features } = req.body;

    if (!features) {
        return res.status(400).json({ error: "Missing features" });
    }

    const result = getFinalScore(features);

    res.json(result);
});

// ================= ROUTE API =================

app.post('/find-route', (req, res) => {

    console.log("Request received:", req.body);

    const { source, destination } = req.body;

    // 1️⃣ Run Dijkstra
    const dijkstraPath = dijkstra(graph, source, destination);

    // 2️⃣ Run A*
    const astarPath = aStar(graph, source, destination);

    console.log("Dijkstra Path:", dijkstraPath);
    console.log("A* Path:", astarPath);

    // 3️⃣ Create features for ML model
    const features = {
        harassment: Math.floor(Math.random() * 5),
        robbery: Math.floor(Math.random() * 3),
        dark: Math.floor(Math.random() * 4),
        other: 0,
        distance: dijkstraPath.length
    };

    console.log("Features:", features);

    // 4️⃣ Predict safety
    const result = getFinalScore(features);

    console.log("Prediction:", result);

    // 5️⃣ Send response
    res.json({
    dijkstra_path: dijkstraPath,
    astar_path: astarPath,
    features: features,
    logScore: result.logScore,
    rfScore: result.rfScore,
    finalScore: result.finalScore
});

});

// ============================================



const server = app.listen(PORT, () => {
    const port = server.address().port;
    console.log(`\x1b[32m=============================================\x1b[0m`);
    console.log(`\x1b[32m✅ SafeRoute Backend Successfully Started!\x1b[0m`);
    console.log(`\x1b[36m👉 Open your browser at: http://localhost:${port}\x1b[0m`);
    console.log(`\x1b[32m=============================================\x1b[0m`);
});
