import mongoose from 'mongoose';

const tokenAuditSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        tokenHash: {
            type: String,
            required: true,
            index: true,
        },
        tokenType: {
            type: String,
            enum: ['access', 'refresh'],
            default: 'refresh',
        },
        usedAt: {
            type: Date,
            default: Date.now,
        },
        suspiciousReuse: {
            type: Boolean,
            default: false,
        },
        reuseCount: {
            type: Number,
            default: 0,
        },
        ipAddresses: {
            type: [String],
            default: [],
        },
        userAgent: {
            type: String,
        },
        deviceId: {
            type: String,
        },
    },
    { timestamps: true }
);

// TTL index (7 days)
tokenAuditSchema.index(
    { usedAt: 1 },
    { expireAfterSeconds: 604800 }
);

const tokenAuditModel = mongoose.model('TokenAudit', tokenAuditSchema);

export default tokenAuditModel;
