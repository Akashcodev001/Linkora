/**
 * Search helper - Text search with scoring
 */

import Item from '../../models/item.model.js';

/**
 * Perform text search with scoring
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Search results with scores
 */
export async function textSearch(userId, query, options = {}) {
    const { skip = 0, limit = 20 } = options;

    const results = await Item.find(
        {
            $text: { $search: query },
            userId,
            isDeleted: false,
        },
        {
            score: { $meta: 'textScore' },
        }
    )
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit)
        .lean();

    return results;
}

/**
 * Get search suggestions based on partial query
 * @param {string} userId - User ID
 * @param {string} partial - Partial query
 * @returns {Promise<Array>} Title and description suggestions
 */
export async function getSearchSuggestions(userId, partial) {
    const regex = new RegExp(partial, 'i');

    const suggestions = await Item.find(
        {
            userId,
            isDeleted: false,
            $or: [{ title: regex }, { description: regex }],
        },
        {
            title: 1,
            description: 1,
            _id: 0,
        }
    )
        .limit(5)
        .lean();

    return suggestions;
}
