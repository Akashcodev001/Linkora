/**
 * Response wrapper helper
 * Provides consistent API response format across all endpoints
 */

/**
 * Success response wrapper
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Response message
 * @param {any} data - Response data (optional)
 */
export function sendSuccess(res, statusCode = 200, message = 'Success', data = null) {
    const response = {
        success: true,
        message,
        timestamp: new Date().toISOString(),
    };

    if (data !== null && data !== undefined) {
        response.data = data;
    }

    res.status(statusCode).json(response);
}

/**
 * Error response wrapper
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {any} errors - Error details (optional)
 */
export function sendError(res, statusCode = 500, message = 'Error', errors = null) {
    const response = {
        success: false,
        message,
        timestamp: new Date().toISOString(),
    };

    if (errors) {
        response.errors = errors;
    }

    res.status(statusCode).json(response);
}

/**
 * Paginated response wrapper
 * @param {Object} res - Express response object
 * @param {Array} items - Array of items
 * @param {Object} pagination - Pagination metadata
 * @param {string} message - Response message
 * @param {number} statusCode - HTTP status code
 */
export function sendPaginatedSuccess(
    res,
    items = [],
    pagination = {},
    message = 'Success',
    statusCode = 200
) {
    const response = {
        success: true,
        message,
        data: items,
        pagination: {
            page: pagination.page || 1,
            limit: pagination.limit || 20,
            total: pagination.total || items.length,
            pages: pagination.pages || Math.ceil((pagination.total || items.length) / (pagination.limit || 20)),
        },
        timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(response);
}

/**
 * Created response wrapper (201 Created)
 * @param {Object} res - Express response object
 * @param {any} data - Created resource data
 * @param {string} message - Response message
 */
export function sendCreated(res, data, message = 'Resource created successfully') {
    sendSuccess(res, 201, message, data);
}

/**
 * No content response wrapper (204 No Content)
 * @param {Object} res - Express response object
 */
export function sendNoContent(res) {
    res.status(204).send();
}

/**
 * Validation error response wrapper
 * @param {Object} res - Express response object
 * @param {Array|Object} errors - Validation errors
 * @param {string} message - Error message
 */
export function sendValidationError(
    res,
    errors,
    message = 'Validation failed'
) {
    sendError(res, 400, message, errors);
}

/**
 * Not found response wrapper (404)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
export function sendNotFound(res, message = 'Resource not found') {
    sendError(res, 404, message);
}

/**
 * Conflict response wrapper (409)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
export function sendConflict(res, message = 'Resource already exists') {
    sendError(res, 409, message);
}

/**
 * Unauthorized response wrapper (401)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
export function sendUnauthorized(res, message = 'Unauthorized') {
    sendError(res, 401, message);
}

/**
 * Forbidden response wrapper (403)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
export function sendForbidden(res, message = 'Forbidden') {
    sendError(res, 403, message);
}

/**
 * Too many requests response wrapper (429)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Object} retryAfter - Retry after metadata
 */
export function sendTooManyRequests(res, message = 'Too many requests', retryAfter = null) {
    const response = {
        success: false,
        message,
        timestamp: new Date().toISOString(),
    };

    if (retryAfter) {
        response.retryAfter = retryAfter;
        res.set('Retry-After', retryAfter.seconds?.toString() || '60');
    }

    res.status(429).json(response);
}

/**
 * Internal server error response wrapper (500)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {boolean} isDevelopment - Include stack trace in development
 * @param {any} stack - Stack trace (dev only)
 */
export function sendInternalError(res, message = 'Internal server error', isDevelopment = false, stack = null) {
    const response = {
        success: false,
        message,
        timestamp: new Date().toISOString(),
    };

    if (isDevelopment && stack) {
        response.stack = stack;
    }

    res.status(500).json(response);
}
