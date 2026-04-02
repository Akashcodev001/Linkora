/**
 * OpenAI/Mistral Service
 * Handles embedding generation only (backward compatible)
 * Summary and Tags use dedicated services (summary.service.js, tags.service.js)
 */

import OpenAI from 'openai';
import env from '../config/env.js';

const client = new OpenAI({
    apiKey: env.openAiApiKey,
    ...(env.openAiBaseUrl ? { baseURL: env.openAiBaseUrl } : {}),
});

/**
 * Generate embedding vector for text
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} Embedding vector
 */
export async function generateEmbedding(text) {
    const input = String(text || '').trim();
    if (!input) return [];

    try {
        const response = await client.embeddings.create({
            model: env.openAiModelEmbedding,
            input,
        });

        const vector = response?.data?.[0]?.embedding;
        return Array.isArray(vector) ? vector : [];
    } catch (error) {
        throw new Error(`Embedding generation failed: ${error.message}`);
    }
}

export default {
    generateEmbedding,
};
