import * as itemService from './item.service.js';
import { sendSuccess, sendError } from '../../common/helpers/response.js';

/**
 * Create item
 * @route POST /api/items
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function createItem(req, res) {
    try {
        const userId = req.user.id;
        const { type, title, description, content, url, metadata, tags, collectionId } = req.body;

        // Validation
        if (!type || !title) {
            return sendError(res, 'Type and title are required', 400);
        }

        const item = await itemService.createItemService(userId, {
            type,
            title,
            description,
            content,
            url,
            metadata,
            tags,
            collectionId,
            status: 'pending',
        });

        return sendSuccess(res, item, 'Item created successfully. Processing started asynchronously.', 201);
    } catch (error) {
        if (error?.code === 'AI_QUOTA_EXCEEDED') {
            return res.status(429).json({
                code: 'AI_QUOTA_EXCEEDED',
                limit: Number(error.limit ?? 50),
            });
        }
        return sendError(res, error.message || 'Error creating item', error.statusCode || 500);
    }
}

/**
 * Create item from uploaded file
 * @route POST /api/items/upload
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function createItemFromUpload(req, res) {
    try {
        const userId = req.user.id;

        if (!req.file) {
            return sendError(res, 'File is required', 400);
        }

        const { title, description, tags, collectionId } = req.body;

        const item = await itemService.createItemFromUploadService(userId, req.file, {
            title,
            description,
            tags,
            collectionId,
        });

        return sendSuccess(res, item, 'File uploaded successfully. Processing started asynchronously.', 201);
    } catch (error) {
        if (error?.code === 'AI_QUOTA_EXCEEDED') {
            return res.status(429).json({
                code: 'AI_QUOTA_EXCEEDED',
                limit: Number(error.limit ?? 50),
            });
        }
        return sendError(res, error.message || 'Error uploading item', error.statusCode || 500);
    }
}

/**
 * Get user items
 * @route GET /api/items
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function getItems(req, res) {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, status, type, tags, collectionId } = req.query;

        const result = await itemService.getUserItemsService(userId, {
            page: parseInt(page),
            limit: parseInt(limit),
            status,
            type,
            tags,
            collectionId,
        });

        return sendSuccess(res, result, 'Items fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching items', error.statusCode || 500);
    }
}

/**
 * Get single item
 * @route GET /api/items/:id
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function getItem(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const item = await itemService.getItemService(id, userId);

        return sendSuccess(res, item, 'Item fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching item', error.statusCode || 500);
    }
}

/**
 * Update item
 * @route PATCH /api/items/:id
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function updateItem(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const updateData = req.body;

        const item = await itemService.updateItemService(id, userId, updateData);

        return sendSuccess(res, item, 'Item updated successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error updating item', error.statusCode || 500);
    }
}

/**
 * Delete item
 * @route DELETE /api/items/:id
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function deleteItem(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await itemService.deleteItemService(id, userId);

        return sendSuccess(res, null, 'Item deleted successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error deleting item', error.statusCode || 500);
    }
}

/**
 * Search items
 * @route GET /api/items/search/query
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function searchItems(req, res) {
    try {
        const userId = req.user.id;
        const { q, page = 1, limit = 20 } = req.query;

        if (!q) {
            return sendError(res, 'Search query is required', 400);
        }

        const result = await itemService.searchItemsService(userId, q, {
            page: parseInt(page),
            limit: parseInt(limit),
        });

        return sendSuccess(res, result, 'Search completed successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error searching items', error.statusCode || 500);
    }
}

/**
 * Get related items
 * @route GET /api/items/:id/related
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function getRelatedItems(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { limit = 5 } = req.query;

        const relatedItems = await itemService.getRelatedItemsService(id, userId, parseInt(limit));

        return sendSuccess(res, relatedItems, 'Related items fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching related items', error.statusCode || 500);
    }
}

/**
 * Search suggestions
 * @route GET /api/items/search/suggestions
 */
export async function getSearchSuggestions(req, res) {
    try {
        const userId = req.user.id;
        const { q } = req.query;

        const suggestions = await itemService.getSearchSuggestionsService(userId, q);
        return sendSuccess(res, { suggestions }, 'Suggestions fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching suggestions', error.statusCode || 500);
    }
}

/**
 * Resurfacing endpoint
 * @route GET /api/items/resurface
 */
export async function getResurfacing(req, res) {
    try {
        const userId = req.user.id;
        const days = req.query.days;

        const result = await itemService.getResurfacingService(userId, days);
        return sendSuccess(res, result, 'Resurfacing items fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching resurfacing items', error.statusCode || 500);
    }
}

/**
 * Reprocess item (reset AI status and re-queue)
 * @route POST /api/items/:id/reprocess
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function reprocessItem(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        console.info(JSON.stringify({
            event: 'reprocess_request_start',
            itemId: id,
            userId,
            timestamp: new Date().toISOString(),
        }));

        const result = await itemService.reprocessItemService(id, userId);

        console.info(JSON.stringify({
            event: 'reprocess_request_success',
            itemId: id,
            userId,
            timestamp: new Date().toISOString(),
        }));

        return sendSuccess(res, result, 'Item queued for reprocessing', 200);
    } catch (error) {
        console.error(JSON.stringify({
            event: 'reprocess_request_error',
            itemId: req.params?.id,
            userId: req.user?.id,
            error: error.message,
            stack: error.stack,
            code: error.code,
            statusCode: error.statusCode,
            timestamp: new Date().toISOString(),
        }));
        return sendError(res, error.message || 'Error reprocessing item', error.statusCode || 500);
    }
}

export async function createShareLink(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const result = await itemService.createItemShareLinkService(id, userId);
        return sendSuccess(res, result, 'Share link created successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error creating share link', error.statusCode || 500);
    }
}

export async function getSharedItem(req, res) {
    try {
        const { token } = req.params;
        const item = await itemService.getSharedItemByTokenService(token);
        return sendSuccess(res, item, 'Shared item fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching shared item', error.statusCode || 500);
    }
}

/**
 * Create item from extension payload
 * @route POST /api/items/from-extension
 */
export async function createItemFromExtension(req, res) {
    try {
        const userId = req.user.id;
        const item = await itemService.createItemFromExtensionService(userId, req.body);
        return sendSuccess(res, item, 'Extension item created successfully. Processing started asynchronously.', 201);
    } catch (error) {
        if (error?.code === 'AI_QUOTA_EXCEEDED') {
            return res.status(429).json({
                code: 'AI_QUOTA_EXCEEDED',
                limit: Number(error.limit ?? 50),
            });
        }
        return sendError(res, error.message || 'Error creating extension item', error.statusCode || 500);
    }
}

/**
 * Bulk create items from extension payload
 * @route POST /api/items/bulk-from-extension
 */
export async function createItemsFromExtensionBulk(req, res) {
    try {
        const userId = req.user.id;
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        const result = await itemService.createItemsFromExtensionBulkService(userId, items);
        return sendSuccess(res, result, 'Extension bulk capture completed', 201);
    } catch (error) {
        return sendError(res, error.message || 'Error creating extension items', error.statusCode || 500);
    }
}
