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
const DEFAULT_MAX_CLUSTER_COUNT = 6;
const SEMANTIC_CLUSTER_MIN_ITEMS = 4;
const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'you', 'are', 'was', 'were', 'have', 'has', 'had',
    'into', 'about', 'after', 'before', 'over', 'under', 'without', 'within', 'what', 'when', 'where', 'how', 'why',
    'which', 'who', 'whom', 'their', 'there', 'they', 'them', 'then', 'than', 'through', 'while', 'use', 'using',
    'saved', 'save', 'note', 'notes', 'item', 'items', 'link', 'links', 'page', 'pages', 'topic', 'topics',
]);

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

function normalizeEmbedding(values) {
    if (!Array.isArray(values)) return [];
    return values.map((value) => Number(value) || 0);
}

function vectorMagnitude(vector) {
    return Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
}

function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
        return 0;
    }

    let dot = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let index = 0; index < a.length; index += 1) {
        const left = Number(a[index]) || 0;
        const right = Number(b[index]) || 0;
        dot += left * right;
        magnitudeA += left * left;
        magnitudeB += right * right;
    }

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function averageVectors(vectors) {
    if (!Array.isArray(vectors) || vectors.length === 0) return [];

    const size = vectors[0]?.length || 0;
    if (!size) return [];

    const total = new Array(size).fill(0);
    vectors.forEach((vector) => {
        for (let index = 0; index < size; index += 1) {
            total[index] += Number(vector[index]) || 0;
        }
    });

    return total.map((value) => value / vectors.length);
}

function slugifyTopic(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
}

function normalizeTagName(tag) {
    if (!tag) return '';
    if (typeof tag === 'string') return tag.trim();
    return String(tag.name || tag.label || tag.title || '').trim();
}

function tokenizeTopicText(value) {
    return String(value || '')
        .toLowerCase()
        .match(/[a-z0-9]+/g)
        ?.filter((word) => word.length > 2 && !STOP_WORDS.has(word)) || [];
}

function chooseSeedIndexes(length, clusterCount) {
    const indexes = [];
    const safeClusterCount = Math.min(clusterCount, length);

    for (let index = 0; index < safeClusterCount; index += 1) {
        const seedIndex = Math.min(length - 1, Math.floor((index * length) / safeClusterCount));
        if (!indexes.includes(seedIndex)) {
            indexes.push(seedIndex);
        }
    }

    return indexes;
}

function determineClusterCount(length) {
    if (length < SEMANTIC_CLUSTER_MIN_ITEMS) return 0;
    const estimate = Math.round(Math.sqrt(length / 2));
    return Math.min(DEFAULT_MAX_CLUSTER_COUNT, Math.max(2, estimate));
}

function deriveClusterLabel(items, fallbackIndex) {
    const tagCounts = new Map();
    const wordCounts = new Map();
    const collectionCounts = new Map();
    const domainCounts = new Map();

    items.forEach((item) => {
        (item.tags || []).forEach((tag) => {
            const name = normalizeTagName(tag).toLowerCase();
            if (!name) return;
            tagCounts.set(name, (tagCounts.get(name) || 0) + 1);
        });

        tokenizeTopicText(`${item.title || ''} ${item.description || ''}`).forEach((word) => {
            wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        });

        const collectionName = normalizeTagName(item.collectionId).toLowerCase();
        if (collectionName) {
            collectionCounts.set(collectionName, (collectionCounts.get(collectionName) || 0) + 1);
        }

        const domain = String(item?.metadata?.domain || '').trim().toLowerCase();
        if (domain) {
            domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
        }
    });

    const takeBest = (counts) => {
        let winner = '';
        let bestCount = 0;
        counts.forEach((count, key) => {
            if (count > bestCount || (count === bestCount && key.localeCompare(winner) < 0)) {
                winner = key;
                bestCount = count;
            }
        });
        return winner;
    };

    const tagLabel = takeBest(tagCounts);
    if (tagLabel) return tagLabel;

    const wordLabel = takeBest(wordCounts);
    if (wordLabel) return wordLabel;

    const collectionLabel = takeBest(collectionCounts);
    if (collectionLabel) return collectionLabel;

    const domainLabel = takeBest(domainCounts);
    if (domainLabel) return domainLabel;

    return `topic ${fallbackIndex + 1}`;
}

