import mongoose from 'mongoose';
import userModel from '../../models/user.model.js';
import itemModel from '../../models/item.model.js';
import jobModel from '../../models/job.model.js';
import quotaAuditModel from '../../models/quotaAudit.model.js';

function normalizeWindowDays(raw) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 14;
    return Math.min(90, Math.max(7, Math.floor(parsed)));
}

function buildWindowDates(windowDays) {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (windowDays - 1));
    return { now, start };
}

function formatDateKey(date) {
    return date.toISOString().slice(0, 10);
}

function toObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        const error = new Error('Invalid user id');
        error.statusCode = 400;
        throw error;
    }
    return new mongoose.Types.ObjectId(id);
}

function mapUserQuota(user) {
    const maxItems = Number(user?.usageQuota?.maxItems || 0);
    const aiJobsPerDay = Number(user?.usageQuota?.aiJobsPerDay || 0);
    const currentItems = Number(user?.usageQuota?.currentUsage?.items || 0);
    const currentAiJobsToday = Number(user?.usageQuota?.currentUsage?.aiJobsToday || 0);

    const aiRemaining = Math.max(0, aiJobsPerDay - currentAiJobsToday);
    const itemRemaining = Math.max(0, maxItems - currentItems);

    return {
        maxItems,
        aiJobsPerDay,
        currentItems,
        currentAiJobsToday,
        aiRemaining,
        itemRemaining,
        aiUsagePercent: aiJobsPerDay > 0 ? Number(((currentAiJobsToday / aiJobsPerDay) * 100).toFixed(1)) : 0,
        itemUsagePercent: maxItems > 0 ? Number(((currentItems / maxItems) * 100).toFixed(1)) : 0,
        aiLimitReached: aiJobsPerDay > 0 ? currentAiJobsToday >= aiJobsPerDay : false,
        itemLimitReached: maxItems > 0 ? currentItems >= maxItems : false,
    };
}

