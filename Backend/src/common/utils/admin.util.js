import env from '../../config/env.js';

const adminEmailSet = new Set(
    String(env.ADMIN_EMAILS || '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
);

export function isAdminRole(role) {
    return String(role || '').toLowerCase() === 'admin';
}

export function isAdminEmail(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    return normalizedEmail ? adminEmailSet.has(normalizedEmail) : false;
}

export function isAdminUserLike(userLike = {}) {
    return isAdminRole(userLike?.role) || isAdminEmail(userLike?.email);
}
