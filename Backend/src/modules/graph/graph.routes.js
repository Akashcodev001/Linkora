import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import * as graphController from './graph.controller.js';
import { validateParams, validateQuery } from '../../common/middleware/zodValidate.middleware.js';
import { graphExpandQuerySchema, graphItemParamsSchema } from '../../schemas/item.phase2.schema.js';

const router = Router();

router.use(authenticate);

router.get('/', graphController.getGraph);
router.get('/expand', validateQuery(graphExpandQuerySchema), graphController.expandGraph);
router.get('/:itemId/neighbors', validateParams(graphItemParamsSchema), graphController.getItemGraph);
router.get('/:itemId', validateParams(graphItemParamsSchema), graphController.getItemGraph);

export default router;
