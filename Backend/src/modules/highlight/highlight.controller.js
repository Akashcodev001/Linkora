import * as highlightService from './highlight.service.js';
import { sendSuccess, sendError } from '../../common/helpers/response.js';

/**
 * Create highlight
 * @route POST /api/highlights
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function createHighlight(req, res) {
    try {
        const userId = req.user.id;
        const { itemId, text, color, note } = req.body;

        if (!itemId || !text) {
            return sendError(res, 'Item ID and highlight text are required', 400);
        }

        const validColors = ['yellow', 'green', 'blue', 'red', 'purple'];
        if (!validColors.includes(color)) {
            return sendError(res, 'Invalid color. Must be one of: yellow, green, blue, red, purple', 400);
        }

        const highlight = await highlightService.createHighlightService(userId, {
            itemId,
            text,
            color,
            note,
        });

        return sendSuccess(res, highlight, 'Highlight created successfully', 201);
    } catch (error) {
        return sendError(res, error.message || 'Error creating highlight', error.statusCode || 500);
    }
}

/**
 * Get highlights for item
 * @route GET /api/highlights/item/:itemId
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function getHighlightsForItem(req, res) {
    try {
        const userId = req.user.id;
        const { itemId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        console.info(JSON.stringify({
            event: 'get_highlights_request_start',
            itemId,
            userId,
            page: parseInt(page),
            limit: parseInt(limit),
            timestamp: new Date().toISOString(),
        }));

        const result = await highlightService.getHighlightsByItemService(
            itemId,
            userId,
            {
                page: parseInt(page),
                limit: parseInt(limit),
            }
        );

        console.info(JSON.stringify({
            event: 'get_highlights_request_success',
            itemId,
            userId,
            highlightCount: result.highlights?.length || 0,
            timestamp: new Date().toISOString(),
        }));

        return sendSuccess(res, result, 'Highlights fetched successfully');
    } catch (error) {
        console.error(JSON.stringify({
            event: 'get_highlights_request_error',
            itemId: req.params?.itemId,
            userId: req.user?.id,
            error: error.message,
            stack: error.stack,
            code: error.code,
            statusCode: error.statusCode,
            timestamp: new Date().toISOString(),
        }));
        return sendError(res, error.message || 'Error fetching highlights', error.statusCode || 500);
    }
}

/**
 * Get single highlight
 * @route GET /api/highlights/:id
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function getHighlight(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const highlight = await highlightService.getHighlightService(id, userId);

        return sendSuccess(res, highlight, 'Highlight fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching highlight', error.statusCode || 500);
    }
}

/**
 * Update highlight
 * @route PATCH /api/highlights/:id
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function updateHighlight(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const updateData = req.body;

        const highlight = await highlightService.updateHighlightService(id, userId, updateData);

        return sendSuccess(res, highlight, 'Highlight updated successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error updating highlight', error.statusCode || 500);
    }
}

/**
 * Delete highlight
 * @route DELETE /api/highlights/:id
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function deleteHighlight(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await highlightService.deleteHighlightService(id, userId);

        return sendSuccess(res, null, 'Highlight deleted successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error deleting highlight', error.statusCode || 500);
    }
}
