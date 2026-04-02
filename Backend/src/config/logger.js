/**
 * Winston Logger Configuration
 * Provides structured logging for the application
 */

import winston from 'winston';
import env from './env.js';

const isProduction = env.NODE_ENV === 'production';

const logger = winston.createLogger({
    level: isProduction ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'linkora-backend' },
    transports: [
        // Console transport
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ level, message, timestamp, ...meta }) => {
                    return `${timestamp} [${level}]: ${message}`;
                })
            ),
        }),
        // Error logs
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
        }),
        // All logs
        new winston.transports.File({
            filename: 'logs/combined.log',
        }),
    ],
});

export default logger;
