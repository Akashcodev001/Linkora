import express from 'express';
import cookiesParser from 'cookie-parser';
import helmet from 'helmet';
import hpp from 'hpp';
const app = express();
import authRouter from './modules/auth/auth.routes.js';
import itemRouter from './modules/item/item.routes.js';
import itemPublicRouter from './modules/item/item.public.routes.js';
import collectionRouter from './modules/collection/collection.routes.js';
import tagRouter from './modules/tag/tag.routes.js';
import highlightRouter from './modules/highlight/highlight.routes.js';
import graphRouter from './modules/graph/graph.routes.js';
import searchRouter from './modules/search/search.routes.js';
import resurfacingRouter from './modules/resurfacing/resurfacing.routes.js';
import adminRouter from './modules/admin/admin.routes.js';
import passport from './config/passport.js';
import morgan from 'morgan';
import cors from 'cors';
import { notFoundHandler, errorHandler } from './common/middleware/error.middleware.js';
import { globalRateLimit } from './common/middleware/globalRateLimit.middleware.js';
import env from './config/env.js';
import { getAiQueueHealth, testRedisConnection } from './queues/processing.queue.js';

// Security middleware
app.use(helmet());
app.use(hpp());

app.use(express.json());
app.use(cookiesParser());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }

        const allowedExact = new Set([
            env.FRONTEND_URL,
        ]);

        const isExtensionOrigin =
            origin.startsWith('chrome-extension://') ||
            origin.startsWith('moz-extension://') ||
            /^https:\/\/[a-z0-9-]+\.chromiumapp\.org$/i.test(origin);

        if (allowedExact.has(origin) || isExtensionOrigin) {
            return callback(null, true);
        }

        return callback(new Error('CORS origin not allowed'));
    },
    credentials: true
}));
app.use(express.urlencoded({extended:true}));
app.use(
    morgan('dev', {
        skip: (req, res) => {
            if (req.path === '/health' || req.path === '/api/health') {
                return true;
            }

            return Number(res.statusCode) === 304;
        },
    })
);
app.use(globalRateLimit());
app.use(passport.initialize());

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
    try {
        const redisStatus = await testRedisConnection();
        const aiQueue = await getAiQueueHealth();
        return res.json({
            status: 'ok',
            redis: redisStatus,
            aiQueue,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return res.status(503).json({
            status: 'degraded',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

app.get('/api/health', async (req, res) => {
    try {
        const redisStatus = await testRedisConnection();
        const aiQueue = await getAiQueueHealth();
        return res.json({
            status: 'ok',
            redis: redisStatus,
            aiQueue,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return res.status(503).json({
            status: 'degraded',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});

/**
 * Routes
 */
app.use('/api/auth', authRouter);
app.use('/api/shared/items', itemPublicRouter);
app.use('/api/items', itemRouter);
app.use('/api/collections', collectionRouter);
app.use('/api/tags', tagRouter);
app.use('/api/highlights', highlightRouter);
app.use('/api/graph', graphRouter);
app.use('/api/search', searchRouter);
app.use('/api/resurfacing', resurfacingRouter);
app.use('/api/admin', adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;