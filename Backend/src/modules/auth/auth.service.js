import jwt from "jsonwebtoken";
import crypto from "crypto";
import * as authRepository from "./auth.repository.js";

function authError(statusCode, message, err) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.err = err;
    return error;
}

function isCompromiseRevocationReason(reason) {
    return reason === "rotated" || reason === "reuse_detected";
}

export function getAuthCookieOptions(maxAgeMs) {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: maxAgeMs,
    };
}

export function signAccessToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "15m",
    });
}

export function signRefreshToken(payload) {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
}

export function signEmailVerificationToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET);
}

export function verifyToken(token) {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
}

export function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export function buildRefreshTokenPayload(userId) {
    return {
        id: userId,
        tokenId: crypto.randomUUID(),
    };
}

export async function issueSingleSessionLoginTokens({
    user,
    ipAddress,
    userAgent,
    deviceId,
}) {
    await authRepository.revokeAllUserTokens(user._id, "new_login");

    const accessToken = signAccessToken({
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
    });
    const refreshToken = signRefreshToken(buildRefreshTokenPayload(user._id.toString()));

    const refreshTokenHash = hashToken(refreshToken);
    await authRepository.saveRefreshToken(user._id, refreshTokenHash, {
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ip: ipAddress,
        userAgent,
        deviceId,
    });

    return {
        accessToken,
        refreshToken,
    };
}

export async function rotateRefreshSession({
    rawRefreshToken,
    ipAddress,
    userAgent,
    deviceId,
}) {
    if (!rawRefreshToken) {
        throw authError(401, "Refresh token is required", "No refresh token");
    }

    let decoded;
    try {
        decoded = verifyToken(rawRefreshToken);
    } catch (error) {
        throw authError(401, "Invalid refresh token", error.message);
    }

    const currentTokenHash = hashToken(rawRefreshToken);
    const tokenDoc = await authRepository.findRefreshToken(currentTokenHash);

    if (!tokenDoc) {
        throw authError(401, "Invalid refresh token", "Token not found");
    }

    if (tokenDoc.revokedAt) {
        if (isCompromiseRevocationReason(tokenDoc.revokedReason)) {
            await authRepository.markCompromisedTokenUsage(tokenDoc.userId, currentTokenHash, ipAddress, {
                tokenType: "refresh",
                userAgent,
                deviceId,
            });
            await authRepository.revokeAllUserTokens(tokenDoc.userId, "reuse_detected");
            await authRepository.revokeUserTokenAudit(tokenDoc.userId);
            throw authError(403, "Session compromised", "Refresh token reuse detected");
        }

        throw authError(401, "Invalid refresh token", "Token revoked");
    }

    if (tokenDoc.expiresAt <= new Date()) {
        await authRepository.revokeRefreshToken(currentTokenHash);
        throw authError(401, "Refresh token has expired", "Token expired");
    }

    await authRepository.recordTokenUsage(tokenDoc.userId, currentTokenHash, ipAddress, {
        tokenType: "refresh",
        userAgent,
        deviceId,
    });

    const user = await authRepository.findUserById(decoded.id);
    if (!user) {
        throw authError(401, "Invalid refresh token", "User not found");
    }

    const nextRefreshToken = signRefreshToken(buildRefreshTokenPayload(user._id.toString()));
    const nextRefreshTokenHash = hashToken(nextRefreshToken);

    const rotation = await authRepository.rotateRefreshTokenAtomically(currentTokenHash, nextRefreshTokenHash, {
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ip: ipAddress,
        userAgent,
        deviceId,
    });

    if (!rotation.ok) {
        const possiblyCompromised = await authRepository.findRefreshToken(currentTokenHash);
        if (possiblyCompromised?.revokedAt && isCompromiseRevocationReason(possiblyCompromised.revokedReason)) {
            await authRepository.markCompromisedTokenUsage(
                possiblyCompromised.userId,
                currentTokenHash,
                ipAddress,
                { tokenType: "refresh", userAgent, deviceId }
            );
            await authRepository.revokeAllUserTokens(possiblyCompromised.userId, "reuse_detected");
            throw authError(403, "Session compromised", "Refresh token reuse detected");
        }
        throw authError(401, "Invalid refresh token", "Rotation failed");
    }

    const nextAccessToken = signAccessToken({
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
    });

    return {
        user,
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken,
    };
}

