import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { createHash } from 'crypto';
import env from '../config/env.js';
import * as jobRepository from '../modules/job/job.repository.js';

export const QUEUE_NAMES = {
    AI_PROCESSING: 'ai-processing',
    AI_DLQ: 'ai-dlq',
    NOTIFICATIONS: 'notifications',
};

const WORKER_HEARTBEAT_KEY = process.env.AI_WORKER_HEARTBEAT_KEY || 'linkora:ai-worker:heartbeat';

// summarize-item now also writes metadata.autoTags, so separate tag-item is not queued by default.
const AI_JOB_TYPES = ['summarize-item', 'embed-item', 'cluster-items'];
const QUERY_EMBEDDING_TTL_SECONDS = 60 * 60;

function getPriorityForType(type) {
    if (type === 'summarize-item') return 1;
    if (type === 'embed-item') return 2;
    if (type === 'cluster-items') return 5;
    return 3;
}

function getInitialDelayForType(type) {
    if (type === 'cluster-items') {
        return 2 * 60 * 1000;
    }

    return buildDelayForAttempt(1);
}

function shouldBypassQueueForCurrentRun() {
    const isTest = process.env.NODE_ENV === 'test';
    const explicitlyEnabled = process.env.ENABLE_AI_QUEUE_IN_TEST === 'true';
    return isTest && !explicitlyEnabled;
}

const MAX_IN_MEMORY_QUEUE = 5000;
const inMemoryFallback = [];
let redisConnection = null;
let queueRegistry = new Map();

function getRedisConnection() {
    if (redisConnection) return redisConnection;
    if (!env.REDIS_URL) return null;

    redisConnection = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });

    return redisConnection;
}

function getQueue(name) {
    if (queueRegistry.has(name)) {
        return queueRegistry.get(name);
    }

    const connection = getRedisConnection();
    if (!connection) return null;

    const queue = new Queue(name, {
        connection,
        skipVersionCheck: true,
    });
    queueRegistry.set(name, queue);
    return queue;
}

function buildDelayForAttempt(attempt) {
    if (attempt <= 1) return 0;
    if (attempt === 2) return 30 * 1000;
    return 5 * 60 * 1000;
}

export function initQueueInfrastructure() {
    getQueue(QUEUE_NAMES.AI_PROCESSING);
    getQueue(QUEUE_NAMES.AI_DLQ);
    getQueue(QUEUE_NAMES.NOTIFICATIONS);
}

export async function enqueueDlq(payload) {
    const dlq = getQueue(QUEUE_NAMES.AI_DLQ);

    if (!dlq) {
        if (inMemoryFallback.length < MAX_IN_MEMORY_QUEUE) {
            inMemoryFallback.push({ queue: QUEUE_NAMES.AI_DLQ, payload });
        }
        return null;
    }

    return dlq.add('dlq-event', payload, {
        removeOnComplete: 500,
        removeOnFail: 500,
    });
}

export async function enqueueNotification(payload) {
    const notifications = getQueue(QUEUE_NAMES.NOTIFICATIONS);

    if (!notifications) {
        if (inMemoryFallback.length < MAX_IN_MEMORY_QUEUE) {
            inMemoryFallback.push({ queue: QUEUE_NAMES.NOTIFICATIONS, payload });
        }
        return null;
    }

    return notifications.add('notification-event', payload, {
        removeOnComplete: 500,
        removeOnFail: 500,
    });
}

