import * as itemRepository from './item.repository.js';
import userModel from '../../models/user.model.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import * as tagRepository from '../tag/tag.repository.js';
import * as collectionRepository from '../collection/collection.repository.js';
import env from '../../config/env.js';
import { createDedupHash, sha256 } from '../../common/utils/hash.util.js';
import {
    detectContentType,
    normalizeContent,
} from '../../helpers/content.helper.js';
import { enqueueAiPipelineJobs, enqueueQueryEmbeddingJob, getCachedQueryEmbedding } from '../../queues/processing.queue.js';
import { querySimilarItems, fetchItemVector, deleteItemVector } from '../../services/qdrant.service.js';
import { uploadBuffer } from '../../services/storage.service.js';

async function resolveTagIds(userId, inputTags) {
    if (!inputTags) return [];

    const rawTags = Array.isArray(inputTags)
        ? inputTags
        : String(inputTags)
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);

    if (rawTags.length === 0) return [];

    const objectIdTags = rawTags.filter((tag) => mongoose.Types.ObjectId.isValid(tag));
    const nameTags = rawTags.filter((tag) => !mongoose.Types.ObjectId.isValid(tag));

    const idsFromNames = [];
    for (const name of nameTags) {
        const tagDoc = await tagRepository.getOrCreateTag(userId, name);
        idsFromNames.push(String(tagDoc._id));
    }

    return [...new Set([...objectIdTags.map(String), ...idsFromNames])];
}

function normalizeTagIdsFromItem(item) {
    return (item.tags || []).map((tag) => String(tag?._id || tag));
}

function mapMimeTypeToItemType(mimeType) {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('image/')) return 'image';
    return 'text';
}

function getUploadTitle(file, explicitTitle) {
    if (explicitTitle && String(explicitTitle).trim()) {
        return String(explicitTitle).trim();
    }

    const original = file?.originalname || 'Uploaded file';
    const withoutExtension = original.includes('.')
        ? original.slice(0, original.lastIndexOf('.'))
        : original;

    return withoutExtension.trim() || 'Uploaded file';
}

function parseDataUrl(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;

    const mimeType = String(match[1] || '').toLowerCase();
    const base64Payload = match[2] || '';
    if (!mimeType.startsWith('image/')) return null;

    try {
        const buffer = Buffer.from(base64Payload, 'base64');
        if (!buffer || buffer.length === 0) return null;
        return { mimeType, buffer };
    } catch {
        return null;
    }
}

function safeDomainFromUrl(url) {
    if (!url) return null;
    try {
        return new URL(String(url)).hostname;
    } catch {
        return null;
    }
}

function isSameUtcDay(a, b) {
    if (!a || !b) return false;
    const d1 = new Date(a);
    const d2 = new Date(b);
    return d1.getUTCFullYear() === d2.getUTCFullYear()
        && d1.getUTCMonth() === d2.getUTCMonth()
        && d1.getUTCDate() === d2.getUTCDate();
}

async function consumeDailyAiQuota(user) {
    const limit = Number(user?.usageQuota?.aiJobsPerDay ?? 50);
    const usage = user?.usageQuota?.currentUsage || {};
    const lastReset = usage.lastReset || null;

    if (!isSameUtcDay(lastReset, new Date())) {
        await userModel.findByIdAndUpdate(user._id, {
            $set: {
                'usageQuota.currentUsage.aiJobsToday': 0,
                'usageQuota.currentUsage.lastReset': new Date(),
            },
        });
    }

    const updated = await userModel.findOneAndUpdate(
        {
            _id: user._id,
            'usageQuota.currentUsage.aiJobsToday': { $lt: limit },
        },
        {
            $inc: { 'usageQuota.currentUsage.aiJobsToday': 1 },
            $set: { 'usageQuota.currentUsage.lastReset': new Date() },
        },
        { returnDocument: 'after' }
    );

    return Boolean(updated);
}