function buildFallbackClusterKey(item) {
    const tags = (item.tags || [])
        .map((tag) => normalizeTagName(tag).toLowerCase())
        .filter(Boolean);

    if (tags.length > 0) {
        return {
            id: `tag-${slugifyTopic(tags[0])}`,
            label: tags[0],
            type: 'tag',
        };
    }

    const collectionName = normalizeTagName(item.collectionId);
    if (collectionName) {
        return {
            id: `collection-${slugifyTopic(collectionName)}`,
            label: collectionName,
            type: 'collection',
        };
    }

    const domain = String(item?.metadata?.domain || '').trim();
    if (domain) {
        return {
            id: `domain-${slugifyTopic(domain)}`,
            label: domain,
            type: 'domain',
        };
    }

    return {
        id: 'topic-uncategorized',
        label: 'Uncategorized',
        type: 'fallback',
    };
}

function clusterSemanticItems(items) {
    const semanticEntries = items
        .map((item) => ({
            item,
            vector: normalizeEmbedding(item.embeddings),
        }))
        .filter((entry) => entry.vector.length > 0 && vectorMagnitude(entry.vector) > 0);

    const clusterCount = determineClusterCount(semanticEntries.length);
    if (!clusterCount) {
        return {
            byItemId: new Map(),
            clusters: [],
        };
    }

    const orderedEntries = [...semanticEntries].sort((left, right) => String(left.item._id).localeCompare(String(right.item._id)));
    const seedIndexes = chooseSeedIndexes(orderedEntries.length, clusterCount);
    let centroids = seedIndexes.map((index) => orderedEntries[index].vector.slice());

    while (centroids.length < clusterCount) {
        centroids.push(orderedEntries[centroids.length % orderedEntries.length].vector.slice());
    }

    let assignments = new Array(orderedEntries.length).fill(0);

    for (let iteration = 0; iteration < 8; iteration += 1) {
        let changed = false;

        orderedEntries.forEach((entry, entryIndex) => {
            let bestCluster = 0;
            let bestScore = -Infinity;

            centroids.forEach((centroid, centroidIndex) => {
                const score = cosineSimilarity(entry.vector, centroid);
                if (score > bestScore) {
                    bestScore = score;
                    bestCluster = centroidIndex;
                }
            });

            if (assignments[entryIndex] !== bestCluster) {
                assignments[entryIndex] = bestCluster;
                changed = true;
            }
        });

        const groupedVectors = Array.from({ length: clusterCount }, () => []);
        orderedEntries.forEach((entry, entryIndex) => {
            groupedVectors[assignments[entryIndex]].push(entry.vector);
        });

        centroids = groupedVectors.map((group, groupIndex) => {
            if (group.length > 0) {
                return averageVectors(group);
            }

            return orderedEntries[groupIndex % orderedEntries.length].vector.slice();
        });

        if (!changed) {
            break;
        }
    }

    const clusters = Array.from({ length: clusterCount }, (_, index) => ({
        id: `cluster-${index + 1}`,
        label: `topic ${index + 1}`,
        type: 'semantic',
        members: [],
    }));
    const byItemId = new Map();

    orderedEntries.forEach((entry, entryIndex) => {
        const clusterIndex = assignments[entryIndex] || 0;
        clusters[clusterIndex].members.push(entry.item);
        byItemId.set(String(entry.item._id), {
            id: clusters[clusterIndex].id,
            label: clusters[clusterIndex].label,
            type: clusters[clusterIndex].type,
        });
    });

    clusters.forEach((cluster, index) => {
        cluster.label = deriveClusterLabel(cluster.members, index);
        cluster.topic = cluster.label;
        cluster.itemCount = cluster.members.length;
        cluster.centroidMagnitude = Number(vectorMagnitude(centroids[index] || []).toFixed(6));
        cluster.members = cluster.members.map((item) => String(item._id));
    });

    orderedEntries.forEach((entry, entryIndex) => {
        const clusterIndex = assignments[entryIndex] || 0;
        const cluster = clusters[clusterIndex];
        byItemId.set(String(entry.item._id), {
            id: cluster.id,
            label: cluster.label,
            type: cluster.type,
        });
    });

    return {
        byItemId,
        clusters: clusters.map((cluster) => ({
            id: cluster.id,
            label: cluster.label,
            topic: cluster.topic,
            type: cluster.type,
            itemCount: cluster.itemCount,
            centroidMagnitude: cluster.centroidMagnitude,
        })),
    };
}