export async function enqueueAiPipelineJobs(itemId, userId) {
    if (shouldBypassQueueForCurrentRun()) {
        return [];
    }

    const processingQueue = getQueue(QUEUE_NAMES.AI_PROCESSING);
    const normalizedItemId = String(itemId || '').trim();
    const normalizedUserId = String(userId || '').trim();

    if (!normalizedItemId || !normalizedUserId) {
        throw new Error('enqueue_invalid_identifiers');
    }

    if (!processingQueue) {
        console.warn(JSON.stringify({
            event: 'queue_unavailable',
            reason: 'processingQueue is null - Redis connection may be unavailable',
            redisUrl: process.env.REDIS_URL ? '***configured***' : 'not configured',
            fallbackUsed: true,
        }));
        if (inMemoryFallback.length < MAX_IN_MEMORY_QUEUE) {
            inMemoryFallback.push({
                queue: QUEUE_NAMES.AI_PROCESSING,
                payload: {
                    itemId: normalizedItemId,
                    userId: normalizedUserId,
                    fallback: true,
                },
            });
        }
        return [];
    }

    const queuedJobs = [];

    for (const type of AI_JOB_TYPES) {
        try {
            const existingPending = await jobRepository.findPendingJobByItemAndType(
                normalizedUserId,
                normalizedItemId,
                type
            );

            if (existingPending) {
                queuedJobs.push({
                    type,
                    queueJobId: existingPending.queueJobId || null,
                    jobId: String(existingPending._id),
                    deduped: true,
                });

                console.info(JSON.stringify({
                    event: 'ai_job_enqueue_skipped_duplicate',
                    type,
                    itemId: normalizedItemId,
                    userId: normalizedUserId,
                    jobId: String(existingPending._id),
                    queueJobId: String(existingPending.queueJobId || ''),
                }));
                continue;
            }

            const jobDoc = await jobRepository.createJob({
                userId: normalizedUserId,
                itemId: normalizedItemId,
                type,
                status: 'pending',
                attempts: 0,
            });

            const bullJob = await processingQueue.add(
                type,
                {
                    userId: normalizedUserId,
                    itemId: normalizedItemId,
                    type,
                    jobId: String(jobDoc._id),
                    attempt: 1,
                },
                {
                    delay: getInitialDelayForType(type),
                    priority: getPriorityForType(type),
                    removeOnComplete: 500,
                    removeOnFail: 500,
                }
            );

            await jobRepository.attachQueueJobId(jobDoc._id, String(bullJob.id));
            queuedJobs.push({ type, queueJobId: bullJob.id, jobId: String(jobDoc._id) });

            console.info(JSON.stringify({
                event: 'ai_job_enqueued',
                type,
                itemId: normalizedItemId,
                userId: normalizedUserId,
                jobId: String(jobDoc._id),
                queueJobId: String(bullJob.id),
            }));
        } catch (jobError) {
            console.error(JSON.stringify({
                event: 'ai_job_enqueue_error',
                type,
                itemId: normalizedItemId,
                userId: normalizedUserId,
                error: jobError.message,
                code: jobError.code,
            }));
            throw jobError;
        }
    }

    return queuedJobs;
}

export async function enqueueClusterRebuildJob(itemId, userId, options = {}) {
    if (shouldBypassQueueForCurrentRun()) {
        return null;
    }

    const processingQueue = getQueue(QUEUE_NAMES.AI_PROCESSING);
    const normalizedItemId = String(itemId || '').trim();
    const normalizedUserId = String(userId || '').trim();

    if (!normalizedItemId || !normalizedUserId) {
        throw new Error('enqueue_invalid_identifiers');
    }

    if (!processingQueue) {
        return null;
    }

    const existingPending = await jobRepository.findPendingJobByItemAndType(
        normalizedUserId,
        normalizedItemId,
        'cluster-items'
    );

    if (existingPending) {
        return {
            queueJobId: existingPending.queueJobId || null,
            jobId: String(existingPending._id),
            deduped: true,
        };
    }

    const jobDoc = await jobRepository.createJob({
        userId: normalizedUserId,
        itemId: normalizedItemId,
        type: 'cluster-items',
        status: 'pending',
        attempts: 0,
    });

    const bullJob = await processingQueue.add(
        'cluster-items',
        {
            userId: normalizedUserId,
            itemId: normalizedItemId,
            type: 'cluster-items',
            jobId: String(jobDoc._id),
            attempt: 1,
            reason: String(options.reason || 'manual').slice(0, 120),
        },
        {
            delay: Number(options.delayMs || 0),
            removeOnComplete: 500,
            removeOnFail: 500,
        }
    );

    await jobRepository.attachQueueJobId(jobDoc._id, String(bullJob.id));

    return {
        queueJobId: bullJob.id,
        jobId: String(jobDoc._id),
    };
}

function buildQueryEmbeddingCacheKey(query) {
    const normalized = String(query || '').trim().toLowerCase();
    const digest = createHash('sha256').update(normalized).digest('hex');
    return `semantic:query:${digest}`;
}

