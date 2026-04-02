import * as collectionRepository from './collection.repository.js';
import * as itemRepository from '../item/item.repository.js';

/**
 * Create collection
 * @param {string} userId - User ID
 * @param {Object} collectionData - Collection data
 * @returns {Promise<Object>} Created collection
 */
export async function createCollectionService(userId, collectionData) {
    return collectionRepository.createCollection({
        userId,
        ...collectionData,
    });
}

/**
 * Get user collections
 * @param {string} userId - User ID
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Paginated collections
 */
export async function getUserCollectionsService(userId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [collections, total] = await Promise.all([
        collectionRepository.findCollectionsByUser(userId, skip, limit),
        collectionRepository.countCollectionsByUser(userId),
    ]);

    return {
        collections,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
}

/**
 * Get single collection
 * @param {string} collectionId - Collection ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Collection including items
 */
export async function getCollectionService(collectionId, userId) {
    const collection = await collectionRepository.findCollectionById(collectionId, userId);

    if (!collection) {
        const error = new Error('Collection not found');
        error.statusCode = 404;
        throw error;
    }

    return collection;
}

/**
 * Update collection
 * @param {string} collectionId - Collection ID
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Updated collection
 */
export async function updateCollectionService(collectionId, userId, updateData) {
    const collection = await collectionRepository.findCollectionByIdLight(collectionId, userId);

    if (!collection) {
        const error = new Error('Collection not found');
        error.statusCode = 404;
        throw error;
    }

    return collectionRepository.updateCollection(collectionId, userId, updateData);
}

/**
 * Delete collection (soft delete)
 * @param {string} collectionId - Collection ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Message
 */
export async function deleteCollectionService(collectionId, userId) {
    const collection = await collectionRepository.findCollectionByIdLight(collectionId, userId);

    if (!collection) {
        const error = new Error('Collection not found');
        error.statusCode = 404;
        throw error;
    }

    await collectionRepository.softDeleteCollection(collectionId, userId);
    return { message: 'Collection deleted successfully' };
}

/**
 * Add item to collection
 * @param {string} collectionId - Collection ID
 * @param {string} itemId - Item ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated collection
 */
export async function addItemToCollectionService(collectionId, itemId, userId) {
    const collection = await collectionRepository.findCollectionByIdLight(collectionId, userId);

    if (!collection) {
        const error = new Error('Collection not found');
        error.statusCode = 404;
        throw error;
    }

    const item = await itemRepository.findItemById(itemId, userId);

    if (!item) {
        const error = new Error('Item not found');
        error.statusCode = 404;
        throw error;
    }

    const hasItem = (collection.itemIds || []).some((id) => String(id) === String(itemId));

    if (!hasItem) {
        await collectionRepository.addItemToCollection(collectionId, itemId);
    }

    if (!item.collectionId || String(item.collectionId._id || item.collectionId) !== String(collectionId)) {
        await itemRepository.updateItem(itemId, userId, { collectionId });
    }

    return collectionRepository.findCollectionById(collectionId, userId);
}

/**
 * Remove item from collection
 * @param {string} collectionId - Collection ID
 * @param {string} itemId - Item ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated collection
 */
export async function removeItemFromCollectionService(collectionId, itemId, userId) {
    const collection = await collectionRepository.findCollectionByIdLight(collectionId, userId);

    if (!collection) {
        const error = new Error('Collection not found');
        error.statusCode = 404;
        throw error;
    }

    const item = await itemRepository.findItemById(itemId, userId);

    if (!item) {
        const error = new Error('Item not found');
        error.statusCode = 404;
        throw error;
    }

    const hasItem = (collection.itemIds || []).some((id) => String(id) === String(itemId));

    if (hasItem) {
        await collectionRepository.removeItemFromCollection(collectionId, itemId);
    }

    if (item.collectionId && String(item.collectionId._id || item.collectionId) === String(collectionId)) {
        await itemRepository.updateItem(itemId, userId, { collectionId: null });
    }

    return collectionRepository.findCollectionById(collectionId, userId);
}
