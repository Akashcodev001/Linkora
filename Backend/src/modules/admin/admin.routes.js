import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requireAdmin } from '../../middlewares/admin.middleware.js';
import * as adminController from './admin.controller.js';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/overview', adminController.getOverview);
router.get('/users', adminController.listUsers);
router.get('/export/users.csv', adminController.exportUsersCsv);
router.get('/export/quota-audit.csv', adminController.exportQuotaAuditCsv);
router.patch('/users/:userId/quota', adminController.updateUserQuota);
router.patch('/users/:userId/suspend', adminController.suspendUser);
router.patch('/users/:userId/reactivate', adminController.reactivateUser);
router.delete('/users/:userId', adminController.deleteUser);

export default router;
