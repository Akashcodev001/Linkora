import IORedis from 'ioredis';
import env from './env.js';
import { logEvent } from './logger.js';

let redis;

export function getRedis() {
    if (redis) return redis;

    redis = new IORedis(env.redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    });

    redis.on('error', (error) => {
        logEvent('error', 'redis_error', { error: error.message });
    });

    return redis;
}

export async function enforceRedisQueueSafety() {
    const client = getRedis();

    try {
        const current = await client.config('GET', 'maxmemory-policy');
        const policy = Array.isArray(current) ? String(current[1] || '').toLowerCase() : '';

        if (policy && policy !== 'noeviction') {
            try {
                await client.config('SET', 'maxmemory-policy', 'noeviction');
                logEvent('info', 'redis_policy_set', { from: policy, to: 'noeviction' });
            } catch {
                logEvent('info', 'redis_policy_warning', {
                    currentPolicy: policy,
                    recommendation: 'Set maxmemory-policy=noeviction in your Redis dashboard for BullMQ safety',
                });
            }
        }
    } catch {
        logEvent('info', 'redis_policy_check_skipped', {
            reason: 'CONFIG not available on this provider',
        });
    }
}

export async function closeRedis() {
    if (!redis) return;
    await redis.quit();
    redis = null;
}
