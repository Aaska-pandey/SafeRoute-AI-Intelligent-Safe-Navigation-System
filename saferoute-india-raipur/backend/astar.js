function heuristic(a, b) {
    return 1; // simple heuristic (can improve later)
}

function aStar(graph, start, end) {
    let openSet = [start];
    let cameFrom = {};

    let gScore = {};
    let fScore = {};

    for (let node in graph.nodes) {
        gScore[node] = Infinity;
        fScore[node] = Infinity;
    }

    gScore[start] = 0;
    fScore[start] = heuristic(start, end);

    while (openSet.length > 0) {
        let current = openSet.reduce((a, b) =>
            fScore[a] < fScore[b] ? a : b
        );

        if (current === end) {
            let path = [];
            while (current) {
                path.unshift(current);
                current = cameFrom[current];
            }
            return path;
        }

        openSet = openSet.filter(n => n !== current);

        for (let neighbor of graph.nodes[current]) {
            let tempG = gScore[current] + neighbor.weight;

            if (tempG < gScore[neighbor.node]) {
                cameFrom[neighbor.node] = current;
                gScore[neighbor.node] = tempG;
                fScore[neighbor.node] = tempG + heuristic(neighbor.node, end);

                if (!openSet.includes(neighbor.node)) {
                    openSet.push(neighbor.node);
                }
            }
        }
    }

    return [];
}

module.exports = aStar;