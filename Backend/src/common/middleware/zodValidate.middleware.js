import { sendError } from '../helpers/response.js';

function formatZodIssues(error) {
    return error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
    }));
}

export function validateBody(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return sendError(res, 'Validation failed', { issues: formatZodIssues(result.error) }, 400);
        }

        req.body = result.data;
        return next();
    };
}

export function validateQuery(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            return sendError(res, 'Validation failed', { issues: formatZodIssues(result.error) }, 400);
        }

        Object.keys(req.query || {}).forEach((key) => {
            delete req.query[key];
        });
        Object.assign(req.query, result.data);
        return next();
    };
}

export function validateParams(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.params);
        if (!result.success) {
            return sendError(res, 'Validation failed', { issues: formatZodIssues(result.error) }, 400);
        }

        Object.keys(req.params || {}).forEach((key) => {
            delete req.params[key];
        });
        Object.assign(req.params, result.data);
        return next();
    };
}
