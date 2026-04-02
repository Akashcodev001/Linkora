import userModel from "../../models/user.model.js";
import refreshTokenModel from "../../models/refreshToken.model.js";
import tokenAuditModel from "../../models/tokenAudit.model.js";

export async function findUserByEmail(email) {
    return userModel.findOne({ email });
}

export async function findUserByOAuthProvider(provider, providerId) {
    const query = {};
    query[`oauthProviders.${provider}.providerId`] = providerId;
    return userModel.findOne(query);
}

export async function findUserByUsername(username) {
    return userModel.findOne({ username });
}

export async function findUserByEmailOrUsername(email, username) {
    return userModel.findOne({
        $or: [{ email }, { username }],
    });
}

export async function createUser(payload) {
    return userModel.create(payload);
}

export async function linkOAuthProvider(userId, provider, providerPayload = {}) {
    const setPayload = {
        [`oauthProviders.${provider}.providerId`]: providerPayload.providerId,
        [`oauthProviders.${provider}.email`]: providerPayload.email || null,
        verified: true,
    };

    if (provider === 'github' && providerPayload.username) {
        setPayload['oauthProviders.github.username'] = providerPayload.username;
    }

    if (providerPayload.makePrimaryAuthProvider) {
        setPayload.primaryAuthProvider = provider;
    }

    return userModel.findByIdAndUpdate(
        userId,
        { $set: setPayload },
        { returnDocument: 'after' }
    );
}

export async function findUserById(userId) {
    return userModel.findById(userId);
}

export async function createRefreshToken(userId, tokenHash, expiresAt) {
    return refreshTokenModel.create({ userId, tokenHash, expiresAt });
}

export async function findRefreshToken(tokenHash) {
    return refreshTokenModel.findOne({ tokenHash });
}

export async function findActiveRefreshToken(tokenHash) {
    return refreshTokenModel.findOne({ tokenHash, revokedAt: null });
}

export async function revokeRefreshToken(tokenHash) {
    return refreshTokenModel.findOneAndUpdate(
        { tokenHash, revokedAt: null },
        { revokedAt: new Date(), revokedReason: "manual_revoke" },
        { returnDocument: "after" }
    );
}

export async function revokeAllUserTokens(userId, reason = "session_compromised") {
    return refreshTokenModel.updateMany(
        { userId, revokedAt: null },
        { revokedAt: new Date(), revokedReason: reason }
    );
}

export async function revokeUserTokens(userId) {
    return revokeAllUserTokens(userId, "session_compromised");
}

export async function saveRefreshToken(userId, tokenHash, metadata = {}, previousTokenHash = null, session = null) {
    // Single-session policy: revoke any existing active session before creating a new one.
    await revokeAllUserTokens(userId, "single_session_enforced");

    const doc = {
        userId,
        tokenHash,
        previousTokenHash,
        expiresAt: metadata.expiresAt,
        metadata: {
            ip: metadata.ip || null,
            userAgent: metadata.userAgent || null,
            deviceId: metadata.deviceId || null,
        },
    };

    const [created] = await refreshTokenModel.create([doc], session ? { session } : undefined);
    return created;
}

export async function rotateRefreshTokenAtomically(currentTokenHash, newTokenHash, metadata = {}) {
    const now = new Date();

    const current = await refreshTokenModel.findOneAndUpdate(
        {
            tokenHash: currentTokenHash,
            revokedAt: null,
            expiresAt: { $gt: now },
        },
        {
            revokedAt: now,
            revokedReason: "rotated",
            replacedByTokenHash: newTokenHash,
            lastUsedAt: now,
        },
        { returnDocument: "after" }
    );

    if (!current) {
        return { ok: false, current: null, next: null };
    }

    const next = await saveRefreshToken(
        current.userId,
        newTokenHash,
        metadata,
        currentTokenHash
    );

    return { ok: true, current, next };
}

export async function recordTokenUsage(userId, tokenHash, ipAddress, options = {}) {
    const { tokenType = "refresh", userAgent = undefined, deviceId = undefined } = options;
    const existing = await tokenAuditModel.findOne({ userId, tokenHash });

    if (existing) {
        existing.reuseCount += 1;
        existing.suspiciousReuse = true;
        if (!existing.ipAddresses.includes(ipAddress)) {
            existing.ipAddresses.push(ipAddress);
        }
        if (userAgent && !existing.userAgent) {
            existing.userAgent = userAgent;
        }
        if (deviceId && !existing.deviceId) {
            existing.deviceId = deviceId;
        }
        return existing.save();
    }

    return tokenAuditModel.create({
        userId,
        tokenHash,
        tokenType,
        ipAddresses: [ipAddress],
        userAgent,
        deviceId,
        reuseCount: 0,
        suspiciousReuse: false,
    });
}

export async function checkTokenCompromise(tokenHash) {
    return tokenAuditModel.findOne({ tokenHash, suspiciousReuse: true });
}

export async function revokeUserTokenAudit(userId) {
    return tokenAuditModel.updateMany(
        { userId },
        { suspiciousReuse: true }
    );
}

export async function markCompromisedTokenUsage(userId, tokenHash, ipAddress, options = {}) {
    const { tokenType = "refresh", userAgent = undefined, deviceId = undefined } = options;
    const existing = await tokenAuditModel.findOne({ userId, tokenHash });

    if (existing) {
        existing.suspiciousReuse = true;
        existing.reuseCount += 1;
        if (ipAddress && !existing.ipAddresses.includes(ipAddress)) {
            existing.ipAddresses.push(ipAddress);
        }
        if (userAgent) {
            existing.userAgent = userAgent;
        }
        if (deviceId) {
            existing.deviceId = deviceId;
        }
        return existing.save();
    }

    return tokenAuditModel.create({
        userId,
        tokenHash,
        tokenType,
        suspiciousReuse: true,
        reuseCount: 1,
        ipAddresses: ipAddress ? [ipAddress] : [],
        userAgent,
        deviceId,
    });
}
