/**
 * Tags Service
 * Uses mistral-small-latest for efficient tag extraction
 */

import OpenAI from 'openai';
import env from '../config/env.js';

const client = new OpenAI({
    apiKey: env.openAiApiKey,
    ...(env.openAiBaseUrl ? { baseURL: env.openAiBaseUrl } : {}),
});

const MODEL_TAGS = 'mistral-small-latest';

export async function generateTags(text) {
    const input = String(text || '').trim();
    if (!input) return [];

    try {
        const response = await client.chat.completions.create({
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
            max_tokens: 160,
            temperature: 0,
            top_p: 0.1,
        });

        const raw = String(response?.choices?.[0]?.message?.content || '[]').trim();

        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return [...new Set(parsed.map((t) => String(t || '').toLowerCase().trim()).filter(Boolean))].slice(0, 8);
        } catch {
            return [];
        }
    } catch (error) {
        throw new Error(`Tag generation failed: ${error.message}`);
    }
}

export default {
    generateTags,
};
