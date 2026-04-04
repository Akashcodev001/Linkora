import { createHash } from 'crypto';
import Item from '../models/item.model.js';

const DEFAULT_CLUSTER_COUNT = 6;
const MIN_ITEMS_FOR_SEMANTIC_CLUSTERING = 4;
const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'you', 'are', 'was', 'were', 'have', 'has', 'had',
    'into', 'about', 'after', 'before', 'over', 'under', 'without', 'within', 'what', 'when', 'where', 'how', 'why',
    'which', 'who', 'whom', 'their', 'there', 'they', 'them', 'then', 'than', 'through', 'while', 'use', 'using',
    'saved', 'save', 'note', 'notes', 'item', 'items', 'link', 'links', 'page', 'pages', 'topic', 'topics',
]);

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

function normalizeCollectionName(collectionId) {
    if (!collectionId) return '';
    if (typeof collectionId === 'string') return collectionId.trim();
    return String(collectionId.name || collectionId.label || collectionId.title || '').trim();
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

    const collectionName = normalizeCollectionName(item.collectionId);
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

        const collectionName = normalizeCollectionName(item.collectionId).toLowerCase();
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

    return takeBest(tagCounts)
        || takeBest(wordCounts)
        || takeBest(collectionCounts)
        || takeBest(domainCounts)
        || `topic ${fallbackIndex + 1}`;
}

function selectSeedIndexes(length, clusterCount) {
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
    if (length < MIN_ITEMS_FOR_SEMANTIC_CLUSTERING) return 0;
    const estimate = Math.round(Math.sqrt(length / 2));
    return Math.min(DEFAULT_CLUSTER_COUNT, Math.max(2, estimate));
}

function stableClusterId(userId, label, itemIds) {
    const digest = createHash('sha1')
        .update(`${String(userId)}:${String(label)}:${itemIds.slice().sort().join('|')}`)
        .digest('hex')
        .slice(0, 10);
    return `cluster-${slugifyTopic(label) || 'topic'}-${digest}`;
}

function buildGroupSummary({ id, label, type, itemIds, centroidMagnitude }) {
    return {
        id,
        label,
        topic: label,
        type,
        itemCount: itemIds.length,
        centroidMagnitude: Number((centroidMagnitude || 0).toFixed(6)),
        itemIds,
    };
}

function clusterSemanticItems(items, userId) {
    const semanticEntries = items
        .map((item) => ({ item, vector: normalizeEmbedding(item.embeddings) }))
        .filter((entry) => entry.vector.length > 0 && vectorMagnitude(entry.vector) > 0);

    const clusterCount = determineClusterCount(semanticEntries.length);
    if (!clusterCount) {
        return { byItemId: new Map(), clusters: [] };
    }

    const orderedEntries = [...semanticEntries].sort((left, right) => String(left.item._id).localeCompare(String(right.item._id)));
    const seedIndexes = selectSeedIndexes(orderedEntries.length, clusterCount);
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

    const groups = Array.from({ length: clusterCount }, (_, index) => ({
        index,
        members: [],
        vectors: [],
    }));

    orderedEntries.forEach((entry, entryIndex) => {
        const clusterIndex = assignments[entryIndex] || 0;
        groups[clusterIndex].members.push(entry.item);
        groups[clusterIndex].vectors.push(entry.vector);
    });

    const clusters = groups
        .filter((group) => group.members.length > 0)
        .map((group, index) => {
            const label = deriveClusterLabel(group.members, index);
            const itemIds = group.members.map((item) => String(item._id));
            return buildGroupSummary({
                id: stableClusterId(userId, label, itemIds),
                label,
                type: 'semantic',
                itemIds,
                centroidMagnitude: vectorMagnitude(averageVectors(group.vectors)),
            });
        });

    const byItemId = new Map();
    clusters.forEach((cluster) => {
        cluster.itemIds.forEach((itemId) => {
            byItemId.set(itemId, cluster);
        });
    });

    return { byItemId, clusters };
}

function groupFallbackItems(items, userId) {
    const clusterMap = new Map();

    items.forEach((item) => {
        const fallback = buildFallbackClusterKey(item);
        const key = fallback.id;
        if (!clusterMap.has(key)) {
            clusterMap.set(key, {
                ...fallback,
                itemIds: [],
            });
        }

        clusterMap.get(key).itemIds.push(String(item._id));
    });

    return Array.from(clusterMap.values())
        .map((cluster) => buildGroupSummary({
            id: stableClusterId(userId, cluster.label, cluster.itemIds),
            label: cluster.label,
            type: cluster.type,
            itemIds: cluster.itemIds,
        }))
        .sort((left, right) => right.itemCount - left.itemCount || left.label.localeCompare(right.label));
}

export async function clusterUserItems(userId) {
    const items = await Item.find(
        { userId, isDeleted: false },
        { _id: 1, title: 1, description: 1, tags: 1, collectionId: 1, embeddings: 1, metadata: 1 }
    )
        .populate('tags', 'name')
        .populate('collectionId', 'name')
        .lean();

    if (!items.length) {
        return {
            updatedCount: 0,
            clusterCount: 0,
            clusters: [],
            reason: 'no_items',
        };
    }

    const semanticItems = items.filter((item) => vectorMagnitude(normalizeEmbedding(item.embeddings)) > 0);
    const useSemanticClustering = semanticItems.length >= MIN_ITEMS_FOR_SEMANTIC_CLUSTERING;
    const clusters = useSemanticClustering
        ? (() => {
            const { byItemId, clusters: semanticClusters } = clusterSemanticItems(items, userId);
            const fallbackClusters = groupFallbackItems(items.filter((item) => !byItemId.has(String(item._id))), userId);
            return [...semanticClusters, ...fallbackClusters];
        })()
        : groupFallbackItems(items, userId);

    const clusterByItemId = new Map();
    clusters.forEach((cluster) => {
        cluster.itemIds.forEach((itemId) => {
            clusterByItemId.set(String(itemId), cluster);
        });
    });

    const bulkOps = items.map((item) => {
        const cluster = clusterByItemId.get(String(item._id)) || {
            id: 'topic-uncategorized',
            label: 'Uncategorized',
            type: 'fallback',
        };

        return {
            updateOne: {
                filter: { _id: item._id, userId, isDeleted: false },
                update: {
                    $set: {
                        clusterId: cluster.id,
                        topic: cluster.label,
                    },
                },
            },
        };
    });

    if (bulkOps.length > 0) {
        await Item.bulkWrite(bulkOps, { ordered: false });
    }

    return {
        updatedCount: bulkOps.length,
        clusterCount: clusters.length,
        clusters: clusters
            .map((cluster) => ({
                id: cluster.id,
                label: cluster.label,
                topic: cluster.topic,
                type: cluster.type,
                itemCount: cluster.itemCount,
            }))
            .sort((left, right) => right.itemCount - left.itemCount || left.label.localeCompare(right.label)),
        reason: useSemanticClustering ? 'semantic' : 'fallback',
    };
}

export default {
    clusterUserItems,
};
