import { sendError } from '../helpers/response.js';

export function notFoundHandler(req, res) {
    return sendError(res, 'Route not found', `Cannot ${req.method} ${req.originalUrl}`, 404);
}

export function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;
    const errorDetail = process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.stack;
    return sendError(res, err.message || 'Internal server error', errorDetail, statusCode);
}
