import { Router } from 'express';
import * as itemController from './item.controller.js';

const router = Router();

/**
 * @route GET /api/shared/items/:token
 * Public shared item retrieval
 */
router.get('/:token', itemController.getSharedItem);

export default router;