async function scheduleAiPipelineOrFallback(item, user) {
    try {
        const queuedJobs = await enqueueAiPipelineJobs(String(item._id), String(user._id));
        if (!Array.isArray(queuedJobs) || queuedJobs.length === 0) {
            await itemRepository.updateItemProcessing(item._id, user._id, {
                status: 'processed_without_ai',
                processingError: 'ai_pipeline_no_workers',
            });
            return 'processed_without_ai';
        }

        console.info(JSON.stringify({
            event: 'ai_pipeline_enqueued',
            itemId: String(item._id),
            userId: String(user._id),
            jobs: queuedJobs.map((job) => ({ type: job.type, jobId: job.jobId })),
        }));
        return 'pending';
    } catch {
        await itemRepository.updateItemProcessing(item._id, user._id, {
            status: 'processed_without_ai',
            processingError: 'ai_pipeline_unavailable',
        });
        return 'processed_without_ai';
    }
}

async function reserveDailyAiQuotaOrThrow(user) {
    const limit = Number(user?.usageQuota?.aiJobsPerDay ?? 50);
    const canRunAi = await consumeDailyAiQuota(user);

    if (!canRunAi) {
        const error = new Error('AI quota exceeded for today');
        error.statusCode = 429;
        error.code = 'AI_QUOTA_EXCEEDED';
        error.limit = limit;
        throw error;
    }

    return limit;
}

/**
 * Create item with quota check
 * @param {string} userId - User ID
 * @param {Object} itemData - Item data
 * @returns {Promise<Object>} Created item
 */
export async function createItemService(userId, itemData) {
    const user = await userModel.findById(userId);

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    // Check quota
    if (user.usageQuota.currentUsage.items >= user.usageQuota.maxItems) {
        const error = new Error(`Item quota exceeded. Max: ${user.usageQuota.maxItems}`);
        error.statusCode = 429;
        throw error;
    }

    const { dedupContentSeed, ...persistableItemData } = itemData;

    const resolvedTagIds = await resolveTagIds(userId, persistableItemData.tags);

    if (persistableItemData.collectionId) {
        const collection = await collectionRepository.findCollectionByIdLight(persistableItemData.collectionId, userId);
        if (!collection) {
            const error = new Error('Collection not found');
            error.statusCode = 404;
            throw error;
        }
    }

    const contentType = persistableItemData.type || detectContentType(persistableItemData.url || persistableItemData.title || 'text');
    const seedContent = normalizeContent(dedupContentSeed || persistableItemData.content || persistableItemData.url || persistableItemData.title || '');
    const dedupHash = seedContent ? createDedupHash(userId, seedContent) : null;

    if (dedupHash) {
        const existing = await itemRepository.findItemByDedupHash(userId, dedupHash);
        if (existing) {
            const error = new Error('Duplicate content already saved');
            error.statusCode = 409;
            throw error;
        }
    }

    await reserveDailyAiQuotaOrThrow(user);

    const item = await itemRepository.createItem({
        userId,
        ...persistableItemData,
        type: contentType,
        dedupHash,
        tags: resolvedTagIds,
        status: 'pending',
    });

    if (!item?._id) {
        const error = new Error('item_persist_failed');
        error.statusCode = 500;
        throw error;
    }

    console.info(JSON.stringify({
        event: 'item_saved_before_enqueue',
        itemId: String(item._id),
        userId: String(user._id),
        status: item.status,
    }));

    if (item.collectionId) {
        await collectionRepository.addItemToCollection(item.collectionId, item._id);
    }

    if (resolvedTagIds.length > 0) {
        await Promise.all(resolvedTagIds.map((tagId) => tagRepository.incrementTagCount(tagId)));
    }

    // Increment usage
    await userModel.findByIdAndUpdate(userId, {
        $inc: { 'usageQuota.currentUsage.items': 1 },
    });

    const resultingStatus = await scheduleAiPipelineOrFallback(item, user);

    if (resultingStatus === 'processed_without_ai') {
        const reloaded = await itemRepository.findItemById(item._id, userId);
        return reloaded || item;
    }

    const created = await itemRepository.findItemById(item._id, userId);
    return created || item;
}

