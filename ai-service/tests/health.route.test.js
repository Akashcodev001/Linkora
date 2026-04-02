import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/server.js';

const INTERNAL_KEY = process.env.AI_SERVICE_INTERNAL_KEY || 'missing-key';

test('GET /health returns 401 without internal key', async () => {
    const response = await request(app).get('/health');

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
});

test('GET /health returns 200 with valid internal key', async () => {
    const response = await request(app)
        .get('/health')
        .set('X-Internal-Key', INTERNAL_KEY);

    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.message, 'AI service healthy');
});
