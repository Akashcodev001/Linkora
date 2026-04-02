import mongoose from 'mongoose';

const highlightSchema = new mongoose.Schema(
    {
        itemId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Item',
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        text: {
            type: String,
            required: true,
        },
        color: {
            type: String,
            default: 'yellow',
            enum: ['yellow', 'green', 'blue', 'red', 'purple'],
        },
        note: {
            type: String,
            default: null,
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
highlightSchema.index({ itemId: 1, userId: 1, isDeleted: 1 });

const highlightModel = mongoose.model('Highlight', highlightSchema);

export default highlightModel;
