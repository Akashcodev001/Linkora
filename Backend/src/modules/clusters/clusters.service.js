import Item from '../../models/item.model.js';
import { enqueueClusterRebuildJob } from '../../queues/processing.queue.js';

function normalizeTagName(tag) {
    if (!tag) return '';
    if (typeof tag === 'string') return tag.trim();
    return String(tag.name || tag.label || tag.title || '').trim();
}

function toId(value) {
    if (!value) return '';
    return String(value?._id || value).trim();
}

function getItemPreview(item) {
    return {
        id: String(item._id),
        title: item.title,
        type: item.type,
        description: item.description || null,
        url: item.url || null,
        updatedAt: item.updatedAt,
        createdAt: item.createdAt,
        topic: item.topic || null,
        clusterId: item.clusterId || null,
    };
}

function summarizeCluster(items) {
    const first = items[0] || {};
    const topicCounts = new Map();
    const typeCounts = new Map();
    const tagCounts = new Map();

    items.forEach((item) => {
        const topic = String(item.topic || '').trim().toLowerCase();
        if (topic) {
            topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
        }

        const type = String(item.type || '').trim().toLowerCase();
        if (type) {
            typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
        }

        (item.tags || []).forEach((tag) => {
            const name = normalizeTagName(tag).toLowerCase();
            if (!name) return;
            tagCounts.set(name, (tagCounts.get(name) || 0) + 1);
        });
    });

    const chooseTop = (counts) => {
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

    const label = chooseTop(topicCounts) || first.topic || first.title || 'Topic';
    const dominantType = chooseTop(typeCounts) || first.type || 'semantic';
    const topTag = chooseTop(tagCounts) || null;

    return {
        id: String(first.clusterId || `cluster-${label}`),
        label,
        topic: label,
        type: dominantType,
        itemCount: items.length,
        topTag,
        lastUpdatedAt: items[0]?.updatedAt || null,
        firstSeenAt: items[items.length - 1]?.createdAt || null,
        sampleItems: items.slice(0, 5).map(getItemPreview),
        items: items.map(getItemPreview),
    };
}

export async function listClustersService(userId) {
    const items = await Item.find(
        { userId, isDeleted: false, clusterId: { $ne: null } },
        { _id: 1, title: 1, type: 1, description: 1, url: 1, topic: 1, clusterId: 1, createdAt: 1, updatedAt: 1, tags: 1 }
    )
        .populate('tags', 'name')
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean();

    const clusterMap = new Map();

    items.forEach((item) => {
        const key = String(item.clusterId || '');
        if (!key) return;

        if (!clusterMap.has(key)) {
            clusterMap.set(key, []);
        }

        clusterMap.get(key).push(item);
    });

    const clusters = Array.from(clusterMap.values()).map(summarizeCluster).sort((left, right) => {
        if (right.itemCount !== left.itemCount) return right.itemCount - left.itemCount;
        return String(left.label).localeCompare(String(right.label));
    });

    return {
        clusters,
        totalClusters: clusters.length,
        totalItems: items.length,
    };
}

export async function getClusterService(userId, clusterId) {
    const normalizedClusterId = String(clusterId || '').trim();
    if (!normalizedClusterId) {
        const error = new Error('clusterId is required');
        error.statusCode = 400;
        throw error;
    }

    const items = await Item.find(
        { userId, isDeleted: false, clusterId: normalizedClusterId },
        { _id: 1, title: 1, type: 1, description: 1, url: 1, topic: 1, clusterId: 1, createdAt: 1, updatedAt: 1, tags: 1, metadata: 1 }
    )
        .populate('tags', 'name')
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean();

    if (!items.length) {
        const error = new Error('Cluster not found');
        error.statusCode = 404;
        throw error;
    }

    const cluster = summarizeCluster(items);
    return {
        ...cluster,
        items: cluster.items,
        sampleItems: cluster.sampleItems,
    };
}

export async function rebuildClustersService(userId, options = {}) {
    const explicitItemId = toId(options.itemId);
    let anchorItemId = explicitItemId;

    if (!anchorItemId) {
        const anchor = await Item.findOne({ userId, isDeleted: false }, { _id: 1 })
            .sort({ updatedAt: -1, createdAt: -1 })
            .lean();
        anchorItemId = toId(anchor);
    }

    if (!anchorItemId) {
        const error = new Error('No items available for clustering');
        error.statusCode = 404;
        throw error;
    }

    const job = await enqueueClusterRebuildJob(anchorItemId, userId, {
        reason: String(options.reason || 'manual').slice(0, 120),
        delayMs: Number(options.delayMs || 0),
    });

    return {
        queued: Boolean(job),
        job,
        anchorItemId,
    };
}
