// eslint-disable-next-line @typescript-eslint/no-require-imports
const AppleStrategy = require('passport-apple');
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Container } from 'typedi';
import { OAuthCallbackUseCase } from '../../../application/auth/OAuthCallbackUseCase';

export function configurePassport(): void {
  const getUseCase = () => Container.get(OAuthCallbackUseCase);

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${process.env.API_URL}/api/v1/auth/google/callback`,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value ?? null;
            if (!email) return done(null, false, { message: 'oauth_email_missing' });
            const result = await getUseCase().execute({
              provider: 'google',
              providerId: profile.id,
              email,
              name: profile.displayName ?? null,
            });
            done(null, result);
          } catch (err) {
            done(err as Error);
          }
        },
      ),
    );
  }

  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: process.env.FACEBOOK_APP_ID,
          clientSecret: process.env.FACEBOOK_APP_SECRET,
          callbackURL: `${process.env.API_URL}/api/v1/auth/facebook/callback`,
          profileFields: ['id', 'displayName', 'emails'],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value ?? null;
            if (!email) return done(null, false, { message: 'oauth_email_missing' });
            const result = await getUseCase().execute({
              provider: 'facebook',
              providerId: profile.id,
              email,
              name: profile.displayName ?? null,
            });
            done(null, result);
          } catch (err) {
            done(err as Error);
          }
        },
      ),
    );
  }

  if (
    process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY
  ) {
    passport.use(
      new AppleStrategy(
        {
          clientID: process.env.APPLE_CLIENT_ID,
          teamID: process.env.APPLE_TEAM_ID,
          keyID: process.env.APPLE_KEY_ID,
          privateKeyString: process.env.APPLE_PRIVATE_KEY,
          callbackURL: `${process.env.API_URL}/api/v1/auth/apple/callback`,
          scope: ['email', 'name'],
        },
        async (_accessToken: any, _refreshToken: any, idToken: any, profile: any, done: any) => {
          try {
            const email: string | null = idToken?.email ?? null;
            const firstName = profile?.name?.firstName ?? '';
            const lastName = profile?.name?.lastName ?? '';
            const name = [firstName, lastName].filter(Boolean).join(' ') || null;
            const providerId: string = idToken?.sub ?? profile?.id;
            if (!providerId) return done(null, false, { message: 'oauth_failed' });
            const result = await getUseCase().execute({
              provider: 'apple',
              providerId,
              email,
              name,
            });
            done(null, result);
          } catch (err) {
            done(err as Error);
          }
        },
      ),
    );
  }
}
