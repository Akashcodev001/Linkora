import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GithubStrategy } from 'passport-github2';
import env from './env.js';

function getGoogleEmail(profile) {
    const first = profile?.emails?.[0];
    if (!first?.value) {
        return null;
    }

    // Google marks verified addresses explicitly; we reject unverified/missing flags.
    if (typeof first.verified === 'boolean' && !first.verified) {
        return null;
    }

    return String(first.value).trim().toLowerCase();
}

function getGithubVerifiedPrimaryEmail(profile) {
    const emails = Array.isArray(profile?.emails) ? profile.emails : [];
    const primaryVerified = emails.find((entry) => entry?.value && entry?.verified && entry?.primary);
    if (primaryVerified) {
        return String(primaryVerified.value).trim().toLowerCase();
    }

    const anyVerified = emails.find((entry) => entry?.value && entry?.verified);
    if (anyVerified) {
        return String(anyVerified.value).trim().toLowerCase();
    }

    return null;
}

export function configurePassport() {
    if (env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET) {
        passport.use(
            new GoogleStrategy(
                {
                    clientID: env.GOOGLE_OAUTH_CLIENT_ID,
                    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
                    callbackURL: env.GOOGLE_OAUTH_CALLBACK_URL,
                    scope: ['profile', 'email'],
                },
                async (_accessToken, _refreshToken, profile, done) => {
                    const email = getGoogleEmail(profile);
                    if (!email) {
                        return done(null, false, { message: 'Google account has no verified email' });
                    }

                    return done(null, {
                        provider: 'google',
                        providerId: profile.id,
                        email,
                        displayName: profile.displayName || '',
                        usernameHint: profile.name?.givenName || profile.username || '',
                    });
                }
            )
        );
    }

    if (env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET) {
        passport.use(
            new GithubStrategy(
                {
                    clientID: env.GITHUB_OAUTH_CLIENT_ID,
                    clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET,
                    callbackURL: env.GITHUB_OAUTH_CALLBACK_URL,
                    scope: ['user:email'],
                },
                async (_accessToken, _refreshToken, profile, done) => {
                    const email = getGithubVerifiedPrimaryEmail(profile);
                    if (!email) {
                        return done(null, false, { message: 'GitHub account has no verified public email' });
                    }

                    return done(null, {
                        provider: 'github',
                        providerId: profile.id,
                        email,
                        displayName: profile.displayName || profile.username || '',
                        usernameHint: profile.username || '',
                    });
                }
            )
        );
    }
}

export default passport;
