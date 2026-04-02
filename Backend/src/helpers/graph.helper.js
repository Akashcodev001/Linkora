/**
 * Graph helper - Generate knowledge graph nodes and edges
 * Phase 1: Tag and collection-based relationships
 * Phase 2+: Semantic relationships via embeddings and vector similarity
 */

import Item from '../models/item.model.js';
import Collection from '../models/collection.model.js';

const DEFAULT_MAX_GRAPH_NODES = 100;
const DEFAULT_MAX_GRAPH_EDGES = 800;
const DEFAULT_EXPAND_PAGE_SIZE = 50;

function clampGraphLimit(value, fallback, min = 1, max = 10000) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function decodeCursor(cursor) {
    if (!cursor) return 0;

    const direct = Number(cursor);
    if (Number.isFinite(direct) && direct >= 0) {
        return Math.floor(direct);
    }

    try {
        const decoded = Buffer.from(String(cursor), 'base64url').toString('utf-8');
        const parsed = Number(decoded);
        if (Number.isFinite(parsed) && parsed >= 0) {
            return Math.floor(parsed);
        }
    } catch {
        return 0;
    }

    return 0;
}

function encodeCursor(offset) {
    return Buffer.from(String(offset), 'utf-8').toString('base64url');
}

/**
 * Generate graph nodes from items and collections
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Graph nodes
 */
export async function generateGraphNodes(userId) {
    const [items, collections] = await Promise.all([
        Item.find({ userId, isDeleted: false }, { _id: 1, title: 1, type: 1 }).lean(),
        Collection.find({ userId, isDeleted: false }, { _id: 1, name: 1 }).lean(),
    ]);

    const itemNodes = items.map((item) => ({
        id: item._id.toString(),
        label: item.title,
        type: 'item',
        category: item.type,
    }));

    const collectionNodes = collections.map((collection) => ({
        id: collection._id.toString(),
        label: collection.name,
        type: 'collection',
    }));

    return [...itemNodes, ...collectionNodes];
}

/**
 * Generate graph edges based on tags and collections
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Graph edges
 */
export async function generateGraphEdges(userId) {
    const [itemsWithTags, collectionWithItems] = await Promise.all([
        Item.find({ userId, isDeleted: false }, { _id: 1, tags: 1 })
            .lean(),
        Collection.find({ userId, isDeleted: false }, { _id: 1, itemIds: 1 })
            .lean(),
    ]);

    const edges = [];

    // Create tag-based edges (items sharing tags are connected)
    const tagToItems = new Map();
    itemsWithTags.forEach((item) => {
        item.tags?.forEach((tagId) => {
            if (!tagToItems.has(tagId.toString())) {
                tagToItems.set(tagId.toString(), []);
            }
            tagToItems.get(tagId.toString()).push(item._id.toString());
        });
    });

    // Connect items that share tags
    tagToItems.forEach((itemIds) => {
        for (let i = 0; i < itemIds.length; i++) {
            for (let j = i + 1; j < itemIds.length; j++) {
                edges.push({
                    source: itemIds[i],
                    target: itemIds[j],
                    type: 'shared_tag',
                    weight: 1,
                });
            }
        }
    });

    // Create collection edges (items in same collection)
    collectionWithItems.forEach((collection) => {
        const itemIds = collection.itemIds.map((id) => id.toString());
        for (let i = 0; i < itemIds.length; i++) {
            edges.push({
                source: itemIds[i],
                target: collection._id.toString(),
                type: 'in_collection',
                weight: 2,
            });
        }
    });

    return edges;
}

/**
 * Get complete knowledge graph
 * Ranks nodes by connectivity (most connected first) for top-100 feature
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Graph with nodes and edges
 */
export async function getKnowledgeGraph(userId, options = {}) {
    const [nodes, edges] = await Promise.all([
        generateGraphNodes(userId),
        generateGraphEdges(userId),
    ]);

    const maxNodes = clampGraphLimit(options.maxNodes, DEFAULT_MAX_GRAPH_NODES);
    const maxEdges = clampGraphLimit(options.maxEdges, DEFAULT_MAX_GRAPH_EDGES);

    // Calculate node connectivity (degree)
    const nodeDegree = new Map();
    nodes.forEach((node) => {
        nodeDegree.set(String(node.id), 0);
    });

    edges.forEach((edge) => {
        const src = String(edge.source);
        const dst = String(edge.target);
        nodeDegree.set(src, (nodeDegree.get(src) || 0) + 1);
        nodeDegree.set(dst, (nodeDegree.get(dst) || 0) + 1);
    });

    // Sort nodes by degree (descending) - most connected first
    const rankedNodes = [...nodes].sort((a, b) => {
        const degreeA = nodeDegree.get(String(a.id)) || 0;
        const degreeB = nodeDegree.get(String(b.id)) || 0;
        if (degreeB !== degreeA) return degreeB - degreeA; // Higher degree first
        return String(a.id).localeCompare(String(b.id)); // Tiebreak by ID
    });

    const collectionNodes = rankedNodes.filter((node) => node.type === 'collection');
    const nonCollectionNodes = rankedNodes.filter((node) => node.type !== 'collection');

    const boundedNodes = [
        ...collectionNodes.slice(0, maxNodes),
        ...nonCollectionNodes.slice(0, Math.max(0, maxNodes - collectionNodes.length)),
    ];
    const boundedNodeIds = new Set(boundedNodes.map((node) => node.id));
    const boundedEdges = edges
        .filter((edge) => boundedNodeIds.has(edge.source) && boundedNodeIds.has(edge.target))
        .slice(0, maxEdges);

    return {
        nodes: boundedNodes,
        edges: boundedEdges,
        stats: {
            nodeCount: boundedNodes.length,
            edgeCount: boundedEdges.length,
            itemCount: boundedNodes.filter((n) => n.type === 'item').length,
            collectionCount: boundedNodes.filter((n) => n.type === 'collection').length,
            truncated: rankedNodes.length > maxNodes || boundedEdges.length < edges.length,
            maxNodes,
            maxEdges,
        },
    };
}

