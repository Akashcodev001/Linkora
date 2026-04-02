import { expandKnowledgeGraph, getKnowledgeGraph, getItemSubgraph } from '../../helpers/graph.helper.js';

const SERVICE_DEFAULT_MAX_NODES = 100;
const SERVICE_DEFAULT_MAX_EDGES = 800;

function normalizeLimit(value, fallback, min = 1, max = 1000) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export async function getGraphService(userId, options = {}) {
    return getKnowledgeGraph(userId, {
        maxNodes: normalizeLimit(options.maxNodes, SERVICE_DEFAULT_MAX_NODES, 1, 100),
        maxEdges: normalizeLimit(options.maxEdges, SERVICE_DEFAULT_MAX_EDGES, 1, 1000),
    });
}

export async function getItemGraphService(userId, itemId) {
    const subgraph = await getItemSubgraph(userId, itemId);
    if (!subgraph) {
        const error = new Error('Item not found');
        error.statusCode = 404;
        throw error;
    }

    return subgraph;
}

export async function expandGraphService(userId, options = {}) {
    return expandKnowledgeGraph(userId, {
        centralNodeId: options.centralNodeId,
        depth: normalizeLimit(options.depth, 1, 1, 5),
        page: options.page,
        cursor: options.cursor,
        pageSize: normalizeLimit(options.pageSize, 50, 1, 100),
    });
}
