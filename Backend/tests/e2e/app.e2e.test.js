import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;
let app;

async function createVerifiedSession() {
    const agent = request.agent(app);
    const email = `user_${Date.now()}@example.com`;
    const password = 'Strong#123';
    const username = `user_${Date.now()}`;

    await agent.post('/api/auth/register').send({ username, email, password });

    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
    await agent.get(`/api/auth/verify-email?token=${token}`);

    await agent.post('/api/auth/login').send({ email, password });

    return { agent, email, password, username };
}

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    const appModule = await import('../../src/app.js');
    app = appModule.default;
});

afterEach(async () => {
    const collections = mongoose.connection.collections;

    await Promise.all(
        Object.values(collections).map((collection) => collection.deleteMany({}))
    );

    const limiterModule = await import('../../src/common/middleware/globalRateLimit.middleware.js');
    limiterModule.resetGlobalRateLimitStore();
});

afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
        await mongod.stop();
    }
});

describe('Auth flow', () => {
    test('register -> verify -> login -> refresh', async () => {
        const agent = request.agent(app);
        const email = `auth_${Date.now()}@example.com`;
        const password = 'Strong#123';
        const username = `auth_${Date.now()}`;

        const registerRes = await agent.post('/api/auth/register').send({ username, email, password });
        expect(registerRes.statusCode).toBe(201);
        expect(registerRes.body.success).toBe(true);

        const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const verifyRes = await agent.get(`/api/auth/verify-email?token=${token}`);
        expect(verifyRes.statusCode).toBe(200);

        const loginRes = await agent.post('/api/auth/login').send({ email, password });
        expect(loginRes.statusCode).toBe(200);
        expect(loginRes.body.success).toBe(true);

        const refreshRes = await agent.post('/api/auth/refresh').send({});
        expect(refreshRes.statusCode).toBe(200);
        expect(refreshRes.body.success).toBe(true);
    });
});

describe('Items flow', () => {
    test('create -> get -> update -> delete', async () => {
        const { agent } = await createVerifiedSession();

        const createRes = await agent.post('/api/items').send({
            type: 'url',
            title: 'Node Event Loop',
            description: 'Test description',
            url: 'https://nodejs.org',
        });

        expect(createRes.statusCode).toBe(201);
        expect(createRes.body.success).toBe(true);

        const itemId = createRes.body.data._id;

        const getRes = await agent.get(`/api/items/${itemId}`);
        expect(getRes.statusCode).toBe(200);
        expect(getRes.body.success).toBe(true);

        const updateRes = await agent.patch(`/api/items/${itemId}`).send({
            title: 'Node Event Loop Updated',
            status: 'processed',
        });

        expect(updateRes.statusCode).toBe(200);
        expect(updateRes.body.success).toBe(true);

        const deleteRes = await agent.delete(`/api/items/${itemId}`);
        expect(deleteRes.statusCode).toBe(200);
        expect(deleteRes.body.success).toBe(true);
    });
});

describe('Security and auth behavior', () => {
    test('returns unauthorized for protected route without token', async () => {
        const res = await request(app).get('/api/items');
        expect(res.statusCode).toBe(401);
        expect(res.body.success).toBe(false);
    });

    test('returns unauthorized for invalid token', async () => {
        const res = await request(app)
            .get('/api/items')
            .set('Authorization', 'Bearer invalid-token');

        expect(res.statusCode).toBe(401);
        expect(res.body.success).toBe(false);
    });

    test('returns unauthorized for expired token', async () => {
        const expiredToken = jwt.sign(
            { id: new mongoose.Types.ObjectId().toString() },
            process.env.JWT_SECRET,
            { expiresIn: -10 }
        );

        const res = await request(app)
            .get('/api/items')
            .set('Cookie', [`accessToken=${expiredToken}`]);

        expect(res.statusCode).toBe(401);
        expect(res.body.success).toBe(false);
    });

    test('rejects refreshToken cookie for protected route authentication', async () => {
        const refreshToken = jwt.sign(
            { id: new mongoose.Types.ObjectId().toString(), tokenId: 'refresh-cookie-token' },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        const res = await request(app)
            .get('/api/items')
            .set('Cookie', [`refreshToken=${refreshToken}`]);

        expect(res.statusCode).toBe(401);
        expect(res.body.success).toBe(false);
    });

    test('rejects refresh token used as bearer token on protected route', async () => {
        const refreshToken = jwt.sign(
            { id: new mongoose.Types.ObjectId().toString(), tokenId: 'refresh-bearer-token' },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        const res = await request(app)
            .get('/api/items')
            .set('Authorization', `Bearer ${refreshToken}`);

        expect(res.statusCode).toBe(401);
        expect(res.body.success).toBe(false);
    });
});

describe('Global rate limiting', () => {
    test('blocks when request limit is exceeded', async () => {
        let response;

        for (let i = 0; i < 101; i += 1) {
            response = await request(app)
                .post('/api/auth/verify-email?token=invalid')
                .send({});
        }

        expect(response.statusCode).toBe(429);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Too many requests');
    });
});