export async function createItemFromUploadService(userId, file, payload = {}) {
    if (!file || !Buffer.isBuffer(file.buffer)) {
        const error = new Error('Invalid upload payload');
        error.statusCode = 400;
        throw error;
    }

    const itemType = mapMimeTypeToItemType(file.mimetype || 'text/plain');
    const isBinary = itemType === 'pdf' || itemType === 'image';
    const textContent = isBinary ? null : file.buffer.toString('utf-8');

    const uploaded = await uploadBuffer(file.buffer, {
        publicId: `user_${userId}/${Date.now()}_${(file.originalname || 'item').replace(/[^a-zA-Z0-9._-]/g, '_')}`,
    });

    const tags = payload.tags;
    const collectionId = payload.collectionId && String(payload.collectionId).trim() ? payload.collectionId : null;
    const title = getUploadTitle(file, payload.title);
    const description = payload.description ? String(payload.description).trim() : null;

    const dedupSeed = isBinary
        ? `upload:${file.mimetype}:${sha256(file.buffer.toString('base64'))}`
        : normalizeContent(textContent || '');

    return createItemService(userId, {
        type: itemType,
        title,
        description,
        content: textContent,
        url: uploaded?.url || null,
        tags,
        collectionId,
        metadata: {
            source: file.originalname,
            mimeType: file.mimetype,
            fileSize: uploaded?.bytes || file.size,
            originalFilename: file.originalname,
            cloudinaryPublicId: uploaded?.publicId || null,
        },
        dedupContentSeed: dedupSeed,
    });
}

export async function createItemFromExtensionService(userId, payload = {}) {
    const metadata = payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
    const extensionSource = String(metadata.source || 'extension_capture').trim() || 'extension_capture';
    const inferredType = payload.type || (payload.url ? 'url' : 'text');

    let screenshotUpload = null;
    let screenshotBytes = null;
    const parsedScreenshot = parseDataUrl(metadata.screenshotDataUrl);

    if (parsedScreenshot) {
        screenshotBytes = parsedScreenshot.buffer.length;
        screenshotUpload = await uploadBuffer(parsedScreenshot.buffer, {
            resourceType: 'image',
            publicId: `user_${userId}/extension_${Date.now()}`,
        });
    }

    const baseTitle = String(payload.title || payload.url || metadata.tabTitle || 'Quick Capture').trim();
    const content = payload.content || metadata.selectedText || null;
    const normalizedType = parsedScreenshot ? 'image' : inferredType;

    return createItemService(userId, {
        type: normalizedType,
        title: baseTitle,
        description: payload.description || null,
        content,
        url: payload.url || metadata.tabUrl || screenshotUpload?.url || null,
        tags: payload.tags,
        collectionId: payload.collectionId || null,
        metadata: {
            ...metadata,
            source: extensionSource,
            domain: metadata.domain || safeDomainFromUrl(payload.url || metadata.tabUrl),
            imageUrl: screenshotUpload?.url || null,
            mimeType: parsedScreenshot?.mimeType || metadata.mimeType,
            fileSize: screenshotUpload?.bytes || screenshotBytes || metadata.fileSize,
            cloudinaryPublicId: screenshotUpload?.publicId || metadata.cloudinaryPublicId || null,
            capturedAt: metadata.capturedAt || new Date().toISOString(),
        },
        dedupContentSeed: payload.url || content || baseTitle,
    });
}

export async function createItemsFromExtensionBulkService(userId, items = []) {
    const results = [];
    const failures = [];

    for (let i = 0; i < items.length; i += 1) {
        const itemPayload = items[i];
        try {
            const created = await createItemFromExtensionService(userId, itemPayload);
            results.push(created);
        } catch (error) {
            failures.push({
                index: i,
                title: itemPayload?.title || null,
                message: error.message || 'Failed to create extension item',
                statusCode: error.statusCode || 500,
                code: error.code || null,
            });
        }
    }

    return {
        created: results,
        failed: failures,
        total: items.length,
        succeeded: results.length,
    };
}