function assignClusterMetadata(items) {
    const { byItemId, clusters: semanticClusters } = clusterSemanticItems(items);
    const clusterMap = new Map(
        semanticClusters.map((cluster) => [
            cluster.id,
            {
                ...cluster,
                itemCount: 0,
                members: [],
            },
        ])
    );

    items.forEach((item) => {
        const itemId = String(item._id);
        const cluster = byItemId.get(itemId) || buildFallbackClusterKey(item);
        const clusterId = String(cluster.id);
        const clusterLabel = String(cluster.label);

        if (!clusterMap.has(clusterId)) {
            clusterMap.set(clusterId, {
                id: clusterId,
                label: clusterLabel,
                topic: clusterLabel,
                type: cluster.type || 'fallback',
                itemCount: 0,
                members: [],
            });
        }

        const entry = clusterMap.get(clusterId);
        entry.members.push(itemId);
        entry.itemCount += 1;
    });

    const nodeClusterByItemId = new Map();
    items.forEach((item) => {
        const itemId = String(item._id);
        const cluster = byItemId.get(itemId) || buildFallbackClusterKey(item);

        nodeClusterByItemId.set(itemId, {
            clusterId: String(cluster.id),
            topic: String(cluster.label),
            clusterType: String(cluster.type),
        });
    });

    return {
        clusters: Array.from(clusterMap.values())
            .sort((left, right) => right.itemCount - left.itemCount || left.label.localeCompare(right.label)),
        nodeClusterByItemId,
    };
}

function edgeKey(source, target) {
    const left = String(source || '');
    const right = String(target || '');
    return left < right ? `${left}::${right}` : `${right}::${left}`;
}

function upsertEdge(edgeMap, edge) {
    const source = String(edge?.source || '');
    const target = String(edge?.target || '');
    if (!source || !target || source === target) return;

    const key = edgeKey(source, target);
    const existing = edgeMap.get(key);

    if (!existing) {
        edgeMap.set(key, {
            source,
            target,
            type: String(edge.type || 'related'),
            weight: Number(edge.weight || 0),
        });
        return;
    }

    const nextWeight = Number(edge.weight || 0);
    if (nextWeight > Number(existing.weight || 0)) {
        existing.weight = nextWeight;
        existing.type = String(edge.type || existing.type || 'related');
    }
}

function buildSemanticSimilarityEdges(items, edgeMap) {
    const semanticItems = items
        .map((item) => ({
            id: String(item._id),
            vector: normalizeEmbedding(item.embeddings),
        }))
        .filter((entry) => entry.vector.length > 0 && vectorMagnitude(entry.vector) > 0)
        .sort((left, right) => left.id.localeCompare(right.id));

    if (semanticItems.length < 2) return;

    // Keep this bounded to avoid expensive O(n^2) when users have very large libraries.
    const bounded = semanticItems.slice(0, 180);
    const threshold = 0.8;

    for (let i = 0; i < bounded.length; i += 1) {
        const from = bounded[i];
        const scored = [];

        for (let j = i + 1; j < bounded.length; j += 1) {
            const to = bounded[j];
            const similarity = cosineSimilarity(from.vector, to.vector);
            if (similarity >= threshold) {
                scored.push({
                    source: from.id,
                    target: to.id,
                    similarity,
                });
            }
        }

        scored
            .sort((left, right) => right.similarity - left.similarity)
            .slice(0, 3)
            .forEach((entry) => {
                upsertEdge(edgeMap, {
                    source: entry.source,
                    target: entry.target,
                    type: 'semantic_related',
                    weight: Number((entry.similarity * 1.5).toFixed(6)),
                });
            });
    }
}

/**
 * Generate graph nodes from items and collections
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Graph nodes
 */
export async function generateGraphNodes(userId) {
    const [items, collections] = await Promise.all([
        Item.find({ userId, isDeleted: false }, { _id: 1, title: 1, description: 1, type: 1, tags: 1, collectionId: 1, embeddings: 1, metadata: 1 })
            .populate('tags', 'name')
            .populate('collectionId', 'name')
            .lean(),
        Collection.find({ userId, isDeleted: false }, { _id: 1, name: 1 }).lean(),
    ]);

    const { clusters, nodeClusterByItemId } = assignClusterMetadata(items);

    const itemNodes = items.map((item) => ({
        id: item._id.toString(),
        label: item.title,
        type: 'item',
        category: item.type,
        clusterId: nodeClusterByItemId.get(String(item._id))?.clusterId || null,
        topic: nodeClusterByItemId.get(String(item._id))?.topic || null,
        clusterType: nodeClusterByItemId.get(String(item._id))?.clusterType || null,
    }));

    const collectionNodes = collections.map((collection) => ({
        id: collection._id.toString(),
        label: collection.name,
        type: 'collection',
        clusterId: `collection-${slugifyTopic(collection.name)}`,
        topic: collection.name,
        clusterType: 'collection',
    }));

    return {
        nodes: [...itemNodes, ...collectionNodes],
        clusters,
    };
}

