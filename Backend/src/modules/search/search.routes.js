import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import * as searchController from './search.controller.js';

const router = Router();

router.use(authenticate);
router.get('/', searchController.search);

export default router;
