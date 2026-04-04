import nodemailer from 'nodemailer';

let transporter = null;
let transportAttempted = false;
let usingFallbackTransport = false;
let currentAuthSignature = '';
let lastUpgradeAttemptMs = 0;

const NON_ROUTABLE_DOMAINS = new Set([
    'example.com',
    'example.net',
    'example.org',
    'localhost',
    'invalid',
    'test',
]);

function shouldSuppressDelivery(address) {
    const email = String(address || '').trim().toLowerCase();
    const atIndex = email.lastIndexOf('@');
    if (atIndex < 0) return false;

    const domain = email.slice(atIndex + 1);
    return NON_ROUTABLE_DOMAINS.has(domain);
}

function buildAuthConfig() {
    const user = String(process.env.GOOGLE_USER || '').trim();
    const appPassword = String(process.env.GOOGLE_APP_PASSWORD || '').trim();
    const clientId = String(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
    const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
    const refreshToken = String(process.env.GOOGLE_REFRESH_TOKEN || '').trim();

    if (user && appPassword) {
        return {
            mode: 'app-password',
            signature: `app:${user}:${appPassword.length}`,
            auth: {
                user,
                pass: appPassword,
            },
        };
    }

    const hasOAuthConfig =
        user &&
        clientId &&
        clientSecret &&
        refreshToken;

    if (hasOAuthConfig) {
        return {
            mode: 'oauth2',
            signature: `oauth:${user}:${clientId}:${refreshToken.slice(0, 12)}`,
            auth: {
                type: 'OAuth2',
                user,
                clientId,
                clientSecret,
                refreshToken,
            },
        };
    }

    return null;
}

function canUseFallbackTransport() {
    const explicit = String(process.env.EMAIL_TRANSPORT_FALLBACK || '').toLowerCase();
    if (explicit === 'false' || explicit === '0' || explicit === 'no') {
        return false;
    }

    return process.env.NODE_ENV !== 'production';
}

function createFallbackTransport() {
    usingFallbackTransport = true;
    return nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
    });
}

async function createVerifiedGmailTransport(authConfig) {
    const candidates = [
        { host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true },
        { host: 'smtp.gmail.com', port: 465, secure: true, requireTLS: false },
    ];

    let lastError = null;

    for (const candidate of candidates) {
        const nextTransport = nodemailer.createTransport({
            ...candidate,
            family: 4,
            connectionTimeout: 15000,
            greetingTimeout: 15000,
            socketTimeout: 30000,
            auth: authConfig.auth,
        });

        try {
            await nextTransport.verify();
            return nextTransport;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Unable to verify Gmail SMTP transport');
}

async function getTransporter() {
    const authConfig = buildAuthConfig();

    if (transporter && currentAuthSignature && authConfig?.signature && currentAuthSignature !== authConfig.signature) {
        transporter = null;
        transportAttempted = false;
        usingFallbackTransport = false;
    }

    if (transporter && usingFallbackTransport && authConfig) {
        const now = Date.now();
        if (now - lastUpgradeAttemptMs > 30_000) {
            lastUpgradeAttemptMs = now;
            try {
                transporter = await createVerifiedGmailTransport(authConfig);
                usingFallbackTransport = false;
                currentAuthSignature = authConfig.signature || '';
                console.log(`Email transporter upgraded to Gmail (${authConfig.mode})`);
                return transporter;
            } catch {
                return transporter;
            }
        }
    }

    if (transporter) {
        return transporter;
    }

    if (!authConfig && canUseFallbackTransport()) {
        transporter = createFallbackTransport();
        currentAuthSignature = 'fallback';
        console.warn('Email transporter fallback enabled (development mode). Emails will be captured locally, not sent.');
        return transporter;
    }

    if (!authConfig) {
        throw new Error('Email transporter is not configured. Provide GOOGLE_USER + GOOGLE_APP_PASSWORD or GOOGLE_USER + GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN.');
    }

    if (!transportAttempted) {
        transportAttempted = true;
        try {
            transporter = await createVerifiedGmailTransport(authConfig);
            usingFallbackTransport = false;
            currentAuthSignature = authConfig.signature || '';
            console.log(`Email transporter is ready to send emails (${authConfig.mode})`);
        } catch (error) {
            if (canUseFallbackTransport()) {
                transporter = createFallbackTransport();
                currentAuthSignature = 'fallback';
                console.warn(`Email transporter verify failed (${error.message}). Falling back to local transport.`);
                return transporter;
            }

            transporter = null;
            throw new Error(`Error setting up email transporter: ${error.message}`);
        }
    }

    return transporter;
}

export async function initEmailTransporter() {
    if (process.env.NODE_ENV === 'test') {
        return true;
    }

    try {
        await getTransporter();
        return true;
    } catch (error) {
        console.error(error.message);
        return false;
    }
}



export async function sendEmail({ to, subject, html, text }) {
    if (process.env.NODE_ENV === 'test') {
        return;
    }

    if (shouldSuppressDelivery(to)) {
        console.warn(`Email delivery suppressed for non-routable domain: ${to}`);
        return;
    }

    const activeTransporter = await getTransporter();

    const mailOptions = {
        from: process.env.GOOGLE_USER,
        to,
        subject,
        html,
        text
    };

    try {
        const details = await activeTransporter.sendMail(mailOptions);
        if (usingFallbackTransport) {
            console.log(`Email captured locally for ${to}. Configure Google auth to send real emails.`);
        } else {
            console.log("Email sent:", details.response || details.messageId);
        }
    } catch (error) {
        throw new Error(`Email send failed: ${error.message}`);
    }
}