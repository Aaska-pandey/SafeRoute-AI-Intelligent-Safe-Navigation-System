class Graph {
    constructor() {
        this.nodes = {};
    }

    addNode(node) {
        this.nodes[node] = [];
    }

    addEdge(node1, node2, weight) {
        this.nodes[node1].push({ node: node2, weight: weight });
        this.nodes[node2].push({ node: node1, weight: weight });
    }
}

module.exports = Graph;


