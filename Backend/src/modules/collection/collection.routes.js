import { Router } from 'express';
import * as collectionController from './collection.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all routes with authentication
router.use(authenticate);

/**
 * @route POST /api/collections
 * Create collection
 */
router.post('/', collectionController.createCollection);

/**
 * @route GET /api/collections
 * Get user collections
 */
router.get('/', collectionController.getCollections);

/**
 * @route GET /api/collections/:id
 * Get single collection
 */
router.get('/:id', collectionController.getCollection);

/**
 * @route PATCH /api/collections/:id
 * Update collection
 */
router.patch('/:id', collectionController.updateCollection);

/**
 * @route DELETE /api/collections/:id
 * Delete collection
 */
router.delete('/:id', collectionController.deleteCollection);

/**
 * @route POST /api/collections/:collectionId/items/:itemId
 * Add item to collection
 */
router.post('/:collectionId/items/:itemId', collectionController.addItemToCollection);

/**
 * @route DELETE /api/collections/:collectionId/items/:itemId
 * Remove item from collection
 */
router.delete('/:collectionId/items/:itemId', collectionController.removeItemFromCollection);

export default router;
