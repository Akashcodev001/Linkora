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

function buildGmailApiConfig() {
    const user = String(process.env.GOOGLE_USER || '').trim();
    const clientId = String(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
    const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
    const refreshToken = String(process.env.GOOGLE_REFRESH_TOKEN || '').trim();

    if (user && clientId && clientSecret && refreshToken) {
        return {
            mode: 'gmail-api',
            signature: `gmail-api:${user}:${clientId}:${refreshToken.slice(0, 12)}`,
            user,
            clientId,
            clientSecret,
            refreshToken,
        };
    }

    return null;
}

function buildMimeMessage({ from, to, subject, html, text }) {
    const boundary = `linkora-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const parts = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
    ];

    if (html && text) {
        parts.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
        parts.push('');
        parts.push(`--${boundary}`);
        parts.push('Content-Type: text/plain; charset="UTF-8"');
        parts.push('Content-Transfer-Encoding: 7bit');
        parts.push('');
        parts.push(text);
        parts.push(`--${boundary}`);
        parts.push('Content-Type: text/html; charset="UTF-8"');
        parts.push('Content-Transfer-Encoding: 7bit');
        parts.push('');
        parts.push(html);
        parts.push(`--${boundary}--`);
    } else if (html) {
        parts.push('Content-Type: text/html; charset="UTF-8"');
        parts.push('');
        parts.push(html);
    } else {
        parts.push('Content-Type: text/plain; charset="UTF-8"');
        parts.push('');
        parts.push(text || '');
    }

    return Buffer.from(parts.join('\r\n'))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

async function getGoogleAccessToken(apiConfig) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: apiConfig.clientId,
            client_secret: apiConfig.clientSecret,
            refresh_token: apiConfig.refreshToken,
            grant_type: 'refresh_token',
        }),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Google token refresh failed: ${response.status} ${body}`.trim());
    }

    const data = await response.json();
    if (!data?.access_token) {
        throw new Error('Google token refresh failed: missing access token');
    }

    return data.access_token;
}

function createGmailApiTransport(apiConfig) {
    return {
        async verify() {
            return true;
        },
        async sendMail(mailOptions) {
            const accessToken = await getGoogleAccessToken(apiConfig);
            const raw = buildMimeMessage({
                from: mailOptions.from || apiConfig.user,
                to: mailOptions.to,
                subject: mailOptions.subject,
                html: mailOptions.html,
                text: mailOptions.text,
            });

            const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ raw }),
            });

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                throw new Error(`Gmail API send failed: ${response.status} ${body}`.trim());
            }

            const data = await response.json().catch(() => ({}));
            return {
                response: `gmail-api:${response.status}`,
                messageId: data.id || data.messageId || '',
            };
        },
    };
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
    const gmailApiConfig = buildGmailApiConfig();
    const authConfig = buildAuthConfig();

    if (gmailApiConfig) {
        if (!transporter || currentAuthSignature !== gmailApiConfig.signature) {
            transporter = createGmailApiTransport(gmailApiConfig);
            currentAuthSignature = gmailApiConfig.signature;
            usingFallbackTransport = false;
        }

        return transporter;
    }

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