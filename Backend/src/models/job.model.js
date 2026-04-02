import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        itemId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Item',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: [
                // New unified types
                'process-item',
                // (kept for backward compatibility)
                'embed-item',
                'summarize-item',
                'tag-item',
                'cluster-items',
                'embed-query',
            ],
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ['pending', 'success', 'failed', 'skipped'],
            default: 'pending',
            index: true,
        },
        queueJobId: {
            type: String,
            default: null,
            index: true,
        },
        attempts: {
            type: Number,
            default: 0,
        },
        lastError: {
            type: String,
            default: null,
        },
        errorLogs: {
            type: [String],
            default: [],
        },
    },
    { timestamps: true }
);

jobSchema.index({ userId: 1, createdAt: -1 });
jobSchema.index({ itemId: 1, type: 1 });

const jobModel = mongoose.model('Job', jobSchema);

export default jobModel;
