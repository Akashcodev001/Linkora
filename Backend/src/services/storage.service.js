import { v2 as cloudinary } from 'cloudinary';
import env from '../config/env.js';

let configured = false;

function ensureCloudinaryConfig() {
    if (configured) return;

    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
        return;
    }

    cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true,
    });

    configured = true;
}

export async function uploadBuffer(fileBuffer, options = {}) {
    ensureCloudinaryConfig();

    if (!configured) {
        return null;
    }

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: options.folder || 'linkora/items',
                resource_type: options.resourceType || 'auto',
                public_id: options.publicId,
                overwrite: true,
            },
            (error, result) => {
                if (error) return reject(error);
                return resolve({
                    url: result?.secure_url || null,
                    publicId: result?.public_id || null,
                    bytes: result?.bytes || null,
                    format: result?.format || null,
                    resourceType: result?.resource_type || null,
                });
            }
        );

        uploadStream.end(fileBuffer);
    });
}