/**
 * Get subgraph for specific item (related items via tags)
 * @param {string} userId - User ID
 * @param {string} itemId - Item ID
 * @param {number} depth - Traversal depth (default: 1)
 * @returns {Promise<Object>} Subgraph
 */
export async function getItemSubgraph(userId, itemId, depth = 1) {
    const item = await Item.findOne({ _id: itemId, userId, isDeleted: false }).lean();

    if (!item) {
        return null;
    }

    const nodes = [
        {
            id: item._id.toString(),
            label: item.title,
            type: 'item',
            category: item.type,
            isCentral: true,
        },
    ];

    const edges = [];
    const visited = new Set([item._id.toString()]);

    // BFS to find related items
    const queue = [...(item.tags || [])];

    while (queue.length > 0 && nodes.length < 50) {
        const tagId = queue.shift();
        if (visited.has(tagId.toString())) continue;
        visited.add(tagId.toString());

        const relatedItems = await Item.find(
            { userId, isDeleted: false, tags: tagId },
            { _id: 1, title: 1, type: 1 }
        )
            .lean();

        relatedItems.forEach((relatedItem) => {
            if (!visited.has(relatedItem._id.toString())) {
                visited.add(relatedItem._id.toString());
                nodes.push({
                    id: relatedItem._id.toString(),
                    label: relatedItem.title,
                    type: 'item',
                    category: relatedItem.type,
                });

                edges.push({
                    source: item._id.toString(),
                    target: relatedItem._id.toString(),
                    type: 'shared_tag',
                    weight: 1,
                });
            }
        });
    }

    return {
        nodes,
        edges,
        centralItemId: item._id.toString(),
    };
}

export async function expandKnowledgeGraph(userId, options = {}) {
    const centralNodeId = String(options.centralNodeId || '').trim();
    if (!centralNodeId) {
        const error = new Error('centralNodeId is required');
        error.statusCode = 400;
        throw error;
    }

    const depth = clampGraphLimit(options.depth, 1, 1, 5);
    const pageSize = clampGraphLimit(options.pageSize, DEFAULT_EXPAND_PAGE_SIZE, 1, 100);

    const [nodes, edges] = await Promise.all([
        generateGraphNodes(userId),
        generateGraphEdges(userId),
    ]);

    const nodeMap = new Map(nodes.map((node) => [String(node.id), node]));
    if (!nodeMap.has(centralNodeId)) {
        return {
            nodes: [],
            edges: [],
            pageInfo: {
                depth,
                pageSize,
                totalNodes: 0,
                totalEdges: 0,
                nextCursor: null,
                page: 1,
            },
        };
    }

    const adjacency = new Map();
    edges.forEach((edge) => {
        const src = String(edge.source);
        const dst = String(edge.target);
        if (!adjacency.has(src)) adjacency.set(src, new Set());
        if (!adjacency.has(dst)) adjacency.set(dst, new Set());
        adjacency.get(src).add(dst);
        adjacency.get(dst).add(src);
    });

    const visited = new Set([centralNodeId]);
    const queue = [{ id: centralNodeId, level: 0 }];

    while (queue.length > 0) {
        const current = queue.shift();
        if (current.level >= depth) continue;

        const neighbors = adjacency.get(current.id) || new Set();
        neighbors.forEach((neighborId) => {
            if (!visited.has(neighborId)) {
                visited.add(neighborId);
                queue.push({ id: neighborId, level: current.level + 1 });
            }
        });
    }

    const candidateNodes = nodes
        .filter((node) => visited.has(String(node.id)))
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));

    const candidateNodeIds = new Set(candidateNodes.map((node) => String(node.id)));
    const candidateEdges = edges.filter(
        (edge) => candidateNodeIds.has(String(edge.source)) && candidateNodeIds.has(String(edge.target))
    );

    const offsetFromPage = clampGraphLimit(options.page, 1, 1, 100000) - 1;
    const offsetFromCursor = decodeCursor(options.cursor);
    const start = options.cursor ? offsetFromCursor : offsetFromPage * pageSize;
    const safeStart = Math.min(start, candidateNodes.length);

    const pagedNodes = candidateNodes.slice(safeStart, safeStart + pageSize);
    const pagedNodeIds = new Set(pagedNodes.map((node) => String(node.id)));
    const pagedEdges = candidateEdges.filter(
        (edge) => pagedNodeIds.has(String(edge.source)) && pagedNodeIds.has(String(edge.target))
    );

    const nextOffset = safeStart + pagedNodes.length;
    const hasMore = nextOffset < candidateNodes.length;

    return {
        nodes: pagedNodes,
        edges: pagedEdges,
        pageInfo: {
            depth,
            pageSize,
            totalNodes: candidateNodes.length,
            totalEdges: candidateEdges.length,
            page: Math.floor(safeStart / pageSize) + 1,
            nextCursor: hasMore ? encodeCursor(nextOffset) : null,
        },
    };
}
