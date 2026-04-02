/**
 * Token Compromise Detection Logic
 * Handles token reuse detection and security alerts
 */

import * as authRepository from "../../modules/auth/auth.repository.js";
import { sendError } from "../helpers/response.js";

/**
 * Check and record token usage for compromise detection
 * @param {string} userId - User ID
 * @param {string} tokenHash - Hashed token
 * @param {string} ipAddress - IP address making the request
 * @param {object} res - Response object
 * @returns {object} Token audit record or error response
 */
export async function detectTokenCompromise(userId, tokenHash, ipAddress, res, options = {}) {
    try {
        const tokenAudit = await authRepository.recordTokenUsage(userId, tokenHash, ipAddress, options);

        // If token was already used (reuse count > 1), it's compromised
        if (tokenAudit.suspiciousReuse && tokenAudit.reuseCount > 1) {
            // Immediate action: revoke all user tokens
            await authRepository.revokeUserTokens(userId);
            
            return sendError(
                res,
                "Security alert: Your account shows suspicious activity. Please login again.",
                "Token compromise detected",
                403
            );
        }

        return null; // No compromise detected
    } catch (error) {
        console.error("Compromise detection error:", error);
        return sendError(res, "Security check failed", error.message, 500);
    }
}

/**
 * Log token usage for audit trail
 * @param {string} userId - User ID
 * @param {string} action - Action (login, refresh, logout)
 * @param {string} ipAddress - IP address
 * @param {boolean} success - Whether action succeeded
 */
export function auditLog(userId, action, ipAddress, success) {
    console.log(`[AUDIT] ${new Date().toISOString()} | User: ${userId} | Action: ${action} | IP: ${ipAddress} | Success: ${success}`);
    // In production, this would write to a dedicated audit log service or database
}
