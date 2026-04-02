import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import * as resurfacingController from './resurfacing.controller.js';

const router = Router();

router.use(authenticate);
router.get('/', resurfacingController.getResurfacing);

export default router;
