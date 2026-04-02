import mongoose from 'mongoose';

const collectionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: null,
            trim: true,
        },
        itemIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Item',
            },
        ],
        itemCount: {
            type: Number,
            default: 0,
        },
        color: {
            type: String,
            default: '#F97316',
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
collectionSchema.index({ userId: 1, isDeleted: 1 });
collectionSchema.index({ name: 1 });

const collectionModel = mongoose.model('Collection', collectionSchema);

export default collectionModel;
