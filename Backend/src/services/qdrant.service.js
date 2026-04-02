import { QdrantClient } from '@qdrant/js-client-rest';
import env from '../config/env.js';

let qdrantClient = null;
let initialized = false;

function getClient() {
    if (!env.QDRANT_URL) return null;

    if (!qdrantClient) {
        qdrantClient = new QdrantClient({
            url: env.QDRANT_URL,
            apiKey: env.QDRANT_API_KEY || undefined,
        });
    }

    return qdrantClient;
}

async function ensureCollection(vectorSize = env.QDRANT_VECTOR_SIZE) {
    const client = getClient();
    if (!client || initialized) return;

    const collections = await client.getCollections();
    const exists = (collections?.collections || []).some((entry) => entry.name === env.QDRANT_COLLECTION_NAME);

    if (!exists) {
        await client.createCollection(env.QDRANT_COLLECTION_NAME, {
            vectors: {
                size: Number(vectorSize || 1024),
                distance: 'Cosine',
            },
        });
    }

    initialized = true;
}

export function isQdrantEnabled() {
    return Boolean(getClient());
}

export async function querySimilarItems({ userId, vector, topK = 10, excludeItemId = null }) {
    const client = getClient();
    if (!client || !Array.isArray(vector) || vector.length === 0) return [];

    await ensureCollection(vector.length);

    const response = await client.search(env.QDRANT_COLLECTION_NAME, {
        vector,
        limit: Number(topK || 10),
        with_payload: true,
        filter: {
            must: [{ key: 'userId', match: { value: String(userId) } }],
            must_not: excludeItemId ? [{ key: 'itemId', match: { value: String(excludeItemId) } }] : undefined,
        },
    });

    return (response || [])
        .map((entry) => ({
            itemId: entry?.payload?.itemId || null,
            semanticScore: Number(entry?.score || 0),
        }))
        .filter((entry) => entry.itemId);
}

export async function fetchItemVector(userId, itemId) {
    const client = getClient();
    if (!client) return null;

    await ensureCollection();

    const response = await client.scroll(env.QDRANT_COLLECTION_NAME, {
        limit: 1,
        with_vector: true,
        with_payload: false,
        filter: {
            must: [
                { key: 'userId', match: { value: String(userId) } },
                { key: 'itemId', match: { value: String(itemId) } },
            ],
        },
    });

    const point = response?.points?.[0];
    return Array.isArray(point?.vector) ? point.vector : null;
}

export async function deleteItemVector(userId, itemId) {
    const client = getClient();
    if (!client) return null;

    await ensureCollection();

    return client.delete(env.QDRANT_COLLECTION_NAME, {
        filter: {
            must: [
                { key: 'userId', match: { value: String(userId) } },
                { key: 'itemId', match: { value: String(itemId) } },
            ],
        },
    });
}
