import jwt from 'jsonwebtoken';
import env from '../config/env.js';

/**
 * Authenticate middleware - Verify JWT token and attach user to request
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
export function authenticate(req, res, next) {
    try {
        // Protected APIs must only accept access tokens.
        let token = req.cookies?.accessToken;

        if (!token && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.slice(7);
            }
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided',
            });
        }

        // Verify token
        const decoded = jwt.verify(token, env.JWT_SECRET);

        // Attach user to request
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: error.message || 'Invalid or expired token',
        });
    }
}

/**
 * Optional authentication middleware - Attach user if token is valid, but don't fail if missing
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next middleware
 */
export function optionalAuthenticate(req, res, next) {
    try {
        let token = req.cookies?.accessToken;

        if (!token && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.slice(7);
            }
        }

        if (token) {
            const decoded = jwt.verify(token, env.JWT_SECRET);
            req.user = decoded;
        }

        next();
    } catch (error) {
        // Silently fail and continue
        next();
    }
}
