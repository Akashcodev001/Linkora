import { Router } from 'express';
import * as highlightController from './highlight.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all routes with authentication
router.use(authenticate);

/**
 * @route POST /api/highlights
 * Create highlight
 */
router.post('/', highlightController.createHighlight);

/**
 * @route GET /api/highlights/item/:itemId
 * Get highlights for item (must be before :id route)
 */
router.get('/item/:itemId', highlightController.getHighlightsForItem);

/**
 * @route GET /api/highlights/:id
 * Get single highlight
 */
router.get('/:id', highlightController.getHighlight);

/**
 * @route PATCH /api/highlights/:id
 * Update highlight
 */
router.patch('/:id', highlightController.updateHighlight);

/**
 * @route DELETE /api/highlights/:id
 * Delete highlight
 */
router.delete('/:id', highlightController.deleteHighlight);

export default router;
