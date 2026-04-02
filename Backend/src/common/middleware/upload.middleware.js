import multer from 'multer';
import env from '../../config/env.js';

const MAX_UPLOAD_MB = Number.isFinite(env.CONTENT_UPLOAD_MAX_MB) && env.CONTENT_UPLOAD_MAX_MB > 0
    ? env.CONTENT_UPLOAD_MAX_MB
    : 8;

const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'text/markdown',
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_UPLOAD_MB * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            const error = new Error(
                `Unsupported file type \"${file.mimetype}\". Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`
            );
            error.statusCode = 400;
            return cb(error, false);
        }

        return cb(null, true);
    },
});

export function handleSingleItemUpload(req, res, next) {
    const middleware = upload.single('file');

    middleware(req, res, (err) => {
        if (!err) {
            return next();
        }

        if (err instanceof multer.MulterError) {
            err.statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
            if (err.code === 'LIMIT_FILE_SIZE') {
                err.message = `File too large. Max allowed size is ${MAX_UPLOAD_MB}MB.`;
            }
        }

        return next(err);
    });
}