function mapAdminUser(user) {
    return {
        id: String(user._id),
        username: user.username,
        email: user.email,
        verified: Boolean(user.verified),
        role: user.role || 'user',
        subscriptionTier: user.subscriptionTier,
        isSuspended: Boolean(user.isSuspended),
        suspendedAt: user.suspendedAt || null,
        suspensionReason: user.suspensionReason || null,
        isDeleted: Boolean(user.isDeleted),
        deletedAt: user.deletedAt || null,
        quota: mapUserQuota(user),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}

function csvEscape(value) {
    const text = value === undefined || value === null ? '' : String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function parseSort(sortBy, sortOrder) {
    const allowed = new Set(['createdAt', 'updatedAt', 'username', 'email', 'role', 'subscriptionTier', 'aiUsage', 'itemUsage']);
    const safeSortBy = allowed.has(String(sortBy || '')) ? String(sortBy) : 'createdAt';
    const direction = String(sortOrder || '').toLowerCase() === 'asc' ? 1 : -1;

    if (safeSortBy === 'aiUsage') {
        return { 'usageQuota.currentUsage.aiJobsToday': direction, createdAt: -1 };
    }
    if (safeSortBy === 'itemUsage') {
        return { 'usageQuota.currentUsage.items': direction, createdAt: -1 };
    }
    return { [safeSortBy]: direction };
}

async function getUsageTimeline(startDate) {
    const rows = await jobModel.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate },
            },
        },
        {
            $group: {
                _id: {
                    day: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt',
                        },
                    },
                    userId: '$userId',
                },
                requests: { $sum: 1 },
            },
        },
        {
            $group: {
                _id: '$_id.day',
                totalRequests: { $sum: '$requests' },
                activeUsers: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    return new Map(rows.map((row) => [String(row._id), row]));
}

export async function getAdminOverviewService({
    windowDays = 14,
    topUsers = 10,
} = {}) {
    const normalizedWindowDays = normalizeWindowDays(windowDays);
    const cappedTopUsers = Math.min(50, Math.max(5, Number(topUsers) || 10));
    const { start } = buildWindowDates(normalizedWindowDays);

    const [
        totalUsers,
        totalItems,
        totalJobs,
        processedJobs,
        failedJobs,
        pendingJobs,
        users,
        usageTimelineMap,
    ] = await Promise.all([
        userModel.countDocuments({ isDeleted: { $ne: true } }),
        itemModel.countDocuments({ isDeleted: { $ne: true } }),
        jobModel.countDocuments({}),
        jobModel.countDocuments({ status: 'success' }),
        jobModel.countDocuments({ status: 'failed' }),
        jobModel.countDocuments({ status: 'pending' }),
        userModel
            .find({ isDeleted: { $ne: true } })
            .sort({ 'usageQuota.currentUsage.aiJobsToday': -1, createdAt: -1 })
            .limit(cappedTopUsers)
            .select('username email role subscriptionTier usageQuota createdAt updatedAt'),
        getUsageTimeline(start),
    ]);

    const timeline = [];
    for (let i = 0; i < normalizedWindowDays; i += 1) {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        const key = formatDateKey(day);
        const point = usageTimelineMap.get(key);

        timeline.push({
            day: key,
            requests: Number(point?.totalRequests || 0),
            activeUsers: Number(point?.activeUsers || 0),
        });
    }

    const usersWithQuota = users.map((user) => {
        const quota = mapUserQuota(user);
        return {
            id: String(user._id),
            username: user.username,
            email: user.email,
            role: user.role || 'user',
            subscriptionTier: user.subscriptionTier,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            quota,
        };
    });

    const usersAtAiLimit = usersWithQuota.filter((user) => user.quota.aiLimitReached).length;
    const usersNearAiLimit = usersWithQuota.filter((user) => user.quota.aiUsagePercent >= 80 && !user.quota.aiLimitReached).length;

    return {
        metrics: {
            totalUsers,
            totalItems,
            totalJobs,
            processedJobs,
            failedJobs,
            pendingJobs,
            usersAtAiLimit,
            usersNearAiLimit,
            successRate: totalJobs > 0 ? Number(((processedJobs / totalJobs) * 100).toFixed(1)) : 0,
        },
        timeline,
        topAiUsageUsers: usersWithQuota,
        windowDays: normalizedWindowDays,
    };
}

export async function listAdminUsersService({
    page = 1,
    limit = 25,
    query = '',
    role = 'all',
    status = 'active',
    sortBy = 'createdAt',
    sortOrder = 'desc',
} = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(10, Number(limit) || 25));
    const skip = (safePage - 1) * safeLimit;

    const filter = {};

    const roleValue = String(role || 'all').toLowerCase();
    if (roleValue !== 'all') {
        filter.role = roleValue;
    }

    const statusValue = String(status || 'active').toLowerCase();
    if (statusValue === 'active') {
        filter.isDeleted = { $ne: true };
        filter.isSuspended = { $ne: true };
    } else if (statusValue === 'suspended') {
        filter.isDeleted = { $ne: true };
        filter.isSuspended = true;
    } else if (statusValue === 'deleted') {
        filter.isDeleted = true;
    } else {
        filter.isDeleted = { $in: [true, false] };
    }

    if (String(query || '').trim()) {
        const regex = new RegExp(String(query).trim(), 'i');
        filter.$or = [{ username: regex }, { email: regex }];
    }

    const sort = parseSort(sortBy, sortOrder);

    const [users, total] = await Promise.all([
        userModel
            .find(filter)
            .sort(sort)
            .skip(skip)
            .limit(safeLimit)
            .select('username email role subscriptionTier usageQuota createdAt updatedAt verified isSuspended suspendedAt suspensionReason isDeleted deletedAt'),
        userModel.countDocuments(filter),
    ]);

    return {
        items: users.map(mapAdminUser),
        pagination: {
            page: safePage,
            limit: safeLimit,
            total,
            totalPages: Math.ceil(total / safeLimit) || 1,
        },
        filters: {
            role: roleValue,
            status: statusValue,
            sortBy,
            sortOrder: String(sortOrder || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc',
        },
    };
}

export async function updateUserQuotaService(userId, updates = {}, adminId) {
    const targetId = toObjectId(userId);

    const setPatch = {};
    if (updates.maxItems !== undefined) {
        setPatch['usageQuota.maxItems'] = Math.max(1, Number(updates.maxItems));
    }

    if (updates.aiJobsPerDay !== undefined) {
        setPatch['usageQuota.aiJobsPerDay'] = Math.max(1, Number(updates.aiJobsPerDay));
    }

    if (updates.subscriptionTier) {
        setPatch.subscriptionTier = String(updates.subscriptionTier);
    }

    if (updates.role) {
        setPatch.role = String(updates.role);
    }

    if (!Object.keys(setPatch).length) {
        const error = new Error('No valid quota updates provided');
        error.statusCode = 400;
        throw error;
    }

    const before = await userModel.findById(targetId).select('usageQuota subscriptionTier role');

    const updated = await userModel.findByIdAndUpdate(
        targetId,
        { $set: setPatch },
        { returnDocument: 'after', runValidators: true }
    ).select('username email role subscriptionTier usageQuota createdAt updatedAt verified isSuspended suspendedAt suspensionReason isDeleted deletedAt');

    if (!updated) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    const changes = {
        maxItems: {
            before: Number(before?.usageQuota?.maxItems || 0),
            after: Number(updated?.usageQuota?.maxItems || 0),
        },
        aiJobsPerDay: {
            before: Number(before?.usageQuota?.aiJobsPerDay || 0),
            after: Number(updated?.usageQuota?.aiJobsPerDay || 0),
        },
        subscriptionTier: {
            before: before?.subscriptionTier || null,
            after: updated?.subscriptionTier || null,
        },
        role: {
            before: before?.role || null,
            after: updated?.role || null,
        },
    };

    if (adminId) {
        await quotaAuditModel.create({
            userId: targetId,
            adminId: toObjectId(adminId),
            changes,
            note: String(updates.note || '').trim() || null,
        });
    }

    return mapAdminUser(updated);
}

export async function setUserSuspendedService(userId, {
    suspended = true,
    reason = '',
} = {}) {
    const targetId = toObjectId(userId);
    const update = suspended
        ? {
            isSuspended: true,
            suspendedAt: new Date(),
            suspensionReason: String(reason || '').trim() || 'Suspended by admin',
        }
        : {
            isSuspended: false,
            suspendedAt: null,
            suspensionReason: null,
        };

    const user = await userModel.findByIdAndUpdate(
        targetId,
        { $set: update },
        { returnDocument: 'after' }
    ).select('username email role subscriptionTier usageQuota createdAt updatedAt verified isSuspended suspendedAt suspensionReason isDeleted deletedAt');

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    return mapAdminUser(user);
}

export async function setUserDeletedService(userId, {
    deleted = true,
} = {}) {
    const targetId = toObjectId(userId);

    const user = await userModel.findByIdAndUpdate(
        targetId,
        {
            $set: {
                isDeleted: Boolean(deleted),
                deletedAt: deleted ? new Date() : null,
            },
        },
        { returnDocument: 'after' }
    ).select('username email role subscriptionTier usageQuota createdAt updatedAt verified isSuspended suspendedAt suspensionReason isDeleted deletedAt');

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        throw error;
    }

    return mapAdminUser(user);
}

