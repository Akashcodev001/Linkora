/**
 * Summary Service
 * Uses mistral-medium-latest for high-quality summarization
 */

import OpenAI from 'openai';
import env from '../config/env.js';

const client = new OpenAI({
    apiKey: env.openAiApiKey,
    ...(env.openAiBaseUrl ? { baseURL: env.openAiBaseUrl } : {}),
});

const MODEL_SUMMARY = 'mistral-medium-latest';

function estimateWordCount(input) {
    const text = String(input || '').trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
}

function getSummaryPlan(input) {
    const words = estimateWordCount(input);

    if (words >= 2200) {
        return {
            maxTokens: 720,
            prompt: 'Create a detailed summary with these sections in plain text: Overview (5-7 lines), Key points (6-10 bullets), Important details, and Actionable takeaways. Keep it concise but comprehensive.',
        };
    }

    if (words >= 900) {
        return {
            maxTokens: 460,
            prompt: 'Create a medium-depth summary in plain text with: Overview (4-5 lines), Key points (4-6 bullets), and Takeaways.',
        };
    }

    return {
        maxTokens: 220,
        prompt: 'Summarize this content in 2-3 lines in plain text.',
    };
}

export function shouldGenerateDetailedSummary(text) {
    const words = estimateWordCount(text);
    return words >= 900;
}

export async function generateSummary(text) {
    const input = String(text || '').trim();
    if (!input) return '';

    try {
        const response = await client.chat.completions.create({
            model: MODEL_SUMMARY,
            messages: [
                {
                    role: 'system',
                    content: 'You create short, crisp summaries for knowledge notes. Return plain text only.',
                },
                {
                    role: 'user',
                    content: `Summarize this content in 2-3 lines in plain text.\n\nContent:\n${input}`,
                },
            ],
            max_tokens: 220,
            temperature: 0.2,
            top_p: 0.9,
        });

        return String(response?.choices?.[0]?.message?.content || '').trim();
    } catch (error) {
        throw new Error(`Summary generation failed: ${error.message}`);
    }
}

export async function generateDetailedSummary(text) {
    const input = String(text || '').trim();
    if (!input) return '';

    const plan = getSummaryPlan(input);

    try {
        const response = await client.chat.completions.create({
            model: MODEL_SUMMARY,
            messages: [
                {
                    role: 'system',
                    content: 'You create detailed, structured summaries for long-form knowledge content. Return plain text only.',
                },
                {
                    role: 'user',
                    content: `${plan.prompt}\n\nContent:\n${input}`,
                },
            ],
            max_tokens: plan.maxTokens,
            temperature: 0.2,
            top_p: 0.9,
        });

        return String(response?.choices?.[0]?.message?.content || '').trim();
    } catch (error) {
        throw new Error(`Detailed summary generation failed: ${error.message}`);
    }
}

export default {
    generateSummary,
    generateDetailedSummary,
    shouldGenerateDetailedSummary,
};
