import { sendError, sendSuccess } from '../../common/helpers/response.js';
import {
    getAdminOverviewService,
    getQuotaAuditCsvReportService,
    getUsersCsvReportService,
    listAdminUsersService,
    setUserDeletedService,
    setUserSuspendedService,
    updateUserQuotaService,
} from './admin.service.js';

export async function getOverview(req, res) {
    try {
        const overview = await getAdminOverviewService({
            windowDays: req.query.windowDays,
            topUsers: req.query.topUsers,
        });

        return sendSuccess(res, overview, 'Admin overview fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Failed to fetch admin overview', error.statusCode || 500);
    }
}

export async function listUsers(req, res) {
    try {
        const result = await listAdminUsersService({
            page: req.query.page,
            limit: req.query.limit,
            query: req.query.query,
            role: req.query.role,
            status: req.query.status,
            sortBy: req.query.sortBy,
            sortOrder: req.query.sortOrder,
        });

        return sendSuccess(res, result, 'Admin users fetched successfully');
    } catch (error) {
        return sendError(res, error.message || 'Failed to fetch admin users', error.statusCode || 500);
    }
}

export async function updateUserQuota(req, res) {
    try {
        const updatedUser = await updateUserQuotaService(req.params.userId, req.body || {}, req.user?.id);
        return sendSuccess(res, updatedUser, 'User quota updated successfully');
    } catch (error) {
        return sendError(res, error.message || 'Failed to update user quota', error.statusCode || 500);
    }
}

export async function suspendUser(req, res) {
    try {
        const user = await setUserSuspendedService(req.params.userId, {
            suspended: true,
            reason: req.body?.reason,
        });
        return sendSuccess(res, user, 'User suspended successfully');
    } catch (error) {
        return sendError(res, error.message || 'Failed to suspend user', error.statusCode || 500);
    }
}

export async function reactivateUser(req, res) {
    try {
        const user = await setUserSuspendedService(req.params.userId, {
            suspended: false,
        });
        return sendSuccess(res, user, 'User reactivated successfully');
    } catch (error) {
        return sendError(res, error.message || 'Failed to reactivate user', error.statusCode || 500);
    }
}

export async function deleteUser(req, res) {
    try {
        const user = await setUserDeletedService(req.params.userId, {
            deleted: true,
        });
        return sendSuccess(res, user, 'User soft deleted successfully');
    } catch (error) {
        return sendError(res, error.message || 'Failed to delete user', error.statusCode || 500);
    }
}

export async function exportUsersCsv(req, res) {
    try {
        const csv = await getUsersCsvReportService({
            query: req.query.query,
            role: req.query.role,
            status: req.query.status,
            sortBy: req.query.sortBy,
            sortOrder: req.query.sortOrder,
        });

        const fileName = `admin-users-${Date.now()}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.status(200).send(csv);
    } catch (error) {
        return sendError(res, error.message || 'Failed to export users CSV', error.statusCode || 500);
    }
}

export async function exportQuotaAuditCsv(req, res) {
    try {
        const csv = await getQuotaAuditCsvReportService({
            limit: req.query.limit,
        });

        const fileName = `admin-quota-audit-${Date.now()}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.status(200).send(csv);
    } catch (error) {
        return sendError(res, error.message || 'Failed to export quota audit CSV', error.statusCode || 500);
    }
}
