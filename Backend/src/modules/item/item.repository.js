import itemModel from '../../models/item.model.js';

/**
 * Create a new item
 * @param {Object} itemData - Item data
 * @returns {Promise<Object>} Created item document
 */
export async function createItem(itemData) {
    return itemModel.create(itemData);
}

export async function findItemByDedupHash(userId, dedupHash) {
    return itemModel.findOne({ userId, dedupHash, isDeleted: false }).lean();
}

/**
 * Find items by user with pagination and filters
 * @param {string} userId - User ID
 * @param {number} skip - Documents to skip
 * @param {number} limit - Documents limit
 * @param {Object} filters - Additional filters (status, tags, collectionId)
 * @returns {Promise<Array>} Array of items
 */
export async function findItemsByUser(userId, skip = 0, limit = 10, filters = {}) {
    const query = { userId, isDeleted: false, ...filters };
    return itemModel
        .find(query)
        .populate('tags', 'name')
        .populate('collectionId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
}

/**
 * Get total count of items for user
 * @param {string} userId - User ID
 * @param {Object} filters - Additional filters
 * @returns {Promise<number>} Count of items
 */
export async function countItemsByUser(userId, filters = {}) {
    const query = { userId, isDeleted: false, ...filters };
    return itemModel.countDocuments(query);
}

/**
 * Find item by ID and user
 * @param {string} itemId - Item ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Item document
 */
export async function findItemById(itemId, userId) {
    return itemModel
        .findOne({ _id: itemId, userId, isDeleted: false })
        .populate('tags', 'name')
        .populate('collectionId')
        .lean();
}

export async function findItemByIdRaw(itemId, userId) {
    return itemModel.findOne({ _id: itemId, userId, isDeleted: false });
}

export async function findItemsByIds(userId, itemIds = []) {
    if (!Array.isArray(itemIds) || itemIds.length === 0) return [];

    const documents = await itemModel
        .find({ userId, isDeleted: false, _id: { $in: itemIds } })
        .populate('tags', 'name')
        .populate('collectionId', 'name')
        .lean();

    const byId = new Map(documents.map((doc) => [String(doc._id), doc]));
    return itemIds
        .map((id) => byId.get(String(id)))
        .filter(Boolean);
}

/**
 * Update item
 * @param {string} itemId - Item ID
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated item
 */
export async function updateItem(itemId, userId, updateData) {
    return itemModel.findOneAndUpdate(
        { _id: itemId, userId, isDeleted: false },
        { $set: updateData },
        { returnDocument: 'after' }
    );
}

/**
 * Soft delete item
 * @param {string} itemId - Item ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Deleted item
 */
export async function softDeleteItem(itemId, userId) {
    return itemModel.findOneAndUpdate(
        { _id: itemId, userId },
        { $set: { isDeleted: true } },
        { returnDocument: 'after' }
    );
}

/**
 * Search items by keyword
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @param {number} skip - Skip documents
 * @param {number} limit - Limit documents
 * @returns {Promise<Array>} Matching items
 */
export async function searchItems(userId, query, skip = 0, limit = 10) {
    return itemModel
        .find(
            { userId, isDeleted: false, $text: { $search: query } },
            { score: { $meta: 'textScore' } }
        )
        .sort({ score: { $meta: 'textScore' } })
        .skip(skip)
        .limit(limit)
        .lean();
}

export async function getSearchSuggestions(userId, query, limit = 5) {
    const regex = new RegExp(query, 'i');
    return itemModel
        .find(
            {
                userId,
                isDeleted: false,
                $or: [{ title: regex }, { description: regex }],
            },
            { title: 1, description: 1 }
        )
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
}

/**
 * Find items by collection
 * @param {string} collectionId - Collection ID
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Items in collection
 */
export async function findItemsByCollection(collectionId, userId, skip = 0, limit = 10) {
    return itemModel
        .find({ collectionId, userId, isDeleted: false })
        .populate('tags', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
}

/**
 * Find items by tag
 * @param {string} tagId - Tag ID
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Items with tag
 */
export async function findItemsByTag(tagId, userId, skip = 0, limit = 10) {
    return itemModel
        .find({ tags: tagId, userId, isDeleted: false })
        .populate('tags', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
}

/**
 * Find items created in specific date range (for resurfacing)
 * @param {string} userId - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Items created in date range
 */
export async function findItemsByDateRange(userId, startDate, endDate) {
    return itemModel
        .find({
            userId,
            isDeleted: false,
            createdAt: { $gte: startDate, $lte: endDate },
        })
        .populate('tags', 'name')
        .sort({ createdAt: -1 })
        .lean();
}

export async function findItemsForResurfacing(userId, beforeDate, limit = 50) {
    return itemModel
        .find({
            userId,
            isDeleted: false,
            createdAt: { $lte: beforeDate },
        })
        .populate('tags', 'name')
        .sort({ updatedAt: 1, createdAt: 1 })
        .limit(limit)
        .lean();
}

/**
 * Update item status
 * @param {string} itemId - Item ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Updated item
 */
export async function updateItemStatus(itemId, status) {
    return itemModel.findByIdAndUpdate(
        itemId,
        { $set: { status } },
        { returnDocument: 'after' }
    );
}

export async function updateItemProcessing(itemId, userId, updateData) {
    return itemModel.findOneAndUpdate(
        { _id: itemId, userId, isDeleted: false },
        { $set: updateData },
        { returnDocument: 'after' }
    );
}

/**
 * Batch update items with tags
 * @param {Array<string>} itemIds - Array of item IDs
 * @param {Array<string>} tagIds - Array of tag IDs
 * @returns {Promise} Bulk write result
 */
export async function addTagsToItems(itemIds, tagIds) {
    return itemModel.updateMany(
        { _id: { $in: itemIds } },
        { $addToSet: { tags: { $each: tagIds } } }
    );
}

/**
 * Get related items based on tags
 * @param {string} itemId - Item ID
 * @param {string} userId - User ID
 * @param {number} limit - Limit results
 * @returns {Promise<Array>} Related items
 */
export async function getRelatedItems(itemId, userId, limit = 5) {
    const item = await itemModel.findOne({ _id: itemId, userId, isDeleted: false }).lean();
    if (!item || !item.tags || item.tags.length === 0) return [];

    return itemModel
        .find({ userId, isDeleted: false, tags: { $in: item.tags }, _id: { $ne: itemId } })
        .limit(limit)
        .lean();
}

export async function findUserItemsForSemantic(userId, excludeItemId = null) {
    const query = { userId, isDeleted: false, embeddings: { $exists: true, $ne: [] } };
    if (excludeItemId) {
        query._id = { $ne: excludeItemId };
    }

    return itemModel.find(query).lean();
}
