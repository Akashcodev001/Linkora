import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import * as clustersController from './clusters.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', clustersController.getClusters);
router.get('/:clusterId', clustersController.getCluster);
router.post('/rebuild', clustersController.rebuildClusters);

export default router;
