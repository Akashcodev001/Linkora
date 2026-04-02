import { Worker } from 'bullmq';
import env from '../config/env.js';
import { getRedis } from '../config/redis.js';
import { logEvent } from '../config/logger.js';
import { handleJobFailure, processJob } from '../services/job.service.js';

let worker;
let hasLoggedReady = false;
let heartbeatInterval = null;

const WORKER_HEARTBEAT_KEY = process.env.AI_WORKER_HEARTBEAT_KEY || 'linkora:ai-worker:heartbeat';
const WORKER_HEARTBEAT_TTL_SECONDS = Number(process.env.AI_WORKER_HEARTBEAT_TTL_SECONDS || 20);
const WORKER_HEARTBEAT_INTERVAL_MS = Number(process.env.AI_WORKER_HEARTBEAT_INTERVAL_MS || 5000);

async function emitHeartbeat() {
    try {
        const redis = getRedis();
        await redis.set(
            WORKER_HEARTBEAT_KEY,
            JSON.stringify({
                ts: Date.now(),
                pid: process.pid,
                queue: 'ai-processing',
            }),
            'EX',
            WORKER_HEARTBEAT_TTL_SECONDS
        );
    } catch (error) {
        logEvent('error', 'worker_heartbeat_failed', { error: error.message });
    }
}

function startHeartbeat() {
    if (heartbeatInterval) return;
    emitHeartbeat();
    heartbeatInterval = setInterval(() => {
        emitHeartbeat();
    }, WORKER_HEARTBEAT_INTERVAL_MS);
}

async function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }

    try {
        const redis = getRedis();
        await redis.del(WORKER_HEARTBEAT_KEY);
    } catch {
        // Ignore shutdown cleanup errors.
    }
}

export function startAiWorker() {
    if (worker) {
        return worker;
    }

    const connection = getRedis();

    worker = new Worker(
        'ai-processing',
        async (job) => {
            try {
                await processJob(job);
            } catch (error) {
                await handleJobFailure(job, error);
            }
        },
        {
            connection,
            prefix: env.queuePrefix,
            skipVersionCheck: true,
            concurrency: Number(process.env.AI_WORKER_CONCURRENCY || 3),
            removeOnComplete: { count: 500 },
            removeOnFail: { count: 500 },
        }
    );

    worker.on('ready', () => {
        if (!hasLoggedReady) {
            logEvent('info', 'worker_started', {
                queue: 'ai-processing',
                queuePrefix: env.queuePrefix,
            });
            hasLoggedReady = true;
            startHeartbeat();
            return;
        }

        logEvent('info', 'worker_reconnected', {
            queue: 'ai-processing',
            queuePrefix: env.queuePrefix,
        });
        startHeartbeat();
    });

    worker.on('error', (error) => {
        logEvent('error', 'worker_error', { error: error.message });
    });

    return worker;
}

export async function stopAiWorker() {
    if (!worker) return;
    await stopHeartbeat();
    await worker.close();
    worker = null;
    hasLoggedReady = false;
}
