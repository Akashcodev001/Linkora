import * as collectionService from './collection.service.js';
import { sendSuccess, sendError } from '../../common/helpers/response.js';

/**
 * Create collection
 * @route POST /api/collections
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function createCollection(req, res) {
    try {
        const userId = req.user.id;
        const { name, description, color } = req.body;

        if (!name) {
            return sendError(res, 'Collection name is required', 400);
        }

        const collection = await collectionService.createCollectionService(userId, {
            name,
            description,
            color,
        });

        return sendSuccess(res, collection, 'Collection created successfully', 201);
    } catch (error) {
        return sendError(res, error.message || 'Error creating collection', error.statusCode || 500);
    }
}

/**
 * Get user collections
 * @route GET /api/collections
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function getCollections(req, res) {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20 } = req.query;

        const result = await collectionService.getUserCollectionsService(userId, {
            page: parseInt(page),
            limit: parseInt(limit),
        });

        return sendSuccess(res, result, 'Collections fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching collections', error.statusCode || 500);
    }
}

/**
 * Get single collection
 * @route GET /api/collections/:id
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function getCollection(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const collection = await collectionService.getCollectionService(id, userId);

        return sendSuccess(res, collection, 'Collection fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error fetching collection', error.statusCode || 500);
    }
}

/**
 * Update collection
 * @route PATCH /api/collections/:id
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function updateCollection(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const updateData = req.body;

        const collection = await collectionService.updateCollectionService(id, userId, updateData);

        return sendSuccess(res, collection, 'Collection updated successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error updating collection', error.statusCode || 500);
    }
}

/**
 * Delete collection
 * @route DELETE /api/collections/:id
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function deleteCollection(req, res) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await collectionService.deleteCollectionService(id, userId);

        return sendSuccess(res, null, 'Collection deleted successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error deleting collection', error.statusCode || 500);
    }
}

/**
 * Add item to collection
 * @route POST /api/collections/:collectionId/items/:itemId
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function addItemToCollection(req, res) {
    try {
        const userId = req.user.id;
        const { collectionId, itemId } = req.params;

        const collection = await collectionService.addItemToCollectionService(
            collectionId,
            itemId,
            userId
        );

        return sendSuccess(res, collection, 'Item added to collection successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error adding item to collection', error.statusCode || 500);
    }
}

/**
 * Remove item from collection
 * @route DELETE /api/collections/:collectionId/items/:itemId
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function removeItemFromCollection(req, res) {
    try {
        const userId = req.user.id;
        const { collectionId, itemId } = req.params;

        const collection = await collectionService.removeItemFromCollectionService(
            collectionId,
            itemId,
            userId
        );

        return sendSuccess(res, collection, 'Item removed from collection successfully');
    } catch (error) {
        return sendError(res, error.message || 'Error removing item from collection', error.statusCode || 500);
    }
}
