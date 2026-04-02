import { Router } from "express";
import {
	register,
	verifyEmail,
	login,
	getMe,
	resendVerificationEmail,
	refresh,
	logout,
	oauthCallback,
	tokenCheck,
} from "./auth.controller.js";
import { registerValidator, loginValidator, resendVerificationValidator } from "./auth.validator.js";
import { authUser } from "../../common/middleware/auth.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { asyncHandler } from "../../common/helpers/asyncHandler.js";
import passport from "../../config/passport.js";
import env from "../../config/env.js";


const authRouter = Router();


/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 * @body { username: String, email: String, password: String }
 */

authRouter.post('/register', registerValidator, asyncHandler(register));


/**
 * @route POST /api/auth/login
 * @desc Login user and return JWT token
 * @access Public
 * @body { email: String, password: String }
 */

authRouter.post('/login', loginValidator, asyncHandler(login));

/**
 * @route POST /api/auth/resend-verification
 * @desc Resend verification email with cooldown
 * @access Public
 * @body { email: String }
 */
authRouter.post('/resend-verification', resendVerificationValidator, asyncHandler(resendVerificationEmail));

/**
 * @route GET /api/auth/get-me
 * @desc Get current logged in user's info
 * @access Private
 */

authRouter.get('/get-me',authUser,asyncHandler(getMe));

/**
 * @route GET /api/auth/me
 * @desc Get current logged in user's info (alias for /get-me)
 * @access Private
 */

authRouter.get('/me',authUser,asyncHandler(getMe));

/**
 * @route GET /api/auth/token-check
 * @desc Validate access token for browser extension and API clients
 * @access Private
 */
authRouter.get('/token-check', authenticate, asyncHandler(tokenCheck));

/**
 * @route GET /api/auth/verify-email
 * @desc Verify user's email address
 * @access Public
 * @query { token }
 */
authRouter.get("/verify-email",asyncHandler(verifyEmail));

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token using refresh token
 * @access Public
 * @body { refreshToken: String }
 */
authRouter.post('/refresh', asyncHandler(refresh));

/**
 * @route POST /api/auth/logout
 * @desc Logout user and revoke tokens
 * @access Private
 * @body { refreshToken: String }
 */
authRouter.post('/logout', authUser, asyncHandler(logout));

/**
 * @route GET /api/auth/google
 * @desc Start Google OAuth flow
 * @access Public
 */
authRouter.get('/google', (req, res, next) => {
	const state = JSON.stringify({
		client: req.query?.client || '',
		redirect_uri: req.query?.redirect_uri || '',
	});

	passport.authenticate('google', {
		session: false,
		scope: ['profile', 'email'],
		state,
	})(req, res, next);
});

/**
 * @route GET /api/auth/google/callback
 * @desc Google OAuth callback
 * @access Public
 */
authRouter.get(
	'/google/callback',
	passport.authenticate('google', {
		session: false,
		failureRedirect: `${env.AUTH_OAUTH_FAILURE_REDIRECT}?error=google_auth_failed`,
	}),
	asyncHandler(oauthCallback)
);

/**
 * @route GET /api/auth/github
 * @desc Start GitHub OAuth flow
 * @access Public
 */
authRouter.get('/github', (req, res, next) => {
	const state = JSON.stringify({
		client: req.query?.client || '',
		redirect_uri: req.query?.redirect_uri || '',
	});

	passport.authenticate('github', {
		session: false,
		scope: ['user:email'],
		state,
	})(req, res, next);
});

/**
 * @route GET /api/auth/github/callback
 * @desc GitHub OAuth callback
 * @access Public
 */
authRouter.get(
	'/github/callback',
	passport.authenticate('github', {
		session: false,
		failureRedirect: `${env.AUTH_OAUTH_FAILURE_REDIRECT}?error=github_auth_failed`,
	}),
	asyncHandler(oauthCallback)
);

export default authRouter;