export async function enqueueQueryEmbeddingJob(query, userId) {
    if (shouldBypassQueueForCurrentRun()) return null;

    const processingQueue = getQueue(QUEUE_NAMES.AI_PROCESSING);
    const normalized = String(query || '').trim();
    if (!processingQueue || !normalized) return null;

    const cacheKey = buildQueryEmbeddingCacheKey(normalized);

    return processingQueue.add(
        'embed-query',
        {
            type: 'embed-query',
            query: normalized,
            userId: String(userId || ''),
            cacheKey,
            attempt: 1,
        },
        {
            jobId: `embed-query-${cacheKey}`,
            removeOnComplete: 500,
            removeOnFail: 500,
        }
    );
}

export async function getCachedQueryEmbedding(query) {
    const connection = getRedisConnection();
    if (!connection) return [];

    const cacheKey = buildQueryEmbeddingCacheKey(query);
    const raw = await connection.get(cacheKey);
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export async function cacheQueryEmbedding(query, embedding) {
    const connection = getRedisConnection();
    if (!connection || !Array.isArray(embedding) || embedding.length === 0) return false;

    const cacheKey = buildQueryEmbeddingCacheKey(query);
    await connection.set(cacheKey, JSON.stringify(embedding), 'EX', QUERY_EMBEDDING_TTL_SECONDS);
    return true;
}

export async function retryDlqJob(payload) {
    const processingQueue = getQueue(QUEUE_NAMES.AI_PROCESSING);
    if (!processingQueue || !payload?.type) return null;

    return processingQueue.add(payload.type, {
        ...payload,
        attempt: 1,
        retriedFromDlq: true,
    }, {
        removeOnComplete: 500,
        removeOnFail: 500,
    });
}

export function getFallbackQueueSize() {
    return inMemoryFallback.length;
}

export async function testRedisConnection() {
    try {
        const connection = getRedisConnection();
        if (!connection) {
            return {
                connected: false,
                reason: 'REDIS_URL not configured',
                config: {
                    host: process.env.REDIS_HOST || 'not set',
                    port: process.env.REDIS_PORT || 'not set',
                    passwordConfigured: !!process.env.REDIS_PASSWORD,
                }
            };
        }

        // Try to ping Redis
        const result = await connection.ping();
        if (result === 'PONG') {
            return {
                connected: true,
                ping: 'PONG',
                config: {
                    host: process.env.REDIS_HOST,
                    port: process.env.REDIS_PORT,
                }
            };
        }
        
        return {
            connected: false,
            reason: 'Redis ping failed',
            response: result,
        };
    } catch (error) {
        return {
            connected: false,
            reason: error.message,
            code: error.code,
        };
    }
}

export async function getAiQueueHealth() {
    const redis = await testRedisConnection();
    const processingQueue = getQueue(QUEUE_NAMES.AI_PROCESSING);
    let worker = {
        online: false,
        lastSeenAt: null,
    };

    try {
        const connection = getRedisConnection();
        if (connection) {
            const rawHeartbeat = await connection.get(WORKER_HEARTBEAT_KEY);
            if (rawHeartbeat) {
                const parsed = JSON.parse(rawHeartbeat);
                const ts = Number(parsed?.ts || 0);
                worker = {
                    online: Number.isFinite(ts) && ts > 0,
                    lastSeenAt: Number.isFinite(ts) && ts > 0 ? new Date(ts).toISOString() : null,
                };
            }
        }
    } catch {
        worker = {
            online: false,
            lastSeenAt: null,
        };
    }

    if (!processingQueue) {
        return {
            available: false,
            reason: redis.connected ? 'processing_queue_unavailable' : 'redis_unavailable',
            worker,
            counts: {
                waiting: 0,
                active: 0,
                delayed: 0,
                prioritized: 0,
                fallback: getFallbackQueueSize(),
            },
        };
    }

    try {
        const counts = await processingQueue.getJobCounts('waiting', 'active', 'delayed', 'prioritized');
        return {
            available: true,
            reason: null,
            worker,
            counts: {
                waiting: Number(counts.waiting || 0),
                active: Number(counts.active || 0),
                delayed: Number(counts.delayed || 0),
                prioritized: Number(counts.prioritized || 0),
                fallback: getFallbackQueueSize(),
            },
        };
    } catch (error) {
        return {
            available: false,
            reason: error.message || 'queue_count_failed',
            worker,
            counts: {
                waiting: 0,
                active: 0,
                delayed: 0,
                prioritized: 0,
                fallback: getFallbackQueueSize(),
            },
        };
    }
}
