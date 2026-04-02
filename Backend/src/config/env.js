import "dotenv/config";

function pickEnv(...keys) {
    for (const key of keys) {
        const value = process.env[key];
        if (typeof value === 'string') {
            const normalized = value.trim();
            if (!normalized) continue;

            // Ignore template placeholders so real legacy env keys can be used.
            if (normalized.startsWith('REPLACE_WITH_')) continue;

            return normalized;
        }
    }
    return '';
}

const aliasMap = [
    ['MONGODB_URI', pickEnv('MONGODB_URI', 'APP_MONGODB_URI')],
    ['JWT_SECRET', pickEnv('JWT_SECRET', 'APP_JWT_SECRET')],
    ['JWT_REFRESH_SECRET', pickEnv('JWT_REFRESH_SECRET', 'APP_JWT_REFRESH_SECRET', 'JWT_SECRET', 'APP_JWT_SECRET')],
    ['AI_SERVICE_INTERNAL_KEY', pickEnv('AI_SERVICE_INTERNAL_KEY', 'APP_AI_SERVICE_INTERNAL_KEY')],
    ['GOOGLE_CLIENT_ID', pickEnv('GOOGLE_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_ID', 'APP_GOOGLE_OAUTH_CLIENT_ID')],
    ['GOOGLE_CLIENT_SECRET', pickEnv('GOOGLE_CLIENT_SECRET', 'GOOGLE_OAUTH_CLIENT_SECRET', 'APP_GOOGLE_OAUTH_CLIENT_SECRET')],
    ['GOOGLE_OAUTH_CLIENT_ID', pickEnv('GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_CLIENT_ID', 'APP_GOOGLE_OAUTH_CLIENT_ID')],
    ['GOOGLE_OAUTH_CLIENT_SECRET', pickEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET', 'APP_GOOGLE_OAUTH_CLIENT_SECRET')],
    ['GOOGLE_REFRESH_TOKEN', pickEnv('GOOGLE_REFRESH_TOKEN', 'APP_GOOGLE_REFRESH_TOKEN')],
    ['GOOGLE_USER', pickEnv('GOOGLE_USER', 'APP_GOOGLE_USER')],
    ['GOOGLE_APP_PASSWORD', pickEnv('GOOGLE_APP_PASSWORD', 'APP_GOOGLE_APP_PASSWORD')],
    ['GITHUB_CLIENT_ID', pickEnv('GITHUB_CLIENT_ID', 'GITHUB_OAUTH_CLIENT_ID', 'APP_GITHUB_OAUTH_CLIENT_ID')],
    ['GITHUB_CLIENT_SECRET', pickEnv('GITHUB_CLIENT_SECRET', 'GITHUB_OAUTH_CLIENT_SECRET', 'APP_GITHUB_OAUTH_CLIENT_SECRET')],
    ['GITHUB_OAUTH_CLIENT_ID', pickEnv('GITHUB_OAUTH_CLIENT_ID', 'GITHUB_CLIENT_ID', 'APP_GITHUB_OAUTH_CLIENT_ID')],
    ['GITHUB_OAUTH_CLIENT_SECRET', pickEnv('GITHUB_OAUTH_CLIENT_SECRET', 'GITHUB_CLIENT_SECRET', 'APP_GITHUB_OAUTH_CLIENT_SECRET')],
    ['ADMIN_EMAILS', pickEnv('ADMIN_EMAILS', 'APP_ADMIN_EMAILS')],
];

for (const [legacyKey, value] of aliasMap) {
    if (value && (!process.env[legacyKey] || !String(process.env[legacyKey]).trim())) {
        process.env[legacyKey] = value;
    }
}

function buildRedisUrl() {
    const directUrl = pickEnv('REDIS_URL', 'APP_REDIS_URL');
    if (directUrl) return directUrl;

    const host = pickEnv('REDIS_HOST', 'APP_REDIS_HOST');
    const port = pickEnv('REDIS_PORT', 'APP_REDIS_PORT');
    if (!host || !port) return "";

    const password = pickEnv('REDIS_PASSWORD', 'APP_REDIS_PASSWORD');
    const authPart = password ? `:${encodeURIComponent(password)}@` : "";
    return `redis://${authPart}${host}:${port}`;
}

const requiredKeys = [
    "PORT",
    "MONGODB_URI|APP_MONGODB_URI",
    "JWT_SECRET|APP_JWT_SECRET",
    "BACKEND_URL",
    "FRONTEND_URL",
];

const missingKeys = requiredKeys.filter((key) => {
    const options = key.split('|');
    const value = pickEnv(...options);
    return typeof value !== "string" || value.trim() === "";
});

if (missingKeys.length > 0) {
    throw new Error(`Missing required environment variables: ${missingKeys.join(", ")}`);
}

const env = {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: Number(process.env.PORT) || 3000,
    MONGODB_URI: pickEnv('MONGODB_URI', 'APP_MONGODB_URI'),
    JWT_SECRET: pickEnv('JWT_SECRET', 'APP_JWT_SECRET'),
    JWT_REFRESH_SECRET: pickEnv('JWT_REFRESH_SECRET', 'APP_JWT_REFRESH_SECRET', 'JWT_SECRET', 'APP_JWT_SECRET'),
    BACKEND_URL: process.env.BACKEND_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    REDIS_URL: buildRedisUrl(),
    RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100),
    OPENAI_API_KEY: pickEnv('OPENAI_API_KEY', 'APP_OPENAI_API_KEY'),
    OPENAI_EMBEDDING_MODEL: pickEnv('OPENAI_EMBEDDING_MODEL', 'APP_OPENAI_EMBEDDING_MODEL') || 'text-embedding-3-small',
    AI_PROVIDER: pickEnv('AI_PROVIDER', 'APP_AI_PROVIDER') || 'huggingface',
    AI_SERVICE_INTERNAL_KEY: pickEnv('AI_SERVICE_INTERNAL_KEY', 'APP_AI_SERVICE_INTERNAL_KEY'),
    QDRANT_URL: pickEnv('QDRANT_URL', 'QDRANT_CLUSTER_ENDPOINT', 'APP_QDRANT_URL'),
    QDRANT_API_KEY: pickEnv('QDRANT_API_KEY', 'APP_QDRANT_API_KEY'),
    QDRANT_COLLECTION_NAME: pickEnv('QDRANT_COLLECTION_NAME', 'APP_QDRANT_COLLECTION_NAME') || 'items',
    QDRANT_VECTOR_SIZE: Number(pickEnv('QDRANT_VECTOR_SIZE', 'APP_QDRANT_VECTOR_SIZE') || 1024),
    CLOUDINARY_CLOUD_NAME: pickEnv('CLOUDINARY_CLOUD_NAME', 'APP_CLOUDINARY_CLOUD_NAME'),
    CLOUDINARY_API_KEY: pickEnv('CLOUDINARY_API_KEY', 'APP_CLOUDINARY_API_KEY'),
    CLOUDINARY_API_SECRET: pickEnv('CLOUDINARY_API_SECRET', 'APP_CLOUDINARY_API_SECRET'),
    CONTENT_BLOCKED_DOMAINS: pickEnv('CONTENT_BLOCKED_DOMAINS', 'APP_CONTENT_BLOCKED_DOMAINS'),
    CONTENT_FETCH_TIMEOUT_MS: Number(pickEnv('CONTENT_FETCH_TIMEOUT_MS', 'APP_CONTENT_FETCH_TIMEOUT_MS') || 7000),
    CONTENT_UPLOAD_MAX_MB: Number(pickEnv('CONTENT_UPLOAD_MAX_MB', 'APP_CONTENT_UPLOAD_MAX_MB') || 8),
    GOOGLE_OAUTH_CLIENT_ID: pickEnv('GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_CLIENT_ID', 'APP_GOOGLE_OAUTH_CLIENT_ID'),
    GOOGLE_OAUTH_CLIENT_SECRET: pickEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET', 'APP_GOOGLE_OAUTH_CLIENT_SECRET'),
    GOOGLE_OAUTH_CALLBACK_URL:
        pickEnv('GOOGLE_OAUTH_CALLBACK_URL', 'APP_GOOGLE_OAUTH_CALLBACK_URL') || `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/google/callback`,
    GITHUB_OAUTH_CLIENT_ID: pickEnv('GITHUB_OAUTH_CLIENT_ID', 'GITHUB_CLIENT_ID', 'APP_GITHUB_OAUTH_CLIENT_ID'),
    GITHUB_OAUTH_CLIENT_SECRET: pickEnv('GITHUB_OAUTH_CLIENT_SECRET', 'GITHUB_CLIENT_SECRET', 'APP_GITHUB_OAUTH_CLIENT_SECRET'),
    GITHUB_OAUTH_CALLBACK_URL:
        pickEnv('GITHUB_OAUTH_CALLBACK_URL', 'APP_GITHUB_OAUTH_CALLBACK_URL') || `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/github/callback`,
    AUTH_OAUTH_SUCCESS_REDIRECT:
        pickEnv('AUTH_OAUTH_SUCCESS_REDIRECT', 'APP_AUTH_OAUTH_SUCCESS_REDIRECT') || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/oauth/success`,
    AUTH_OAUTH_FAILURE_REDIRECT:
        pickEnv('AUTH_OAUTH_FAILURE_REDIRECT', 'APP_AUTH_OAUTH_FAILURE_REDIRECT') || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/oauth/error`,
    ADMIN_EMAILS: pickEnv('ADMIN_EMAILS', 'APP_ADMIN_EMAILS'),
};

export default env;