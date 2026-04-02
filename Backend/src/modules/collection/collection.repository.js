import collectionModel from '../../models/collection.model.js';

/**
 * Create a new collection
 * @param {Object} collectionData - Collection data
 * @returns {Promise<Object>} Created collection
 */
export async function createCollection(collectionData) {
    return collectionModel.create(collectionData);
}

/**
 * Find collections by user
 * @param {string} userId - User ID
 * @param {number} skip - Documents to skip
 * @param {number} limit - Documents limit
 * @returns {Promise<Array>} Array of collections
 */
export async function findCollectionsByUser(userId, skip = 0, limit = 20) {
    return collectionModel
        .find({ userId, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
}

/**
 * Find collection by ID and user
 * @param {string} collectionId - Collection ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Collection document
 */
export async function findCollectionById(collectionId, userId) {
    return collectionModel
        .findOne({ _id: collectionId, userId, isDeleted: false })
        .populate('itemIds')
        .lean();
}

/**
 * Find collection without items (faster)
 * @param {string} collectionId - Collection ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Collection document
 */
export async function findCollectionByIdLight(collectionId, userId) {
    return collectionModel
        .findOne({ _id: collectionId, userId, isDeleted: false })
        .lean();
}

/**
 * Update collection
 * @param {string} collectionId - Collection ID
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated collection
 */
export async function updateCollection(collectionId, userId, updateData) {
    return collectionModel.findOneAndUpdate(
        { _id: collectionId, userId, isDeleted: false },
        { $set: updateData },
        { returnDocument: 'after' }
    );
}

/**
 * Soft delete collection
 * @param {string} collectionId - Collection ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Deleted collection
 */
export async function softDeleteCollection(collectionId, userId) {
    return collectionModel.findOneAndUpdate(
        { _id: collectionId, userId },
        { $set: { isDeleted: true } },
        { returnDocument: 'after' }
    );
}

/**
 * Add item to collection
 * @param {string} collectionId - Collection ID
 * @param {string} itemId - Item ID
 * @returns {Promise<Object>} Updated collection
 */
export async function addItemToCollection(collectionId, itemId) {
    return collectionModel.findByIdAndUpdate(
        collectionId,
        {
            $addToSet: { itemIds: itemId },
            $inc: { itemCount: 1 },
        },
        { returnDocument: 'after' }
    );
}

/**
 * Remove item from collection
 * @param {string} collectionId - Collection ID
 * @param {string} itemId - Item ID
 * @returns {Promise<Object>} Updated collection
 */
export async function removeItemFromCollection(collectionId, itemId) {
    return collectionModel.findByIdAndUpdate(
        collectionId,
        {
            $pull: { itemIds: itemId },
            $inc: { itemCount: -1 },
        },
        { returnDocument: 'after' }
    );
}

/**
 * Get total count of collections for user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Count of collections
 */
export async function countCollectionsByUser(userId) {
    return collectionModel.countDocuments({ userId, isDeleted: false });
}
