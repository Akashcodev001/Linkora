import userModel from '../models/user.model.js';
import { sendError } from '../common/helpers/response.js';
import { isAdminUserLike } from '../common/utils/admin.util.js';

export async function requireAdmin(req, res, next) {
    try {
        if (!req.user?.id) {
            return sendError(res, 'Unauthorized', 'Missing authenticated user', 401);
        }

        if (isAdminUserLike(req.user)) {
            return next();
        }

        const user = await userModel.findById(req.user.id).select('email role');
        if (!user || !isAdminUserLike(user)) {
            return sendError(res, 'Forbidden', 'Admin access required', 403);
        }

        req.user = {
            ...req.user,
            email: user.email,
            role: user.role,
        };

        return next();
    } catch (error) {
        return sendError(res, 'Forbidden', error.message || 'Admin validation failed', 403);
    }
}
