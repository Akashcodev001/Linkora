import { URL } from 'url';

function safeDomain(value) {
    try {
        return new URL(value).hostname || null;
    } catch {
        return null;
    }
}

/**
 * Build normalized content string for summarization/tagging/embedding.
 */
export function buildAiText(item) {
    const title = String(item?.title || '').trim();
    const description = String(item?.description || '').trim();
    const content = String(item?.content || '').trim();

    const parts = [title, description, content].filter(Boolean);
    return parts.join('\n\n').slice(0, 24000);
}

export function deriveMetadata(item) {
    return {
        title: String(item?.title || ''),
        type: String(item?.type || 'text'),
        domain: safeDomain(String(item?.url || '')),
    };
}
