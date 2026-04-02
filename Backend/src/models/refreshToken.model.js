import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        tokenHash: {
            type: String,
            required: true,
            unique: true,
        },
        previousTokenHash: {
            type: String,
            default: null,
            index: true,
        },
        replacedByTokenHash: {
            type: String,
            default: null,
            index: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expireAfterSeconds: 0 },
        },
        revokedAt: {
            type: Date,
            default: null,
        },
        revokedReason: {
            type: String,
            default: null,
        },
        lastUsedAt: {
            type: Date,
            default: null,
        },
        metadata: {
            ip: {
                type: String,
                default: null,
            },
            userAgent: {
                type: String,
                default: null,
            },
            deviceId: {
                type: String,
                default: null,
            },
        },
    },
    { timestamps: true }
);

// Enforce a single active refresh session per user.
refreshTokenSchema.index(
    { userId: 1 },
    {
        unique: true,
        partialFilterExpression: { revokedAt: null },
    }
);

const refreshTokenModel = mongoose.model('RefreshToken', refreshTokenSchema);

export default refreshTokenModel;
