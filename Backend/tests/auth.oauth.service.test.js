import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import userModel from '../src/models/user.model.js';
import refreshTokenModel from '../src/models/refreshToken.model.js';
import { handleOAuthLogin } from '../src/modules/auth/auth.service.js';

let mongod;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
    const collections = mongoose.connection.collections;
    await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) {
        await mongod.stop();
    }
});

describe('OAuth auth service', () => {
    test('creates an unverified user on first OAuth login (requires email verification)', async () => {
        const result = await handleOAuthLogin({
            provider: 'google',
            providerId: 'google-user-001',
            email: 'oauth.new@example.com',
            displayName: 'OAuth New',
            usernameHint: 'oauthnew',
            ipAddress: '127.0.0.1',
            userAgent: 'jest',
            deviceId: 'test-device',
        });

        expect(result.isNewUser).toBe(true);
        expect(result.linkedProvider).toBe(false);
        expect(result.shouldSendVerificationEmail).toBe(true);
        expect(result.accessToken).toBeTruthy();
        expect(result.refreshToken).toBeTruthy();

        const created = await userModel.findOne({ email: 'oauth.new@example.com' }).lean();
        expect(created).toBeTruthy();
        expect(created.verified).toBe(false);
        expect(created.oauthProviders.google.providerId).toBe('google-user-001');
        expect(created.primaryAuthProvider).toBe('google');
    });

    test('links provider for existing password account by same email', async () => {
        const localUser = await userModel.create({
            username: 'localuser',
            email: 'local.user@example.com',
            password: '12345678',
            verified: false,
        });

        const result = await handleOAuthLogin({
            provider: 'github',
            providerId: 'github-user-001',
            email: 'local.user@example.com',
            displayName: 'Local User',
            usernameHint: 'local-gh',
            ipAddress: '127.0.0.1',
            userAgent: 'jest',
            deviceId: 'device-link',
        });

        expect(String(result.user._id)).toBe(String(localUser._id));
        expect(result.isNewUser).toBe(false);
        expect(result.linkedProvider).toBe(true);

        const updated = await userModel.findById(localUser._id).lean();
        expect(updated.verified).toBe(true);
        expect(updated.oauthProviders.github.providerId).toBe('github-user-001');
        expect(updated.password).toBeTruthy();
    });

    test('merges accounts safely for different providers sharing same email', async () => {
        const first = await handleOAuthLogin({
            provider: 'google',
            providerId: 'google-merge-1',
            email: 'merge.same@example.com',
            displayName: 'Merge Same',
            usernameHint: 'mergesame',
            ipAddress: '127.0.0.1',
            userAgent: 'jest',
            deviceId: 'd1',
        });

        const second = await handleOAuthLogin({
            provider: 'github',
            providerId: 'github-merge-1',
            email: 'merge.same@example.com',
            displayName: 'Merge Same',
            usernameHint: 'mergesamegh',
            ipAddress: '127.0.0.1',
            userAgent: 'jest',
            deviceId: 'd2',
        });

        expect(String(second.user._id)).toBe(String(first.user._id));

        const users = await userModel.find({ email: 'merge.same@example.com' }).lean();
        expect(users.length).toBe(1);
        expect(users[0].oauthProviders.google.providerId).toBe('google-merge-1');
        expect(users[0].oauthProviders.github.providerId).toBe('github-merge-1');
    });

    test('re-login with same provider keeps one active refresh session', async () => {
        const first = await handleOAuthLogin({
            provider: 'google',
            providerId: 'google-relogin-1',
            email: 'relogin@example.com',
            displayName: 'Relogin User',
            usernameHint: 'relogin',
            ipAddress: '127.0.0.1',
            userAgent: 'jest',
            deviceId: 'dev-a',
        });

        const second = await handleOAuthLogin({
            provider: 'google',
            providerId: 'google-relogin-1',
            email: 'relogin@example.com',
            displayName: 'Relogin User',
            usernameHint: 'relogin',
            ipAddress: '127.0.0.1',
            userAgent: 'jest',
            deviceId: 'dev-b',
        });

        expect(String(second.user._id)).toBe(String(first.user._id));

        const tokens = await refreshTokenModel.find({ userId: second.user._id }).lean();
        const activeTokens = tokens.filter((token) => !token.revokedAt);
        expect(activeTokens.length).toBe(1);
        expect(tokens.length).toBeGreaterThanOrEqual(1);
    });

    test('rejects OAuth login when provider does not return email', async () => {
        await expect(
            handleOAuthLogin({
                provider: 'github',
                providerId: 'github-no-email',
                email: '',
                displayName: 'No Email',
                usernameHint: 'noemail',
                ipAddress: '127.0.0.1',
                userAgent: 'jest',
                deviceId: 'dev-x',
            })
        ).rejects.toMatchObject({
            statusCode: 400,
            message: 'Email is required for OAuth login',
        });
    });
});
