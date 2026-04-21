const fs = require('fs');
let sServer = fs.readFileSync('backend/server.js', 'utf8');

// Fix 1: features object
sServer = sServer.replace(
    /harassment_count: Math.floor\(Math.random\(\) \* 5\),[\s\S]*?route_length_km: dijkstraPath.length/,
    'harassment: Math.floor(Math.random() * 5),\n        robbery: Math.floor(Math.random() * 3),\n        dark: Math.floor(Math.random() * 4),\n        other: 0,\n        distance: dijkstraPath.length'
);

// Fix 2: safety variable
sServer = sServer.replace('console.log("Prediction:", safety);', 'console.log("Prediction:", result);');

// Fix 3: path1 and path2
sServer = sServer.replace('dijkstra_path: path1,\r\n    astar_path: path2,', 'dijkstra_path: dijkstraPath,\n    astar_path: astarPath,');
sServer = sServer.replace('dijkstra_path: path1,\n    astar_path: path2,', 'dijkstra_path: dijkstraPath,\n    astar_path: astarPath,');

// Fix 4: PORT
sServer = sServer.replace('app.listen(3000', 'app.listen(PORT');
sServer = sServer.replace('http://localhost:3000', 'http://localhost:${PORT}');

fs.writeFileSync('backend/server.js', sServer);

let sClient = fs.readFileSync('script.js', 'utf8');

// Fix 1: pass routeFeatures
sClient = sClient.replace('async function getAIScore() {', 'async function getAIScore(routeFeatures) {');

// Fix 2: change URL and source/destination
sClient = sClient.replace('"http://localhost:3000/find-route"', '`${BACKEND_BASE_URL}/api/score-route`');
sClient = sClient.replace('source: "A",\r\n        destination: "D"', 'features: routeFeatures');
sClient = sClient.replace('source: "A",\n        destination: "D"', 'features: routeFeatures');

// Fix 3: fixing scope of displayRouteComparison
// Look for document.addEventListener("click", (e) => { ... });
// And properly close it before displayRouteComparison
const autocompleteEnd = `  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      list.innerHTML = "";
      list.style.display = "none";
    }
  });`;

const autocompleteEndFixed = `  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      list.innerHTML = "";
      list.style.display = "none";
    }
  });

} // End of setupAutocomplete`;

sClient = sClient.replace(autocompleteEnd, autocompleteEndFixed);

// Fix 4: eliminate generateExplanation copy and the stray "}" at the end
const badEnding = `}
function generateExplanation(features) {
  let reasons = [];

  if (features.darkAreaCount > 2) {
    reasons.push("⚠️ Many dark areas detected");
  }

  if (features.harassmentCount > 1) {
    reasons.push("⚠️ Harassment-prone zones nearby");
  }

  if (features.isolationScore > 0.5) {
    reasons.push("⚠️ Route is isolated");
  }

  if (features.activityDensity > 0.5) {
    reasons.push("✅ Good crowd presence (safer)");
  }

  if (reasons.length === 0) {
    reasons.push("✅ No major risk factors");
  }

  return reasons;
}


}`;

const regexBadEnding = /\}\s*function generateExplanation\(features\) \{[\s\S]*?return reasons;\s*\}\s*\}/;
sClient = sClient.replace(regexBadEnding, '}');

fs.writeFileSync('script.js', sClient);

console.log("Fixes applied successfully!");
