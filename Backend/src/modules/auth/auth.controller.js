import userModel from "../../models/user.model.js";
import jwt from "jsonwebtoken";
import { sendEmail } from "../../services/mail.service.js";
import { sendError, sendSuccess } from "../../common/helpers/response.js";
import {
    hashToken,
    getAuthCookieOptions,
    rotateRefreshSession,
    issueSingleSessionLoginTokens,
    handleOAuthLogin,
} from "./auth.service.js";
import * as authRepository from "./auth.repository.js";
import env from "../../config/env.js";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const VERIFICATION_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

function buildOAuthRedirectUrl(base, params = {}) {
    const target = new URL(base);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            target.searchParams.set(key, String(value));
        }
    });

    return target.toString();
}

function decodeOAuthState(rawState) {
    if (!rawState) return null;

    try {
        const parsed = JSON.parse(String(rawState));
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function isTrustedExtensionRedirect(redirectUri) {
    if (!redirectUri) return false;

    try {
        const parsed = new URL(String(redirectUri));
        return parsed.protocol === 'https:' && parsed.hostname.endsWith('.chromiumapp.org');
    } catch {
        return false;
    }
}

function buildExtensionTokenRedirect(base, result, provider) {
    const target = new URL(base);
    const payload = new URLSearchParams({
        provider: String(provider || ''),
        accessToken: String(result.accessToken || ''),
        refreshToken: String(result.refreshToken || ''),
        expiresIn: '900',
    });

    target.hash = payload.toString();
    return target.toString();
}

/**
 * @desc Register a new user
 * @route POST /api/auth/register
 * @access Public
 * @body { username: String, email: String, password: String }
 */
export async function register(req,res){

    const {username,email,password} = req.body;

    const isUserAlreadyexists=await userModel.findOne({
            $or:[
                {username},
                {email}
            ]
        })

        if(isUserAlreadyexists){
            return sendError(res, "User with this email or username already exists", "User already exists", 400);
        }

        const user=await userModel.create({
            username,
            email,
            password
        })

        const emailVerificationToken=jwt.sign({
            email:user.email
        },process.env.JWT_SECRET)

        try {
            await sendEmail({
                to:email,
                subject:"Welcome to Linkora - Please verify your email",
                html:`  <p>Hi ${username},</p>
                    <p>Thank you for registering at <strong>Linkora</strong>. We're excited to have you on board!</p>
                    <p>Please verify your email address by clicking the link below:</p>
                    <a href="${BACKEND_URL}/api/auth/verify-email?token=${emailVerificationToken}">Verify Email</a>
                    <p>If you did not create an account, please ignore this email.</p>
                    <p>Best regards,<br>The Linkora Team</p>`
            });
        } catch (error) {
            await userModel.findByIdAndDelete(user._id);
            return sendError(res, "Could not send verification email. Please try again.", error.message, 500);
        }

        user.verificationEmailLastSentAt = new Date();
        await user.save();

        return sendSuccess(res, "User registered successfully", {
            user:{
                id:user._id,
                username:user.username,
                email:user.email,
                role:user.role,
            }
        }, 201);

   
}



/**
 * @desc Login user and return JWT token
 * @route POST /api/auth/login
 * @access Public
 * @body { email: String, password: String }
 */

export async function login(req,res){
    const {email,password}=req.body;
    

    const user=await userModel.findOne({email});

    if(!user){
        return sendError(res, "Invalid email or password", "User not found", 400);
    }

    const isPasswordMatch=await user.comparePassword(password);
    if(!isPasswordMatch){
        return sendError(res, "Invalid email or password", "Incorrect password", 400);
    }

    if(!user.verified){
        return sendError(res, "Please verify your email before logging in", "Email not verified", 400);
    }

    if (user.isSuspended) {
        return sendError(res, 'Account is suspended. Contact support.', 'User suspended', 403);
    }

    const { accessToken, refreshToken } = await issueSingleSessionLoginTokens({
        user,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        deviceId: req.headers["x-device-id"],
    });

    res.cookie("accessToken", accessToken, getAuthCookieOptions(15 * 60 * 1000));
    res.cookie("refreshToken", refreshToken, getAuthCookieOptions(7 * 24 * 60 * 60 * 1000));

    return sendSuccess(res, "Login successful", {
        user:{
            id:user._id,
            username:user.username,
            email:user.email,
            role:user.role,
        }
    });
}


/**
 * @desc Get current logged in user's info
 * @route GET /api/auth/get-me
 * @access Private
 */

export async function getMe(req,res){
    const userId=req.user.id;

    const user=await userModel.findById(userId).select("-password");


    if(!user){
        return sendError(res, "User not found", "User not found", 404);
    }
    return sendSuccess(res, "User found", { user });

}

/**
 * @desc Validate active access token (extension friendly)
 * @route GET /api/auth/token-check
 * @access Private
 */
export async function tokenCheck(req, res) {
    const userId = req.user?.id;

    if (!userId) {
        return sendError(res, 'Unauthorized', 'No user in token', 401);
    }

    const user = await userModel.findById(userId).select('username email verified role');
    if (!user) {
        return sendError(res, 'User not found', 'User not found', 404);
    }

    return sendSuccess(res, 'Token valid', {
        valid: true,
        user,
    });
}


/**
 * @desc Verify user's email address
 * @route GET /api/auth/verify-email
 * @access Public
 * @query { token }
 */

export async function verifyEmail(req,res){
     const {token}= req.query;

     if(!token){
        return res.status(400).send(`
            <h1>Verification Failed</h1>
            <p>Verification token is missing.</p>
        `);
     }

     try{
         const decoded=jwt.verify(token,process.env.JWT_SECRET);

    const user=await userModel.findOne({email:decoded.email});

    if(!user){
        return res.status(400).send(`
            <h1>Verification Failed</h1>
            <p>Invalid verification link or user not found.</p>
        `);
    }

    if(!user.verified){
        user.verified=true;
        await user.save();
    }


    const html=`    <h1>Email Verified Successfully</h1>
    <p>Your registration is complete. You can now log in to your account.</p>
    <p><a href="${FRONTEND_URL}">Go to Login</a></p>
    `
   return  res.send(html)
 }catch(err){
        return res.status(400).send(`
            <h1>Verification Failed</h1>
            <p>This link is invalid or expired. Please register again.</p>
        `);
     }


}

/**
 * @desc Resend verification email with cooldown
 * @route POST /api/auth/resend-verification
 * @access Public
 * @body { email: String }
 */
export async function resendVerificationEmail(req,res){
    const {email} = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await userModel.findOne({email: normalizedEmail});

    if(!user){
        return sendError(res, "User not found", "User not found", 404);
    }

    if(user.verified){
        return sendError(res, "Email is already verified", "Email already verified", 400);
    }

    const now = Date.now();
    if(user.verificationEmailLastSentAt){
        const lastSentAt = new Date(user.verificationEmailLastSentAt).getTime();
        const elapsed = now - lastSentAt;

        if(elapsed < VERIFICATION_RESEND_COOLDOWN_MS){
            const remainingSeconds = Math.ceil((VERIFICATION_RESEND_COOLDOWN_MS - elapsed) / 1000);
            return sendError(res, "Please wait before requesting another verification email", {
                err:"Resend cooldown active",
                remainingSeconds
            }, 429);
        }
    }

    const emailVerificationToken = jwt.sign({
        email:user.email
    },process.env.JWT_SECRET);

    await sendEmail({
        to:user.email,
        subject:"Linkora - Verify your email",
        html:`  <p>Hi ${user.username},</p>
                <p>You requested a new verification link for your <strong>Linkora</strong> account.</p>
                <p>Please verify your email address by clicking the link below:</p>
                <a href="${BACKEND_URL}/api/auth/verify-email?token=${emailVerificationToken}">Verify Email</a>
                <p>If you did not request this, you can ignore this email.</p>
                <p>Best regards,<br>The Linkora Team</p>`
    });

    user.verificationEmailLastSentAt = new Date();
    await user.save();

    return sendSuccess(res, "Verification email sent successfully");
}

/**
 * @desc Refresh access token using refresh token
 * @route POST /api/auth/refresh
 * @access Public
 * @body { refreshToken: String }
 */
export async function refresh(req,res){
    const { refreshToken } = req.body || {};
    const cookieRefreshToken = req.cookies?.refreshToken;
    const token = refreshToken || cookieRefreshToken;

    if(!token){
        return sendError(res, "Refresh token is required", "No refresh token", 401);
    }

    try {
        const rotated = await rotateRefreshSession({
            rawRefreshToken: token,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
            deviceId: req.headers["x-device-id"],
        });

        res.cookie("accessToken", rotated.accessToken, getAuthCookieOptions(15 * 60 * 1000));
        res.cookie("refreshToken", rotated.refreshToken, getAuthCookieOptions(7 * 24 * 60 * 60 * 1000));

        return sendSuccess(res, "Token refreshed successfully", { accessToken: rotated.accessToken });
    } catch (error) {
        return sendError(
            res,
            error.message || "Invalid refresh token",
            error.err || error.message,
            error.statusCode || 401
        );
    }
}

/**
 * @desc Logout user and revoke tokens
 * @route POST /api/auth/logout
 * @access Private
 */
export async function logout(req,res){
    const userId = req.user?.id;
    const { refreshToken } = req.body || {};
    const cookieRefreshToken = req.cookies?.refreshToken;
    const token = refreshToken || cookieRefreshToken;

    if(!userId){
        return sendError(res, "User not authenticated", "No user", 401);
    }

    if(token){
        const tokenHash = hashToken(token);
        await authRepository.revokeRefreshToken(tokenHash);
    }

    const clearCookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
    };
    res.clearCookie("accessToken", clearCookieOptions);
    res.clearCookie("refreshToken", clearCookieOptions);

    return sendSuccess(res, "Logged out successfully");
}

/**
 * @desc OAuth callback success handler (Google/GitHub)
 * @route GET /api/auth/:provider/callback
 * @access Public
 */
export async function oauthCallback(req, res) {
    const oauthIdentity = req.user;
    const oauthState = decodeOAuthState(req.query?.state);

    if (!oauthIdentity?.provider || !oauthIdentity?.providerId) {
        const redirectUrl = buildOAuthRedirectUrl(env.AUTH_OAUTH_FAILURE_REDIRECT, {
            error: "invalid_oauth_response",
        });
        return res.redirect(redirectUrl);
    }

    try {
        const result = await handleOAuthLogin({
            provider: oauthIdentity.provider,
            providerId: oauthIdentity.providerId,
            email: oauthIdentity.email,
            displayName: oauthIdentity.displayName,
            usernameHint: oauthIdentity.usernameHint,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
            deviceId: req.headers["x-device-id"],
        });

        // If new user created via OAuth, send verification email
        if (result.isNewUser && result.shouldSendVerificationEmail) {
            const emailVerificationToken = jwt.sign(
                { email: result.user.email },
                process.env.JWT_SECRET
            );

            try {
                const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
                await sendEmail({
                    to: result.user.email,
                    subject: "Welcome to Linkora - Verify your email",
                    html: `<p>Hi ${result.user.username},</p>
                    <p>Thank you for signing up to <strong>Linkora</strong> via ${oauthIdentity.provider.charAt(0).toUpperCase() + oauthIdentity.provider.slice(1)}. We're excited to have you!</p>
                    <p>Please verify your email address by clicking the link below:</p>
                    <a href="${BACKEND_URL}/api/auth/verify-email?token=${emailVerificationToken}">Verify Email</a>
                    <p>If you did not create an account, please ignore this email.</p>
                    <p>Best regards,<br>The Linkora Team</p>`,
                });

                result.user.verificationEmailLastSentAt = new Date();
                await result.user.save();
            } catch (emailError) {
                console.error("Failed to send verification email:", emailError);
                // Don't fail the OAuth flow, but user will see prompt to resend
            }
        }

        res.cookie("accessToken", result.accessToken, getAuthCookieOptions(15 * 60 * 1000));
        res.cookie("refreshToken", result.refreshToken, getAuthCookieOptions(7 * 24 * 60 * 60 * 1000));

        if (oauthState?.client === 'extension' && isTrustedExtensionRedirect(oauthState.redirect_uri)) {
            const extensionRedirect = buildExtensionTokenRedirect(
                oauthState.redirect_uri,
                result,
                oauthIdentity.provider,
            );
            return res.redirect(extensionRedirect);
        }

        const redirectUrl = buildOAuthRedirectUrl(env.AUTH_OAUTH_SUCCESS_REDIRECT, {
            provider: oauthIdentity.provider,
            linked: result.linkedProvider ? "1" : "0",
            created: result.isNewUser ? "1" : "0",
            verified: result.user?.verified ? "1" : "0",
        });

        return res.redirect(redirectUrl);
    } catch (error) {
        const redirectUrl = buildOAuthRedirectUrl(env.AUTH_OAUTH_FAILURE_REDIRECT, {
            error: error.message || "oauth_login_failed",
        });

        return res.redirect(redirectUrl);
    }
}