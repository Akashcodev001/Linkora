import env from '../config/env.js';

function guessMimeTypeFromUrl(imageUrl) {
    try {
        const pathname = new URL(String(imageUrl || '')).pathname.toLowerCase();
        if (pathname.endsWith('.png')) return 'image/png';
        if (pathname.endsWith('.webp')) return 'image/webp';
        if (pathname.endsWith('.gif')) return 'image/gif';
        if (pathname.endsWith('.avif')) return 'image/avif';
        return 'image/jpeg';
    } catch {
        return 'image/jpeg';
    }
}

function buildImagePrompt(context = {}) {
    const title = String(context.title || '').trim();
    const description = String(context.description || '').trim();
    const content = String(context.content || '').trim();

    return [
        'Describe this image clearly and accurately.',
        'If it is anime or illustrated art, say so explicitly and describe the character appearance, outfit, pose, expression, setting, and visual style.',
        'If you can identify a public figure, object, or subject with confidence, name it; otherwise do not guess.',
        'Also mention the likely role or activity of the subject when it is visible.',
        'Return plain text only in 3 to 6 short sentences.',
        title ? `Title: ${title}` : '',
        description ? `User description: ${description}` : '',
        content ? `Additional context: ${content}` : '',
    ].filter(Boolean).join('\n');
}

async function fetchImageBytes(imageUrl) {
    const response = await fetch(String(imageUrl || '').trim(), {
        method: 'GET',
        redirect: 'follow',
    });

    if (!response.ok) {
        throw new Error(`image_fetch_failed_${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer.length) {
        throw new Error('image_fetch_empty');
    }

    const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim();
    return {
        buffer,
        mimeType: contentType || guessMimeTypeFromUrl(imageUrl),
    };
}

export async function generateImageDescription(imageUrl, context = {}) {
    const sourceUrl = String(imageUrl || '').trim();
    if (!sourceUrl) return '';

    if (!env.geminiApiKey) {
        throw new Error('Missing GEMINI_API_KEY');
    }

    const { buffer, mimeType } = await fetchImageBytes(sourceUrl);

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.geminiImageModel)}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: buildImagePrompt(context) },
                            {
                                inline_data: {
                                    mime_type: mimeType,
                                    data: buffer.toString('base64'),
                                },
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.2,
                    topP: 0.9,
                    maxOutputTokens: 512,
                },
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`image_description_generation_failed_${response.status}${errorText ? `:${errorText.slice(0, 200)}` : ''}`);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts
        ?.map((part) => String(part?.text || '').trim())
        .filter(Boolean)
        .join(' ')
        .trim() || '';

    if (!text) {
        throw new Error('image_description_generation_failed_empty');
    }

    return text;
}

export default {
    generateImageDescription,
};