/**
 * Get user items with pagination
 * @param {string} userId - User ID
 * @param {Object} options - Pagination, filter options
 * @returns {Promise<Object>} Paginated items with metadata
 */
export async function getUserItemsService(userId, options = {}) {
    const { page = 1, limit = 10, status, type, tags, collectionId } = options;
    const skip = (page - 1) * limit;

    const filters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (tags) {
        const tagIds = await resolveTagIds(userId, tags);
        filters.tags = tagIds.length > 0 ? { $in: tagIds } : { $in: [] };
    }
    if (collectionId) filters.collectionId = collectionId;

    const [items, total] = await Promise.all([
        itemRepository.findItemsByUser(userId, skip, limit, filters),
        itemRepository.countItemsByUser(userId, filters),
    ]);

    return {
        items,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}

/**
 * Get single item
 * @param {string} itemId - Item ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Item document
 */
export async function getItemService(itemId, userId) {
    const item = await itemRepository.findItemById(itemId, userId);

    if (!item) {
        const error = new Error('Item not found');
        error.statusCode = 404;
        throw error;
    }

    return item;
}

/**
 * Update item
 * @param {string} itemId - Item ID
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated item
 */
export async function updateItemService(itemId, userId, updateData) {
    const item = await itemRepository.findItemById(itemId, userId);

    if (!item) {
        const error = new Error('Item not found');
        error.statusCode = 404;
        throw error;
    }

    const currentTagIds = normalizeTagIdsFromItem(item);

    if (updateData.tags !== undefined) {
        const nextTagIds = await resolveTagIds(userId, updateData.tags);

        const removedTagIds = currentTagIds.filter((id) => !nextTagIds.includes(id));
        const addedTagIds = nextTagIds.filter((id) => !currentTagIds.includes(id));

        if (removedTagIds.length > 0) {
            await Promise.all(removedTagIds.map((tagId) => tagRepository.decrementTagCount(tagId)));
        }

        if (addedTagIds.length > 0) {
            await Promise.all(addedTagIds.map((tagId) => tagRepository.incrementTagCount(tagId)));
        }

        updateData.tags = nextTagIds;
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'collectionId')) {
        const previousCollectionId = item.collectionId ? String(item.collectionId._id || item.collectionId) : null;
        const nextCollectionId = updateData.collectionId ? String(updateData.collectionId) : null;

        if (nextCollectionId) {
            const collection = await collectionRepository.findCollectionByIdLight(nextCollectionId, userId);
            if (!collection) {
                const error = new Error('Collection not found');
                error.statusCode = 404;
                throw error;
            }
        }

        if (previousCollectionId && previousCollectionId !== nextCollectionId) {
            await collectionRepository.removeItemFromCollection(previousCollectionId, itemId);
        }

        if (nextCollectionId && previousCollectionId !== nextCollectionId) {
            await collectionRepository.addItemToCollection(nextCollectionId, itemId);
        }
    }

    const updated = await itemRepository.updateItem(itemId, userId, updateData);
    return updated;
}

/**
 * Delete item (soft delete)
 * @param {string} itemId - Item ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Deleted item
 */
export async function deleteItemService(itemId, userId) {
    const item = await itemRepository.findItemById(itemId, userId);

    if (!item) {
        const error = new Error('Item not found');
        error.statusCode = 404;
        throw error;
    }

    const tagIds = normalizeTagIdsFromItem(item);

    if (tagIds.length > 0) {
        await Promise.all(tagIds.map((tagId) => tagRepository.decrementTagCount(tagId)));
    }

    if (item.collectionId) {
        await collectionRepository.removeItemFromCollection(String(item.collectionId._id || item.collectionId), itemId);
    }

    await itemRepository.softDeleteItem(itemId, userId);
    try {
        await deleteItemVector(userId, itemId);
    } catch {
        // Keep delete flow resilient when vector store is temporarily unavailable.
    }

    // Decrement usage
    await userModel.findByIdAndUpdate(userId, {
        $inc: { 'usageQuota.currentUsage.items': -1 },
    });

    return { message: 'Item deleted successfully' };
}

