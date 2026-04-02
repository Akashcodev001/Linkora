import { QdrantClient } from '@qdrant/js-client-rest';
import { createHash } from 'crypto';
import env from '../config/env.js';

let client;
let ready = false;

function getClient() {
    if (client) return client;

    if (!env.qdrantUrl) return null;

    client = new QdrantClient({
        url: env.qdrantUrl,
        apiKey: env.qdrantApiKey || undefined,
    });

    return client;
}

function stablePointId(userId, itemId) {
    const raw = `${String(userId)}:${String(itemId)}`;
    const hex = createHash('sha1').update(raw).digest('hex');
    const part1 = hex.slice(0, 8);
    const part2 = hex.slice(8, 12);
    const part3 = `5${hex.slice(13, 16)}`;
    const part4 = `a${hex.slice(17, 20)}`;
    const part5 = hex.slice(20, 32);
    return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

export async function ensureCollection(size) {
    const qdrant = getClient();
    if (!qdrant || ready) return;

    const collections = await qdrant.getCollections();
    const exists = (collections?.collections || []).some((entry) => entry.name === env.qdrantCollectionName);

    if (!exists) {
        await qdrant.createCollection(env.qdrantCollectionName, {
            vectors: {
                size: Number(size || env.qdrantVectorSize),
                distance: 'Cosine',
            },
        });
    }

    ready = true;
}

export async function upsertItemVector({ userId, itemId, values, metadata }) {
    if (!Array.isArray(values) || values.length === 0) return;

    const qdrant = getClient();
    if (!qdrant) return;

    await ensureCollection(values.length);

    await qdrant.upsert(env.qdrantCollectionName, {
        wait: true,
        points: [
            {
                id: stablePointId(userId, itemId),
                vector: values,
                payload: {
                    userId: String(userId),
                    itemId: String(itemId),
                    ...(metadata || {}),
                },
            },
        ],
    });
}
