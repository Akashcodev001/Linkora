import { Router } from 'express';
import * as tagController from './tag.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Protect all routes with authentication
router.use(authenticate);

/**
 * @route POST /api/tags
 * Create tag
 */
router.post('/', tagController.createTag);

/**
 * @route GET /api/tags
 * Get user tags
 */
router.get('/', tagController.getTags);

/**
 * @route GET /api/tags/:id
 * Get single tag
 */
router.get('/:id', tagController.getTag);

/**
 * @route PATCH /api/tags/:id
 * Update tag
 */
router.patch('/:id', tagController.updateTag);

/**
 * @route DELETE /api/tags/:id
 * Delete tag
 */
router.delete('/:id', tagController.deleteTag);

export default router;