function normalizeEmail(email) {
    if (!email) return "";
    return String(email).trim().toLowerCase();
}

function sanitizeUsernameSeed(seed) {
    const cleaned = String(seed || "user")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "")
        .slice(0, 20);

    return cleaned || "user";
}

async function createUniqueUsername(seed) {
    const base = sanitizeUsernameSeed(seed);

    for (let attempt = 0; attempt < 10; attempt += 1) {
        const suffix = attempt === 0 ? "" : `_${Math.floor(Math.random() * 9000) + 1000}`;
        const candidate = `${base}${suffix}`.slice(0, 28);
        const existing = await authRepository.findUserByUsername(candidate);
        if (!existing) {
            return candidate;
        }
    }

    return `user_${crypto.randomUUID().slice(0, 8)}`;
}

function validateOAuthInput({ provider, providerId, email }) {
    const supported = new Set(["google", "github"]);
    if (!supported.has(provider)) {
        throw authError(400, "Unsupported OAuth provider", "Provider not supported");
    }

    if (!providerId || typeof providerId !== "string") {
        throw authError(400, "Invalid OAuth response", "Missing provider ID");
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        throw authError(400, "Email is required for OAuth login", "Provider email missing");
    }

    return normalizedEmail;
}

export async function handleOAuthLogin({
    provider,
    providerId,
    email,
    displayName,
    usernameHint,
    ipAddress,
    userAgent,
    deviceId,
}) {
    const normalizedEmail = validateOAuthInput({ provider, providerId, email });

    const linkedByProvider = await authRepository.findUserByOAuthProvider(provider, providerId);
    if (linkedByProvider) {
        if (!linkedByProvider.verified) {
            linkedByProvider.verified = true;
            await linkedByProvider.save();
        }

        const tokens = await issueSingleSessionLoginTokens({
            user: linkedByProvider,
            ipAddress,
            userAgent,
            deviceId,
        });

        return {
            user: linkedByProvider,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isNewUser: false,
            linkedProvider: false,
        };
    }

    const existingByEmail = await authRepository.findUserByEmail(normalizedEmail);
    if (existingByEmail) {
        const payload = {
            providerId,
            email: normalizedEmail,
            username: provider === "github" ? usernameHint || null : null,
            makePrimaryAuthProvider: !existingByEmail.password,
        };

        const linked = await authRepository.linkOAuthProvider(existingByEmail._id, provider, payload);
        const targetUser = linked || existingByEmail;

        const tokens = await issueSingleSessionLoginTokens({
            user: targetUser,
            ipAddress,
            userAgent,
            deviceId,
        });

        return {
            user: targetUser,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isNewUser: false,
            linkedProvider: true,
        };
    }

    const usernameBase = usernameHint || displayName || normalizedEmail.split("@")[0] || provider;
    const username = await createUniqueUsername(usernameBase);
    const randomPassword = crypto.randomBytes(32).toString("hex");

    let createdUser;
    try {
        createdUser = await authRepository.createUser({
            username,
            email: normalizedEmail,
            password: randomPassword,
            verified: false,
            primaryAuthProvider: provider,
            oauthProviders: {
                [provider]: {
                    providerId,
                    email: normalizedEmail,
                    ...(provider === "github" ? { username: usernameHint || null } : {}),
                },
            },
        });
    } catch (error) {
        // Handle rare race where same email is created concurrently.
        if (error?.code === 11000) {
            const retryUser = await authRepository.findUserByEmail(normalizedEmail);
            if (retryUser) {
                const linked = await authRepository.linkOAuthProvider(retryUser._id, provider, {
                    providerId,
                    email: normalizedEmail,
                    username: provider === "github" ? usernameHint || null : null,
                    makePrimaryAuthProvider: !retryUser.password,
                });

                const tokens = await issueSingleSessionLoginTokens({
                    user: linked || retryUser,
                    ipAddress,
                    userAgent,
                    deviceId,
                });

                return {
                    user: linked || retryUser,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    isNewUser: false,
                    linkedProvider: true,
                };
            }
        }

        throw error;
    }

    const tokens = await issueSingleSessionLoginTokens({
        user: createdUser,
        ipAddress,
        userAgent,
        deviceId,
    });

    return {
        user: createdUser,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isNewUser: true,
        linkedProvider: false,
        shouldSendVerificationEmail: true,
    };
}