/**
 * Generate graph edges based on tags and collections
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Graph edges
 */
export async function generateGraphEdges(userId) {
    const [itemsWithTags, collectionWithItems] = await Promise.all([
        Item.find({ userId, isDeleted: false }, { _id: 1, tags: 1, clusterId: 1, embeddings: 1 })
            .lean(),
        Collection.find({ userId, isDeleted: false }, { _id: 1, itemIds: 1 })
            .lean(),
    ]);

    const edgeMap = new Map();

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
                upsertEdge(edgeMap, {
                    source: itemIds[i],
                    target: itemIds[j],
                    type: 'shared_tag',
                    weight: 1,
                });
            }
        }
    });

    // Connect items grouped into the same cluster with a star topology.
    const clusterToItems = new Map();
    itemsWithTags.forEach((item) => {
        const clusterId = String(item.clusterId || '').trim();
        if (!clusterId) return;

        if (!clusterToItems.has(clusterId)) {
            clusterToItems.set(clusterId, []);
        }

        clusterToItems.get(clusterId).push(String(item._id));
    });

    clusterToItems.forEach((itemIds) => {
        if (itemIds.length < 2) return;
        const [anchor, ...rest] = itemIds;
        rest.forEach((itemId) => {
            upsertEdge(edgeMap, {
                source: anchor,
                target: itemId,
                type: 'same_cluster',
                weight: 0.9,
            });
        });
    });

    // Add embedding similarity edges to improve related-item discovery in graph form.
    buildSemanticSimilarityEdges(itemsWithTags, edgeMap);

    // Create collection edges (items in same collection)
    collectionWithItems.forEach((collection) => {
        const itemIds = collection.itemIds.map((id) => id.toString());
        for (let i = 0; i < itemIds.length; i++) {
            upsertEdge(edgeMap, {
                source: itemIds[i],
                target: collection._id.toString(),
                type: 'in_collection',
                weight: 2,
            });
        }
    });

    return Array.from(edgeMap.values());
}

/**
 * Get complete knowledge graph
 * Ranks nodes by connectivity (most connected first) for top-100 feature
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Graph with nodes and edges
 */
export async function getKnowledgeGraph(userId, options = {}) {
    const [graphData, edges] = await Promise.all([
        generateGraphNodes(userId),
        generateGraphEdges(userId),
    ]);

    const nodes = graphData.nodes;
    const clusters = graphData.clusters || [];

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
        clusters: clusters
            .map((cluster) => ({
                ...cluster,
                itemCount: boundedNodes.filter((node) => String(node.clusterId) === String(cluster.id)).length,
            }))
            .filter((cluster) => cluster.itemCount > 0),
        stats: {
            nodeCount: boundedNodes.length,
            edgeCount: boundedEdges.length,
            itemCount: boundedNodes.filter((n) => n.type === 'item').length,
            collectionCount: boundedNodes.filter((n) => n.type === 'collection').length,
            clusterCount: clusters.length,
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
    const item = await Item.findOne(
        { _id: itemId, userId, isDeleted: false },
        { _id: 1, title: 1, description: 1, type: 1, tags: 1, collectionId: 1, metadata: 1 }
    )
        .populate('tags', 'name')
        .populate('collectionId', 'name')
        .lean();

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
            ...buildFallbackClusterKey(item),
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
            { _id: 1, title: 1, description: 1, type: 1, tags: 1, collectionId: 1, metadata: 1 }
        )
            .populate('tags', 'name')
            .populate('collectionId', 'name')
            .lean();

        relatedItems.forEach((relatedItem) => {
            if (!visited.has(relatedItem._id.toString())) {
                visited.add(relatedItem._id.toString());
                nodes.push({
                    id: relatedItem._id.toString(),
                    label: relatedItem.title,
                    type: 'item',
                    category: relatedItem.type,
                    ...buildFallbackClusterKey(relatedItem),
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

    const [graphData, edges] = await Promise.all([
        generateGraphNodes(userId),
        generateGraphEdges(userId),
    ]);

    const nodes = graphData.nodes || [];

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
