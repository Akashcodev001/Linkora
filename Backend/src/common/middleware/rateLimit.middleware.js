import { sendError } from "../helpers/response.js";

const requestStore = new Map();

/**
 * Rate limiter middleware - tracks requests per IP and enforces limits
 * @param {number} maxRequests - Maximum requests allowed in the window
 * @param {number} windowMs - Time window in milliseconds
 */
export function rateLimit(maxRequests = 5, windowMs = 15 * 60 * 1000) {
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const key = `${ip}:${req.path}`;
        const now = Date.now();

        if (!requestStore.has(key)) {
            requestStore.set(key, []);
        }

        const requests = requestStore.get(key);

        // Remove old requests outside the window
        const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
        requestStore.set(key, validRequests);

        if (validRequests.length >= maxRequests) {
            const oldestRequest = validRequests[0];
            const resetTime = Math.ceil((oldestRequest + windowMs - now) / 1000);

            return sendError(
                res,
                `Too many requests. Try again in ${resetTime} seconds.`,
                "Rate limit exceeded",
                429
            );
        }

        validRequests.push(now);
        requestStore.set(key, validRequests);

        next();
    };
}

/**
 * Clean up old entries every 5 minutes to prevent memory leak
 */
setInterval(() => {
    const now = Date.now();
    const expireTime = 30 * 60 * 1000; // Keep last 30 minutes

    for (const [key, timestamps] of requestStore.entries()) {
        const validTimestamps = timestamps.filter(ts => now - ts < expireTime);
        if (validTimestamps.length === 0) {
            requestStore.delete(key);
        } else {
            requestStore.set(key, validTimestamps);
        }
    }
}, 5 * 60 * 1000);

export function clearRateLimitStore() {
    requestStore.clear();
}
