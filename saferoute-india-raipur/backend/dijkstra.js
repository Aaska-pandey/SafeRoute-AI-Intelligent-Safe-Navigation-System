function dijkstra(graph, start, end) {
    let distances = {};
    let prev = {};
    let visited = new Set();

    for (let node in graph.nodes) {
        distances[node] = Infinity;
        prev[node] = null;
    }

    distances[start] = 0;

    while (true) {
        let closestNode = null;

        for (let node in distances) {
            if (!visited.has(node)) {
                if (closestNode === null || distances[node] < distances[closestNode]) {
                    closestNode = node;
                }
            }
        }

        if (closestNode === null) break;

        visited.add(closestNode);

        for (let neighbor of graph.nodes[closestNode]) {
            let newDist = distances[closestNode] + neighbor.weight;
            if (newDist < distances[neighbor.node]) {
                distances[neighbor.node] = newDist;
                prev[neighbor.node] = closestNode;
            }
        }
    }

    // reconstruct path
    let path = [];
    let current = end;

    while (current) {
        path.unshift(current);
        current = prev[current];
    }

    return path;
}

module.exports = dijkstra;