export async function getUsersCsvReportService(params = {}) {
    const usersResult = await listAdminUsersService({
        ...params,
        page: 1,
        limit: 5000,
    });

    const headers = [
        'id',
        'username',
        'email',
        'role',
        'subscriptionTier',
        'verified',
        'isSuspended',
        'isDeleted',
        'currentAiJobsToday',
        'aiJobsPerDay',
        'currentItems',
        'maxItems',
        'createdAt',
        'updatedAt',
    ];

    const rows = usersResult.items.map((user) => [
        user.id,
        user.username,
        user.email,
        user.role,
        user.subscriptionTier,
        user.verified,
        user.isSuspended,
        user.isDeleted,
        user.quota.currentAiJobsToday,
        user.quota.aiJobsPerDay,
        user.quota.currentItems,
        user.quota.maxItems,
        user.createdAt,
        user.updatedAt,
    ]);

    return [headers, ...rows].map((cols) => cols.map(csvEscape).join(',')).join('\n');
}

export async function getQuotaAuditCsvReportService({
    limit = 5000,
} = {}) {
    const safeLimit = Math.min(10000, Math.max(50, Number(limit) || 5000));
    const rows = await quotaAuditModel
        .find({})
        .sort({ createdAt: -1 })
        .limit(safeLimit)
        .populate('userId', 'username email')
        .populate('adminId', 'username email')
        .lean();

    const headers = [
        'auditId',
        'createdAt',
        'targetUserId',
        'targetUsername',
        'targetEmail',
        'adminUserId',
        'adminUsername',
        'adminEmail',
        'changesJson',
        'note',
    ];

    const csvRows = rows.map((row) => [
        String(row._id),
        row.createdAt,
        row.userId?._id ? String(row.userId._id) : '',
        row.userId?.username || '',
        row.userId?.email || '',
        row.adminId?._id ? String(row.adminId._id) : '',
        row.adminId?.username || '',
        row.adminId?.email || '',
        JSON.stringify(row.changes || {}),
        row.note || '',
    ]);

    return [headers, ...csvRows].map((cols) => cols.map(csvEscape).join(',')).join('\n');
}
