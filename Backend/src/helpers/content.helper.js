import axios from 'axios';
import * as cheerio from 'cheerio';
import * as pdfParseModule from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import { sha256 } from '../common/utils/hash.util.js';

const pdfParse =
    (typeof pdfParseModule === 'function' && pdfParseModule) ||
    pdfParseModule.default ||
    pdfParseModule.pdfParse;

const DEFAULT_FETCH_TIMEOUT_MS = Number(process.env.CONTENT_FETCH_TIMEOUT_MS || 7000);
const MAX_RETRIES = 2;

function getBlockedDomains() {
    const raw = process.env.CONTENT_BLOCKED_DOMAINS || '';
    return raw
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
}

function isBlockedDomain(hostname) {
    const blocked = getBlockedDomains();
    return blocked.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

/**
 * Extract domain from URL
 * @param {string} url - URL string
 * @returns {string} Domain
 */
export function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname || '';
    } catch {
        return '';
    }
}

async function fetchWithRetry(url) {
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            const response = await axios.get(url, {
                timeout: DEFAULT_FETCH_TIMEOUT_MS,
                maxRedirects: 5,
                responseType: 'text',
                headers: {
                    'User-Agent': 'LinkoraBot/2.0 (+knowledge-platform)',
                },
            });

            return response.data;
        } catch (error) {
            lastError = error;

            const isTimeout = error.code === 'ECONNABORTED';
            const isRetryableStatus = error.response && [408, 425, 429, 500, 502, 503, 504].includes(error.response.status);
            const shouldRetry = attempt < MAX_RETRIES && (isTimeout || isRetryableStatus || !error.response);

            if (!shouldRetry) {
                throw lastError;
            }
        }
    }

    throw lastError;
}

/**
 * Extract metadata from URL
 * @param {string} url - URL string
 * @returns {Promise<Object>} Metadata
 */
export async function extractMetadataFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;

        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            throw new Error('Invalid URL protocol. Only HTTP/HTTPS are supported');
        }

        if (isBlockedDomain(domain)) {
            throw new Error('Domain is blocked');
        }

        const html = await fetchWithRetry(url);
        const $ = cheerio.load(html);

        const title =
            $('meta[property="og:title"]').attr('content') ||
            $('meta[name="twitter:title"]').attr('content') ||
            $('title').first().text() ||
            domain;

        const description =
            $('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') ||
            $('meta[name="twitter:description"]').attr('content') ||
            '';

        const author =
            $('meta[name="author"]').attr('content') ||
            $('meta[property="article:author"]').attr('content') ||
            '';

        const imageUrl =
            $('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            '';

        const publishedRaw =
            $('meta[property="article:published_time"]').attr('content') ||
            $('meta[name="pubdate"]').attr('content') ||
            $('time').first().attr('datetime') ||
            null;

        const publishedDate = publishedRaw ? new Date(publishedRaw) : null;
        const parsedPublishedDate = publishedDate && !Number.isNaN(publishedDate.getTime()) ? publishedDate : null;

        const contentText = $('body').text();
        const normalizedText = normalizeContent(contentText);
        const wordCount = normalizedText ? normalizedText.split(' ').length : 0;

        return {
            domain,
            url,
            title: title.trim(),
            description: description.trim(),
            author: author.trim(),
            imageUrl: imageUrl.trim(),
            wordCount,
            readingTime: calculateReadingTime(wordCount),
            publishedDate: parsedPublishedDate,
            extractedText: normalizedText,
        };
    } catch {
        return {
            domain: '',
            url,
            title: url,
            description: '',
            author: '',
            imageUrl: '',
            wordCount: 0,
            readingTime: 0,
            publishedDate: null,
            extractedText: '',
        };
    }
}

/**
 * Calculate reading time from word count
 * @param {number} wordCount - Word count
 * @returns {number} Reading time in minutes
 */
export function calculateReadingTime(wordCount) {
    const wordsPerMinute = 200;
    return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Normalize content for storage
 * @param {string} content - Raw content
 * @returns {string} Normalized content
 */
export function normalizeContent(content) {
    if (!content) return '';

    return content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 5000);
}

/**
 * Extract text snippet from full content
 * @param {string} content - Full content
 * @param {number} length - Max length (default: 250)
 * @returns {string} Text snippet
 */
export function extractTextSnippet(content, length = 250) {
    if (!content) return '';

    const text = content.slice(0, length);
    return text.length === length ? text + '...' : text;
}

/**
 * Extract text and metadata from PDF buffer
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<Object>} Extracted content
 */
export async function extractFromPdfBuffer(buffer) {
    const parsed = await pdfParse(buffer);
    const normalized = normalizeContent(parsed.text || '');
    const wordCount = normalized ? normalized.split(' ').length : 0;

    return {
        title: parsed.info?.Title || '',
        author: parsed.info?.Author || '',
        description: '',
        imageUrl: '',
        wordCount,
        readingTime: calculateReadingTime(wordCount),
        publishedDate: null,
        extractedText: normalized,
        snippet: extractTextSnippet(normalized, 200),
    };
}

/**
 * Extract text from image buffer using OCR
 * @param {Buffer} buffer - Image file buffer
 * @returns {Promise<Object>} Extracted content
 */
export async function extractTextFromImageBuffer(buffer) {
    const worker = await createWorker('eng');

    try {
        const {
            data: { text },
        } = await worker.recognize(buffer);

        const normalized = normalizeContent(text || '');
        const wordCount = normalized ? normalized.split(' ').length : 0;

        return {
            title: '',
            author: '',
            description: '',
            imageUrl: '',
            wordCount,
            readingTime: calculateReadingTime(wordCount),
            publishedDate: null,
            extractedText: normalized,
            snippet: extractTextSnippet(normalized, 200),
        };
    } finally {
        await worker.terminate();
    }
}

/**
 * Generate hash for deduplication
 * Useful for detecting duplicate saves
 * @param {string} url - URL or content
 * @returns {string} Hash string
 */
export function generateContentHash(url) {
    return sha256(url);
}

/**
 * Get file extension from URL
 * @param {string} url - URL string
 * @returns {string} File extension
 */
export function getFileExtension(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const ext = pathname.split('.').pop()?.toLowerCase() || '';
        return ext;
    } catch {
        return '';
    }
}

/**
 * Detect content type from URL or file
 * @param {string} url - URL or file (with extension)
 * @returns {string} Content type
 */
export function detectContentType(url) {
    const ext = getFileExtension(url);

    const typeMap = {
        pdf: 'pdf',
        doc: 'text',
        docx: 'text',
        txt: 'text',
        jpg: 'image',
        jpeg: 'image',
        png: 'image',
        gif: 'image',
        webp: 'image',
        mp4: 'video',
        webm: 'video',
    };

    return typeMap[ext] || 'url';
}
