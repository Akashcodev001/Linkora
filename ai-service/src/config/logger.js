export function logEvent(level, message, payload = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        logger: 'ai-worker-node',
        ...payload,
    };

    if (level === 'error') {
        console.error(JSON.stringify(entry));
        return;
    }

    console.log(JSON.stringify(entry));
}
