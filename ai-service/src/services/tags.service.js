import OpenAI from 'openai';
import env from '../config/env.js';

const client = new OpenAI({
    apiKey: env.openAiApiKey,
    ...(env.openAiBaseUrl ? { baseURL: env.openAiBaseUrl } : {}),
});

const MODEL_TAGS = 'mistral-small-latest';
const TAG_REQUEST_TIMEOUT_MS = Number(process.env.AI_TAG_TIMEOUT_MS || 3500);
const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'you', 'are', 'was', 'were', 'have', 'has', 'had',
    'about', 'into', 'over', 'under', 'after', 'before', 'what', 'when', 'where', 'which', 'while', 'will', 'would',
    'note', 'notes', 'item', 'items', 'link', 'links', 'page', 'pages', 'content', 'summary', 'document', 'file',
]);

function normalizeTag(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function pickKeywordFallbackTags(text, max = 6) {
    const tokens = String(text || '')
        .toLowerCase()
        .match(/[a-z0-9]+/g) || [];

    const counts = new Map();
    tokens.forEach((token) => {
        if (token.length < 4 || STOP_WORDS.has(token)) return;
        counts.set(token, (counts.get(token) || 0) + 1);
    });

    const primary = Array.from(counts.entries())
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, max)
        .map(([token]) => normalizeTag(token))
        .filter(Boolean);

    if (primary.length >= 3) return primary;

    const extras = [...new Set(tokens)]
        .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
        .map((token) => normalizeTag(token))
        .filter(Boolean);

    return [...new Set([...primary, ...extras])].slice(0, Math.max(3, max));
}

function withTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`tag_generation_timeout_${timeoutMs}ms`)), timeoutMs);
        }),
    ]);
}

export async function generateTags(text) {
    const input = String(text || '').trim();
    if (!input) return [];

    const fallback = pickKeywordFallbackTags(input, 8);

    try {
        const response = await withTimeout(
            client.chat.completions.create({
                model: MODEL_TAGS,
                messages: [
                    {
                        role: 'system',
                        content: 'Extract 3-6 short, concise topic tags as lowercase single-word or hyphenated terms. Return JSON array only with string values. Example: ["machine-learning", "data-science", "python"]',
                    },
                    {
                        role: 'user',
                        content: input.slice(0, 12000),
                    },
                ],
                max_tokens: 140,
                temperature: 0,
                top_p: 0.1,
            }),
            TAG_REQUEST_TIMEOUT_MS,
        );

        const raw = String(response?.choices?.[0]?.message?.content || '[]').trim();

        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return fallback;

            const aiTags = [...new Set(parsed.map((tag) => normalizeTag(tag)).filter(Boolean))].slice(0, 8);
            if (!aiTags.length) return fallback;

            return [...new Set([...aiTags, ...fallback])].slice(0, 8);
        } catch {
            return fallback;
        }
    } catch {
        return fallback;
    }
}

export default {
    generateTags,
};
