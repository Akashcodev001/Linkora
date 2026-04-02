import mongoose from 'mongoose';

const quotaAuditSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        changes: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
            default: {},
        },
        note: {
            type: String,
            default: null,
            trim: true,
        },
    },
    { timestamps: true }
);

quotaAuditSchema.index({ userId: 1, createdAt: -1 });
quotaAuditSchema.index({ adminId: 1, createdAt: -1 });

const quotaAuditModel = mongoose.model('QuotaAudit', quotaAuditSchema);

export default quotaAuditModel;
