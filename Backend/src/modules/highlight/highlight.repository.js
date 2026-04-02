import highlightModel from '../../models/highlight.model.js';

/**
 * Create a new highlight
 * @param {Object} highlightData - Highlight data
 * @returns {Promise<Object>} Created highlight
 */
export async function createHighlight(highlightData) {
    return highlightModel.create(highlightData);
}

/**
 * Find highlights for an item with pagination
 * @param {string} itemId - Item ID
 * @param {string} userId - User ID
 * @param {number} skip - Number of records to skip
 * @param {number} limit - Number of records to return
 * @returns {Promise<Array>} Array of highlights
 */
export async function findHighlightsByItem(itemId, userId, skip = 0, limit = 50) {
    return highlightModel
        .find({ itemId, userId, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
}

/**
 * Find highlight by ID
 * @param {string} highlightId - Highlight ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Highlight document
 */
export async function findHighlightById(highlightId, userId) {
    return highlightModel
        .findOne({ _id: highlightId, userId, isDeleted: false })
        .lean();
}

/**
 * Update highlight
 * @param {string} highlightId - Highlight ID
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated highlight
 */
export async function updateHighlight(highlightId, userId, updateData) {
    return highlightModel.findOneAndUpdate(
        { _id: highlightId, userId, isDeleted: false },
        { $set: updateData },
        { returnDocument: 'after' }
    );
}

/**
 * Soft delete highlight
 * @param {string} highlightId - Highlight ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Deleted highlight
 */
export async function softDeleteHighlight(highlightId, userId) {
    return highlightModel.findOneAndUpdate(
        { _id: highlightId, userId },
        { $set: { isDeleted: true } },
        { returnDocument: 'after' }
    );
}

/**
 * Get total count of highlights for item
 * @param {string} itemId - Item ID
 * @returns {Promise<number>} Count of highlights
 */
export async function countHighlightsByItem(itemId) {
    return highlightModel.countDocuments({ itemId, isDeleted: false });
}

/**
 * Delete all highlights for an item (used when item is deleted)
 * @param {string} itemId - Item ID
 * @returns {Promise} Delete result
 */
export async function softDeleteHighlightsByItem(itemId) {
    return highlightModel.updateMany(
        { itemId },
        { $set: { isDeleted: true } }
    );
}