/**
 * Search items
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Search results
 */
export async function searchItemsService(userId, query, options = {}) {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const textResults = await itemRepository.searchItems(userId, query, skip, limit);
    const queryVector = await getCachedQueryEmbedding(query);

    let semanticMatches = [];
    if (Array.isArray(queryVector) && queryVector.length > 0) {
        semanticMatches = await querySimilarItems({
            userId,
            vector: queryVector,
            topK: limit,
        });
    } else {
        // Queue-only hot path: request returns immediately while semantic vector is generated async.
        await enqueueQueryEmbeddingJob(query, userId);
    }

    const semanticIds = semanticMatches.map((entry) => entry.itemId);
    const semanticDocs = await itemRepository.findItemsByIds(userId, semanticIds);
    const semanticScoreMap = new Map(semanticMatches.map((entry) => [String(entry.itemId), entry.semanticScore]));

    const mergedMap = new Map();

    textResults.forEach((item, index) => {
        mergedMap.set(String(item._id), {
            ...item,
            textScore: 1 - index / Math.max(1, textResults.length),
            semanticScore: 0,
        });
    });

    semanticDocs.forEach((item) => {
        const key = String(item._id);
        const existing = mergedMap.get(key);
        const semanticScore = Number(semanticScoreMap.get(key) || 0);
        if (existing) {
            mergedMap.set(key, {
                ...existing,
                semanticScore,
            });
        } else {
            mergedMap.set(key, {
                ...item,
                textScore: 0,
                semanticScore,
            });
        }
    });

    const results = [...mergedMap.values()]
        .map((item) => ({
            ...item,
            hybridScore: Number((0.55 * (item.textScore || 0) + 0.45 * (item.semanticScore || 0)).toFixed(6)),
        }))
        .sort((a, b) => b.hybridScore - a.hybridScore)
        .slice(0, limit);

    return {
        results,
        query,
        count: results.length,
    };
}

/**
 * Get related items
 * @param {string} itemId - Item ID
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Related items
 */
export async function getRelatedItemsService(itemId, userId, limit = 5) {
    const item = await itemRepository.findItemById(itemId, userId);

    if (!item) {
        const error = new Error('Item not found');
        error.statusCode = 404;
        throw error;
    }

    try {
        const vector = await fetchItemVector(userId, itemId);
        if (Array.isArray(vector) && vector.length > 0) {
            const similar = await querySimilarItems({
                userId,
                vector,
                topK: limit,
                excludeItemId: itemId,
            });

            if (similar.length > 0) {
                const orderedIds = similar.map((entry) => entry.itemId);
                const docs = await itemRepository.findItemsByIds(userId, orderedIds);
                const scoreMap = new Map(similar.map((entry) => [String(entry.itemId), entry.semanticScore]));

                return docs.map((doc) => ({
                    ...doc,
                    semanticScore: Number(scoreMap.get(String(doc._id)) || 0),
                }));
            }
        }
    } catch {
        // Fallback to repository strategy when vector retrieval is unavailable.
    }

    return itemRepository.getRelatedItems(itemId, userId, limit);
}

export async function getSearchSuggestionsService(userId, query) {
    return itemRepository.getSearchSuggestions(userId, query, 5);
}

export async function getResurfacingService(userId, days = [7, 30, 60]) {
    const parsedDays = Array.isArray(days)
        ? days
        : String(days || '')
            .split(',')
            .map((n) => Number(n.trim()))
            .filter((n) => Number.isFinite(n) && n > 0);

    const thresholdDays = parsedDays.length > 0 ? Math.max(...parsedDays) : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - thresholdDays);
    cutoff.setHours(23, 59, 59, 999);

    const candidates = await itemRepository.findItemsForResurfacing(userId, cutoff, 100);
    const nowMs = Date.now();

    const scored = candidates
        .map((item) => {
            const referenceMs = new Date(item.updatedAt || item.createdAt || nowMs).getTime();
            const ageDays = Math.max(1, Math.floor((nowMs - referenceMs) / (24 * 60 * 60 * 1000)));

            return {
                ...item,
                resurfacingScore: Number((ageDays * 0.1 + ((item.tags?.length || 0) * 0.05)).toFixed(6)),
                resurfacedFromDaysAgo: ageDays,
            };
        })
        .sort((a, b) => b.resurfacingScore - a.resurfacingScore)
        .slice(0, 20);

    return { items: scored, sourceDays: [thresholdDays] };
}

