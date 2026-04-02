/**
 * Extraction Service
 * Orchestrates content extraction from URLs, PDFs, and YouTube
 * Returns: { content, metadata, cleanedText }
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { createRequire } from 'module';
import { logEvent } from '../config/logger.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Extract content from URL via HTTP + cheerio
 */
async function extractFromUrl(url) {
    try {
        const response = await axios.get(url, {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        const $ = cheerio.load(response.data);

        // Remove script and style tags
        $('script, style').remove();

        // Extract main content
        const title = $('title').text() || $('meta[property="og:title"]').attr('content') || '';
        const description =
            $('meta[name="description"]').attr('content') ||
            $('meta[property="og:description"]').attr('content') ||
            '';

        // Extract main article/body content
        const content =
            $('article').text() ||
            $('main').text() ||
            $('[role="main"]').text() ||
            $('body').text() ||
            '';

        const cleanedText = content
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .join('\n')
            .substring(0, 50000);

        // Metadata
        const imageUrl = $('meta[property="og:image"]').attr('content') || '';
        const author =
            $('meta[name="author"]').attr('content') ||
            $('[rel="author"]').text() ||
            '';
        const publishedDate =
            $('meta[property="article:published_time"]').attr('content') ||
            $('time').attr('datetime') ||
            null;

        return {
            content: cleanedText,
            metadata: {
                title: title.substring(0, 500),
                description: description.substring(0, 500),
                author: author.substring(0, 200),
                imageUrl: imageUrl.substring(0, 500),
                publishedDate: publishedDate ? new Date(publishedDate) : null,
                wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
                domain: new URL(url).hostname,
            },
            cleanedText,
        };
    } catch (error) {
        logEvent('error', 'extraction_url_failed', { url, error: error.message });
        throw new Error(`URL extraction failed: ${error.message}`);
    }
}

/**
 * Extract text from PDF buffer
 */
async function extractFromPdf(buffer) {
    try {
        const data = await pdfParse(buffer);

        const cleanedText = data.text
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .join('\n')
            .substring(0, 50000);

        return {
            content: cleanedText,
            metadata: {
                pageCount: data.numpages || 0,
                wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
                title: '',
                author: data.info?.Author || '',
            },
            cleanedText,
        };
    } catch (error) {
        logEvent('error', 'extraction_pdf_failed', { error: error.message });
        throw new Error(`PDF extraction failed: ${error.message}`);
    }
}

/**
 * Extract metadata from YouTube URL
 * (Note: Full video transcript extraction requires separate API key)
 */
async function extractFromYoutube(url) {
    try {
        // Extract video ID
        const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (!videoIdMatch) {
            throw new Error('Invalid YouTube URL');
        }

        const videoId = videoIdMatch[1];

        // For now, return basic metadata
        // Full transcript requires: ytdl-core or yt-dlp with subtitle parsing
        const metadata = {
            videoId,
            url,
            title: '',
            description: '',
            duration: 0,
            channel: '',
        };

        // Attempt to fetch page and extract metadata via Open Graph tags
        try {
            const response = await axios.get(url, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });

            const $ = cheerio.load(response.data);
            metadata.title = $('meta[property="og:title"]').attr('content') || 'YouTube Video';
            metadata.description = $('meta[property="og:description"]').attr('content') || '';
        } catch {
            // Graceful degradation: use default metadata
        }

        return {
            content: `Video: ${metadata.title}\n${metadata.description}`,
            metadata,
            cleanedText: `Video: ${metadata.title}\n${metadata.description}`.substring(0, 50000),
        };
    } catch (error) {
        logEvent('error', 'extraction_youtube_failed', { url, error: error.message });
        throw new Error(`YouTube extraction failed: ${error.message}`);
    }
}

/**
 * Main orchestrator: route by type
 */
export async function extractContent(item, buffer = null) {
    const { type, url, content } = item;

    if (type === 'url' && url) {
        return extractFromUrl(url);
    }

    if (type === 'pdf' && buffer) {
        return extractFromPdf(buffer);
    }

    if (type === 'tweet' || url?.includes('twitter.com') || url?.includes('x.com')) {
        // For tweets, use the pre-provided content or fetch
        return {
            content: content || 'Tweet content',
            metadata: { source: 'twitter' },
            cleanedText: content || 'Tweet content',
        };
    }

    if (type === 'text' || content) {
        // Text already provided
        const cleanedText = String(content || '')
            .substring(0, 50000)
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .join('\n');

        return {
            content: cleanedText,
            metadata: { source: 'text' },
            cleanedText,
        };
    }

    if (url?.includes('youtube.com') || url?.includes('youtu.be')) {
        return extractFromYoutube(url);
    }

    // Fallback for undefined type
    return {
        content: content || '',
        metadata: {},
        cleanedText: String(content || '').substring(0, 50000),
    };
}

export default {
    extractContent,
    extractFromUrl,
    extractFromPdf,
    extractFromYoutube,
};
