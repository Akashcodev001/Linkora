import * as highlightRepository from './highlight.repository.js';
import * as itemRepository from '../item/item.repository.js';

/**
 * Create highlight
 * @param {string} userId - User ID
 * @param {Object} highlightData - Highlight data
 * @returns {Promise<Object>} Created highlight
 */
export async function createHighlightService(userId, highlightData) {
    // Verify item exists and belongs to user
    const item = await itemRepository.findItemById(highlightData.itemId, userId);

    if (!item) {
        const error = new Error('Item not found');
        error.statusCode = 404;
        throw error;
    }

    return highlightRepository.createHighlight({
        userId,
        itemId: item._id,
        ...highlightData,
    });
}

/**
 * Get highlights for item
 * @param {string} itemId - Item ID
 * @param {string} userId - User ID
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Paginated highlights
 */
export async function getHighlightsByItemService(itemId, userId, options = {}) {
    // Verify item exists and belongs to user
    const item = await itemRepository.findItemById(itemId, userId);

    if (!item) {
        const error = new Error('Item not found');
        error.statusCode = 404;
        throw error;
    }

    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const [highlights, total] = await Promise.all([
        highlightRepository.findHighlightsByItem(itemId, userId, skip, limit),
        highlightRepository.countHighlightsByItem(itemId),
    ]);

    return {
        highlights,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}

/**
 * Get single highlight
 * @param {string} highlightId - Highlight ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Highlight document
 */
export async function getHighlightService(highlightId, userId) {
    const highlight = await highlightRepository.findHighlightById(highlightId, userId);

    if (!highlight) {
        const error = new Error('Highlight not found');
        error.statusCode = 404;
        throw error;
    }

    return highlight;
}

/**
 * Update highlight
 * @param {string} highlightId - Highlight ID
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated highlight
 */
export async function updateHighlightService(highlightId, userId, updateData) {
    const highlight = await highlightRepository.findHighlightById(highlightId, userId);

    if (!highlight) {
        const error = new Error('Highlight not found');
        error.statusCode = 404;
        throw error;
    }

    // Validate color if provided
    const validColors = ['yellow', 'green', 'blue', 'red', 'purple'];
    if (updateData.color && !validColors.includes(updateData.color)) {
        const error = new Error('Invalid color. Must be one of: yellow, green, blue, red, purple');
        error.statusCode = 400;
        throw error;
    }

    return highlightRepository.updateHighlight(highlightId, userId, updateData);
}

/**
 * Delete highlight (soft delete)
 * @param {string} highlightId - Highlight ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Message
 */
export async function deleteHighlightService(highlightId, userId) {
    const highlight = await highlightRepository.findHighlightById(highlightId, userId);

    if (!highlight) {
        const error = new Error('Highlight not found');
        error.statusCode = 404;
        throw error;
    }

    await highlightRepository.softDeleteHighlight(highlightId, userId);
    return { message: 'Highlight deleted successfully' };
}
