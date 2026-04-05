import dotenv from 'dotenv';

dotenv.config();

function buildRedisUrl() {
    const host = process.env.REDIS_HOST;
    const port = process.env.REDIS_PORT;

    // In local development, prefer host/port to avoid Render-private REDIS_URL values.
    if ((process.env.NODE_ENV || 'development') !== 'production' && host && port) {
        const password = process.env.REDIS_PASSWORD || '';
        const auth = password ? `:${password}@` : '';
        return `redis://${auth}${host}:${port}`;
    }

    if (process.env.REDIS_URL) return process.env.REDIS_URL;
    if (!host || !port) return '';

    const password = process.env.REDIS_PASSWORD || '';
    const auth = password ? `:${password}@` : '';
    return `redis://${auth}${host}:${port}`;
}

function must(name, fallback = '') {
    const value = (process.env[name] || fallback || '').trim();
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

const env = {
    nodeEnv: (process.env.NODE_ENV || 'development').trim(),
    port: Number(process.env.PORT || 5001),
    mongodbUri: must('MONGODB_URI', 'mongodb://localhost:27017/linkora'),
    redisUrl: buildRedisUrl(),
    queuePrefix: (process.env.BULLMQ_PREFIX || 'bull').trim(),
    aiServiceInternalKey: must('AI_SERVICE_INTERNAL_KEY'),
    openAiApiKey: must('OPENAI_API_KEY', process.env.MISTRAL_API_KEY || ''),
    openAiBaseUrl: (
        process.env.OPENAI_BASE_URL
        || (!process.env.OPENAI_API_KEY ? 'https://api.mistral.ai/v1' : '')
    ).trim(),
    openAiModelText: (
        process.env.OPENAI_MODEL_TEXT
        || (process.env.OPENAI_API_KEY ? 'gpt-4o-mini' : 'mistral-small-latest')
    ).trim(),
    openAiModelEmbedding: (
        process.env.OPENAI_MODEL_EMBEDDING
        || (process.env.OPENAI_API_KEY ? 'text-embedding-ada-002' : 'mistral-embed')
    ).trim(),
    geminiApiKey: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.APP_GEMINI_API_KEY || '').trim(),
    geminiImageModel: (process.env.GEMINI_IMAGE_MODEL || process.env.APP_GEMINI_IMAGE_MODEL || 'gemini-1.5-flash').trim(),
    qdrantUrl: (process.env.QDRANT_URL || process.env.QDRANT_CLUSTER_ENDPOINT || '').trim(),
    qdrantApiKey: (process.env.QDRANT_API_KEY || '').trim(),
    qdrantCollectionName: (process.env.QDRANT_COLLECTION_NAME || 'items').trim(),
    qdrantVectorSize: Number(process.env.QDRANT_VECTOR_SIZE || 1536),
};

if (!env.redisUrl) {
    throw new Error('Missing Redis configuration. Set REDIS_URL or REDIS_HOST+REDIS_PORT.');
}

export default env;
