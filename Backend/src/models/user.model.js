import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: false,
            minlength: 6,
        },
        verified: {
            type: Boolean,
            default: false,
        },
        verificationEmailLastSentAt: {
            type: Date,
            default: null,
        },
        primaryAuthProvider: {
            type: String,
            enum: ['password', 'google', 'github'],
            default: 'password',
        },
        oauthProviders: {
            google: {
                providerId: {
                    type: String,
                    default: null,
                },
                email: {
                    type: String,
                    default: null,
                    lowercase: true,
                    trim: true,
                },
            },
            github: {
                providerId: {
                    type: String,
                    default: null,
                },
                email: {
                    type: String,
                    default: null,
                    lowercase: true,
                    trim: true,
                },
                username: {
                    type: String,
                    default: null,
                    trim: true,
                },
            },
        },
        subscriptionTier: {
            type: String,
            enum: ['free', 'pro', 'enterprise'],
            default: 'free',
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
            index: true,
        },
        isSuspended: {
            type: Boolean,
            default: false,
            index: true,
        },
        suspendedAt: {
            type: Date,
            default: null,
        },
        suspensionReason: {
            type: String,
            default: null,
            trim: true,
        },
        usageQuota: {
            maxItems: {
                type: Number,
                default: 100,
            },
            aiJobsPerDay: {
                type: Number,
                default: 50,
            },
            currentUsage: {
                items: {
                    type: Number,
                    default: 0,
                },
                aiJobsToday: {
                    type: Number,
                    default: 0,
                },
                lastReset: {
                    type: Date,
                    default: Date.now,
                },
            },
        },
        preferences: {
            theme: {
                type: String,
                enum: ['light', 'dark'],
                default: 'light',
            },
            notifications: {
                type: Boolean,
                default: true,
            },
            emailNotifications: {
                type: Boolean,
                default: false,
            },
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
        deletedAt: {
            type: Date,
            default: null,
            index: true,
        },
    },
    { timestamps: true }
);

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    if (!this.password) return;
    this.password = await bcrypt.hash(this.password, 10);
});

// Indexes for performance
userSchema.index({ isDeleted: 1 });
userSchema.index({ isSuspended: 1, role: 1 });
userSchema.index(
    { 'oauthProviders.google.providerId': 1 },
    {
        unique: true,
        sparse: true,
        partialFilterExpression: {
            'oauthProviders.google.providerId': { $type: 'string' },
        },
    }
);
userSchema.index(
    { 'oauthProviders.github.providerId': 1 },
    {
        unique: true,
        sparse: true,
        partialFilterExpression: {
            'oauthProviders.github.providerId': { $type: 'string' },
        },
    }
);

userSchema.methods.comparePassword = function (candidatePassword) {
    if (!this.password) {
        return false;
    }
    return bcrypt.compare(candidatePassword, this.password);
};




const userModel = mongoose.model('User', userSchema);

export default userModel;