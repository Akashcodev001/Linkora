import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ['url', 'text', 'image', 'pdf', 'tweet'],
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: null,
            trim: true,
        },
        content: {
            type: String,
            default: null,
        },
        url: {
            type: String,
            default: null,
        },
        metadata: {
            author: String,
            source: String,
            domain: String,
            imageUrl: String,
            wordCount: Number,
            readingTime: Number,
            publishedDate: Date,
            mimeType: String,
            fileSize: Number,
            originalFilename: String,
            cloudinaryPublicId: String,
            autoTags: [String],
        },
        tags: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Tag',
            },
        ],
        collectionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Collection',
            default: null,
        },
        status: {
            type: String,
            enum: ['pending', 'processed', 'processed_without_ai', 'failed'],
            default: 'pending',
        },
        aiStatus: {
            type: String,
            enum: ['pending', 'processed', 'failed'],
            default: 'pending',
            index: true,
        },
        summary: {
            type: String,
            default: null,
        },
        detailedSummary: {
            type: String,
            default: null,
        },
        dedupHash: {
            type: String,
            default: null,
        },
        embeddings: {
            type: [Number],
            default: [],
        },
        processingError: {
            type: String,
            default: null,
        },
        clusterId: {
            type: String,
            default: null,
            index: true,
        },
        topic: {
            type: String,
            default: null,
            trim: true,
        },
        isDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },
        deletedAt: {
            type: Date,
            default: null,
            index: true,
        },
    },
    { timestamps: true }
);

// Indexes for performance
itemSchema.index({ userId: 1, isDeleted: 1 });
itemSchema.index({ title: 'text', description: 'text', content: 'text' });
itemSchema.index({ createdAt: 1 });
itemSchema.index({ status: 1 });
itemSchema.index({ userId: 1, clusterId: 1 });
itemSchema.index(
    { userId: 1, dedupHash: 1 },
    {
        unique: true,
        partialFilterExpression: {
            isDeleted: false,
            dedupHash: { $type: 'string' },
        },
    }
);

const itemModel = mongoose.model('Item', itemSchema);

export default itemModel;
