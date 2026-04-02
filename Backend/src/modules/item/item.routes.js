import { Router } from 'express';
import * as itemController from './item.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { validateBody, validateQuery } from '../../common/middleware/zodValidate.middleware.js';
import { rateLimit } from '../../common/middleware/rateLimit.middleware.js';
import { handleSingleItemUpload } from '../../common/middleware/upload.middleware.js';
import {
	hybridSearchQuerySchema,
	suggestionQuerySchema,
	resurfacingQuerySchema,
	uploadItemBodySchema,
	extensionItemBodySchema,
	extensionBulkBodySchema,
} from '../../schemas/item.phase2.schema.js';

const router = Router();

// Protect all routes with authentication
router.use(authenticate);

/**
 * @route POST /api/items
 * Create item
 */
router.post('/', itemController.createItem);

/**
 * @route POST /api/items/upload
 * Create item from file upload
 */
router.post('/upload', handleSingleItemUpload, validateBody(uploadItemBodySchema), itemController.createItemFromUpload);

/**
 * @route POST /api/items/from-extension
 * Create item from browser extension payload
 */
router.post('/from-extension', rateLimit(30, 60 * 1000), validateBody(extensionItemBodySchema), itemController.createItemFromExtension);

/**
 * @route POST /api/items/bulk-from-extension
 * Bulk create items from browser extension payload
 */
router.post('/bulk-from-extension', rateLimit(10, 60 * 1000), validateBody(extensionBulkBodySchema), itemController.createItemsFromExtensionBulk);

/**
 * @route GET /api/items/resurface
 * Resurfacing items
 */
router.get('/resurface', validateQuery(resurfacingQuerySchema), itemController.getResurfacing);

/**
 * @route GET /api/items/search/suggestions
 * Search suggestions (must be before :id route)
 */
router.get('/search/suggestions', validateQuery(suggestionQuerySchema), itemController.getSearchSuggestions);

/**
 * @route GET /api/items/search/query
 * Search items (must be before :id route)
 */
router.get('/search/query', validateQuery(hybridSearchQuerySchema), itemController.searchItems);

/**
 * @route GET /api/items
 * Get user items
 */
router.get('/', itemController.getItems);

/**
 * @route GET /api/items/:id/related
 * Get related items (must be before :id route)
 */
router.get('/:id/related', itemController.getRelatedItems);

/**
 * @route POST /api/items/:id/reprocess
 * Reprocess item (reset AI status and re-queue)
 */
router.post('/:id/reprocess', itemController.reprocessItem);

/**
 * @route POST /api/items/:id/share
 * Create share link for item
 */
router.post('/:id/share', itemController.createShareLink);

/**
 * @route GET /api/items/:id
 * Get single item
 */
router.get('/:id', itemController.getItem);

/**
 * @route PATCH /api/items/:id
 * Update item
 */
router.patch('/:id', itemController.updateItem);

/**
 * @route DELETE /api/items/:id
 * Delete item
 */
router.delete('/:id', itemController.deleteItem);

export default router;