export async function createItemShareLinkService(itemId, userId) {
    const item = await itemRepository.findItemById(itemId, userId);

    if (!item) {
        const error = new Error('Item not found');
        error.statusCode = 404;
        throw error;
    }

    const token = jwt.sign(
        {
            type: 'item_share',
            itemId: String(item._id),
            ownerId: String(userId),
        },
        env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    return {
        token,
        shareUrl: `${env.FRONTEND_URL}/shared/${encodeURIComponent(token)}`,
        apiShareUrl: `${env.BACKEND_URL}/api/shared/items/${encodeURIComponent(token)}`,
        expiresIn: '7d',
        itemId: String(item._id),
    };
}

export async function getSharedItemByTokenService(token) {
    let payload;

    try {
        payload = jwt.verify(String(token || ''), env.JWT_SECRET);
    } catch (error) {
        const authError = new Error(error?.name === 'TokenExpiredError' ? 'Share link expired' : 'Invalid share link');
        authError.statusCode = error?.name === 'TokenExpiredError' ? 410 : 400;
        throw authError;
    }

    if (payload?.type !== 'item_share' || !payload?.itemId || !payload?.ownerId) {
        const error = new Error('Invalid share link payload');
        error.statusCode = 400;
        throw error;
    }

    const item = await itemRepository.findItemById(payload.itemId, payload.ownerId);

    if (!item) {
        const error = new Error('Shared item not found');
        error.statusCode = 404;
        throw error;
    }

    return {
        id: String(item._id),
        title: item.title,
        type: item.type,
        summary: item.summary || null,
        detailedSummary: item.detailedSummary || null,
        description: item.description || null,
        url: item.url || null,
        content: item.content || null,
        metadata: item.metadata || {},
        tags: item.tags || [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
    };
}

export async function processItemContentService(itemId, userId) {
    await itemRepository.updateItemProcessing(itemId, userId, {
        status: 'processed_without_ai',
        processingError: 'legacy_worker_disabled',
    });
    return true;
}

/**
 * Reprocess item - reset AI status and re-queue for pipeline
 * @param {string} itemId - Item ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated item
 */
export async function reprocessItemService(itemId, userId) {
    const item = await itemRepository.findItemByIdRaw(itemId, userId);

    if (!item) {
        const error = new Error('Item not found');
        error.statusCode = 404;
        throw error;
    }

    // Reset AI status fields
    item.status = 'pending';
    item.aiStatus = 'pending';
    item.metadata = item.metadata || {};
    item.processingError = null;
    await item.save();

    // Re-enqueue for AI pipeline
    try {
        const queuedJobs = await enqueueAiPipelineJobs(String(item._id), String(userId));
        if (!Array.isArray(queuedJobs) || queuedJobs.length === 0) {
            item.status = 'processed_without_ai';
            item.aiStatus = 'processed_without_ai';
            item.processingError = 'ai_pipeline_no_workers';
            await item.save();
            return item;
        }

        console.info(JSON.stringify({
            event: 'item_reprocessing_enqueued',
            itemId: String(item._id),
            userId: String(userId),
            jobs: queuedJobs.map((job) => ({ type: job.type, jobId: job.jobId })),
        }));
    } catch (error) {
        console.error(JSON.stringify({
            event: 'requeue_failed',
            itemId: String(item._id),
            userId: String(userId),
            error: error.message,
            stack: error.stack,
            code: error.code,
        }));
        throw new Error(`Failed to requeue item: ${error.message}`);
    }

    return item;
}
