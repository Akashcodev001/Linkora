import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';

let redisClient = null;
let limiter = null;

function resolveToken(req) {
    const cookieToken = req.cookies?.accessToken || req.cookies?.token;
    if (cookieToken) return cookieToken;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }

    return null;
}

function resolveRateLimitKey(req) {
    if (req.user?.id) {
        return `user:${req.user.id}`;
    }

    const token = resolveToken(req);
    if (token) {
        try {
            const decoded = jwt.verify(token, env.JWT_SECRET);
            if (decoded?.id) {
                return `user:${decoded.id}`;
            }
        } catch {
            // Ignore invalid token and fallback to IP identity.
        }
    }

    return `ip:${ipKeyGenerator(req.ip || '127.0.0.1')}`;
}

function getStore() {
    if (env.NODE_ENV === 'test') return undefined;
    if (!env.REDIS_URL) return undefined;

    if (!redisClient) {
        redisClient = createClient({ url: env.REDIS_URL });
        redisClient.connect().catch(() => {
            redisClient = null;
        });
    }

    if (!redisClient) return undefined;

    return new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
    });
}

function createLimiter() {
    const defaultLimit = Number(env.RATE_LIMIT_MAX_REQUESTS || 100);
    const apiGetPath = /^\/api\//;
    const authSessionPath = /^\/api\/auth\/(?:me|get-me|refresh|token-check)$/;

    return rateLimit({
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        limit: (req) => {
            if (authSessionPath.test(req.path || '')) {
                return Math.max(defaultLimit, 1200);
            }

            if (req.method === 'GET' && apiGetPath.test(req.path || '')) {
                return Math.max(defaultLimit, 1800);
            }

            if (req.method === 'GET' && (req.path === '/api/health' || req.path === '/health')) {
                return Math.max(defaultLimit, 1000);
            }

            return defaultLimit;
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: resolveRateLimitKey,
        message: {
            success: false,
            message: 'Too many requests. Please try again later.',
            data: null,
        },
        store: getStore(),
    });
}

export function globalRateLimit() {
    if (!limiter) {
        limiter = createLimiter();
    }

    return limiter;
}

export function resetGlobalRateLimitStore() {
    if (limiter?.resetKey) {
        // Jest-only helper to keep compatibility with existing tests.
        limiter.resetKey('ip:127.0.0.1');
    }
}
