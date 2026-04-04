import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../../src/models/user.model.js';
import Item from '../../src/models/item.model.js';

let mongod;
let app;

async function createVerifiedSession() {
    const agent = request.agent(app);
    const stamp = Date.now();
    const email = `phase2_${stamp}@example.com`;
    const password = 'Strong#123';
    const username = `phase2_${stamp}`;

    await agent.post('/api/auth/register').send({ username, email, password });

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    await agent.get(`/api/auth/verify-email?token=${token}`);
    await agent.post('/api/auth/login').send({ email, password });

    return { agent, email };
}

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    const appModule = await import('../../src/app.js');
    app = appModule.default;
});

afterEach(async () => {
    const collections = mongoose.connection.collections;

    await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));

    const limiterModule = await import('../../src/common/middleware/globalRateLimit.middleware.js');
    limiterModule.resetGlobalRateLimitStore();
});

afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
        await mongod.stop();
    }
});

describe('Phase 2 - File ingestion and discovery APIs', () => {
    test('creates items via extension single and bulk capture endpoints', async () => {
        const { agent } = await createVerifiedSession();

        const singleRes = await agent.post('/api/items/from-extension').send({
            type: 'url',
            title: 'Extension saved page',
            url: 'https://example.com/article',
            metadata: {
                source: 'extension_tab',
                domain: 'example.com',
                tabTitle: 'Example Article',
                tabUrl: 'https://example.com/article',
            },
        });

        expect(singleRes.statusCode).toBe(201);
        expect(singleRes.body.success).toBe(true);
        expect(singleRes.body.data.title).toContain('Extension saved page');

        const bulkRes = await agent.post('/api/items/bulk-from-extension').send({
            items: [
                {
                    type: 'text',
                    title: 'Captured selection',
                    content: 'Important highlighted paragraph',
                    metadata: {
                        source: 'extension_selection',
                        selectedText: 'Important highlighted paragraph',
                    },
                },
                {
                    type: 'text',
                    title: 'Quick note',
                    content: 'Remember to revisit this later',
                    metadata: {
                        source: 'extension_note',
                    },
                },
            ],
        });

        expect(bulkRes.statusCode).toBe(201);
        expect(bulkRes.body.success).toBe(true);
        expect(bulkRes.body.data.succeeded).toBe(2);
        expect(bulkRes.body.data.failed).toHaveLength(0);
    });

    test('uploads text file and stores item with pending/processed lifecycle', async () => {
        const { agent } = await createVerifiedSession();

        const res = await agent
            .post('/api/items/upload')
            .field('description', 'Plain text note')
            .attach('file', Buffer.from('Node.js queues and semantic search'), {
                filename: 'notes.txt',
                contentType: 'text/plain',
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.type).toBe('text');
        expect(res.body.data.content).toContain('semantic search');
    });

    test('returns graph, suggestions, hybrid search, and resurfacing data', async () => {
        const { agent } = await createVerifiedSession();

        const first = await agent.post('/api/items').send({
            type: 'text',
            title: 'Node queue processing',
            description: 'BullMQ fallback strategy',
            content: 'Queue durability and retries',
            tags: ['backend', 'queue'],
        });

        const second = await agent.post('/api/items').send({
            type: 'text',
            title: 'Semantic search design',
            description: 'Embeddings and cosine similarity',
            content: 'Vector retrieval and ranking',
            tags: ['backend', 'search'],
        });

        expect(first.statusCode).toBe(201);
        expect(second.statusCode).toBe(201);

        const targetId = first.body.data._id;

        const graphRes = await agent.get('/api/graph');
        expect(graphRes.statusCode).toBe(200);
        expect(graphRes.body.success).toBe(true);
        expect(graphRes.body.data.stats.itemCount).toBeGreaterThanOrEqual(2);

        const itemGraphRes = await agent.get(`/api/graph/${targetId}`);
        expect(itemGraphRes.statusCode).toBe(200);
        expect(itemGraphRes.body.success).toBe(true);
        expect(itemGraphRes.body.data.centralItemId).toBe(targetId);

        const expandRes = await agent
            .get(`/api/graph/expand?centralNodeId=${targetId}&depth=1&pageSize=1&page=1`);
        expect(expandRes.statusCode).toBe(200);
        expect(expandRes.body.success).toBe(true);
        expect(Array.isArray(expandRes.body.data.nodes)).toBe(true);
        expect(expandRes.body.data.pageInfo.pageSize).toBe(1);

        const suggestionRes = await agent.get('/api/items/search/suggestions?q=sem');
        expect(suggestionRes.statusCode).toBe(200);
        expect(suggestionRes.body.success).toBe(true);
        expect(Array.isArray(suggestionRes.body.data.suggestions)).toBe(true);
        expect(suggestionRes.body.data.suggestions.length).toBeGreaterThan(0);

        const searchRes = await agent.get('/api/items/search/query?q=queue');
        expect(searchRes.statusCode).toBe(200);
        expect(searchRes.body.success).toBe(true);
        expect(Array.isArray(searchRes.body.data.results)).toBe(true);
        expect(searchRes.body.data.results.length).toBeGreaterThan(0);

        const relatedRes = await agent.get(`/api/items/${targetId}/related?limit=5`);
        expect(relatedRes.statusCode).toBe(200);
        expect(relatedRes.body.success).toBe(true);

        const resurfacingRes = await agent.get('/api/items/resurface?days=1,7,30');
        expect(resurfacingRes.statusCode).toBe(200);
        expect(resurfacingRes.body.success).toBe(true);
        expect(Array.isArray(resurfacingRes.body.data.items)).toBe(true);
    });

    test('rejects item creation when strict AI quota is exceeded', async () => {
        const { agent, email } = await createVerifiedSession();
        const user = await User.findOne({ email });

        await User.findByIdAndUpdate(user._id, {
            $set: {
                'usageQuota.aiJobsPerDay': 0,
                'usageQuota.currentUsage.aiJobsToday': 0,
                'usageQuota.currentUsage.lastReset': new Date(),
            },
        });

        const createRes = await agent.post('/api/items').send({
            type: 'text',
            title: 'Should reject on quota',
            content: 'Quota enforcement',
        });

        expect(createRes.statusCode).toBe(429);
        expect(createRes.body.code).toBe('AI_QUOTA_EXCEEDED');
        expect(createRes.body.limit).toBe(0);

        const created = await Item.findOne({
            userId: user._id,
            title: 'Should reject on quota',
            isDeleted: false,
        }).lean();

        expect(created).toBeNull();
    });

    test('bounds full graph response for dense tenant graphs', async () => {
        const { agent } = await createVerifiedSession();

        for (let i = 0; i < 12; i += 1) {
            const res = await agent.post('/api/items').send({
                type: 'text',
                title: `Dense graph item ${i}`,
                content: `Dense graph content ${i}`,
                tags: ['dense-shared-tag'],
            });
            expect(res.statusCode).toBe(201);
        }

        const graphRes = await agent.get('/api/graph?maxNodes=10&maxEdges=15');

        expect(graphRes.statusCode).toBe(200);
        expect(graphRes.body.success).toBe(true);
        expect(graphRes.body.data.nodes.length).toBeLessThanOrEqual(10);
        expect(graphRes.body.data.edges.length).toBeLessThanOrEqual(15);
        expect(graphRes.body.data.stats.maxNodes).toBe(10);
        expect(graphRes.body.data.stats.maxEdges).toBe(15);
        expect(graphRes.body.data.stats.truncated).toBe(true);
    });
});
