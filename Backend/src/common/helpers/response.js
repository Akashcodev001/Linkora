/**
 * Unified success response.
 * Supports both signatures for backward compatibility:
 * 1) sendSuccess(res, data, message, statusCode)
 * 2) sendSuccess(res, message, data, statusCode)
 */
export function sendSuccess(res, arg1 = null, arg2 = 'Success', arg3 = 200) {
    let data;
    let message;
    let statusCode;

    if (typeof arg1 === 'string') {
        message = arg1;
        data = arg2 && typeof arg2 === 'object' ? arg2 : null;
        statusCode = Number.isInteger(arg3) ? arg3 : 200;
    } else {
        data = arg1;
        message = typeof arg2 === 'string' ? arg2 : 'Success';
        statusCode = Number.isInteger(arg3) ? arg3 : 200;
    }

    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
}

/**
 * Unified error response.
 * Supports both signatures for backward compatibility:
 * 1) sendError(res, message, statusCode)
 * 2) sendError(res, message, error, statusCode)
 */
export function sendError(res, message = 'Error', arg2 = 400, arg3 = undefined) {
    let statusCode;
    let error;

    if (Number.isInteger(arg2)) {
        statusCode = arg2;
        error = arg3;
    } else {
        error = arg2;
        statusCode = Number.isInteger(arg3) ? arg3 : 400;
    }

    const payload = {
        success: false,
        message,
        data: null,
    };

    if (error !== undefined && error !== null) {
        payload.error = error;
    }

    return res.status(statusCode).json(payload);
}
