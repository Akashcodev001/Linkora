import express from 'express';
import { pathToFileURL } from 'url';
import env from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { closeRedis, enforceRedisQueueSafety } from './config/redis.js';
import { logEvent } from './config/logger.js';
import { startAiWorker, stopAiWorker } from './workers/ai.worker.js';

export const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
    const provided = String(req.header('X-Internal-Key') || '').trim();
    if (!provided || provided !== env.aiServiceInternalKey) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    return res.status(200).json({ success: true, message: 'AI service healthy' });
});

let server;
let started = false;

export async function bootstrap() {
    if (started) return;
    await connectDatabase();
    await enforceRedisQueueSafety();
    startAiWorker();

    server = app.listen(env.port, () => {
        logEvent('info', 'ai_service_started', { port: env.port, mode: env.nodeEnv });
    });

    started = true;
}

export async function shutdown() {
    if (!started) return;
    logEvent('info', 'shutdown_start');
    await stopAiWorker();
    await closeRedis();
    await disconnectDatabase();

    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }

    logEvent('info', 'shutdown_complete');
    started = false;
}

process.on('SIGINT', async () => {
    await shutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await shutdown();
    process.exit(0);
});

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
    bootstrap().catch(async (error) => {
        logEvent('error', 'startup_failed', { error: error.message });
        await shutdown();
        process.exit(1);
    });
}
